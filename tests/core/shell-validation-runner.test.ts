import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ShellValidationRunner } from '../../src/core/shell-validation-runner.js'
import type { ValidationReport } from '../../src/types/validation-runner.js'
import { spawn } from 'node:child_process'

vi.mock('node:child_process')
vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    readFile: vi.fn(async () => JSON.stringify({ total: { lines: { pct: 90 } } })),
  }
})

describe('ShellValidationRunner', () => {
  let runner: ShellValidationRunner

  beforeEach(() => {
    runner = new ShellValidationRunner()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('run()', () => {
    it('should return a ValidationReport with results, passed, and timestamp fields', async () => {
      const mockProc = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (code: number | null) => void) => {
          if (event === 'close') setTimeout(() => callback(0), 0)
        }),
      }

      vi.mocked(spawn).mockReturnValue(mockProc as any)

      const report = await runner.run()

      expect(report).toHaveProperty('results')
      expect(report).toHaveProperty('passed')
      expect(report).toHaveProperty('timestamp')
      expect(Array.isArray(report.results)).toBe(true)
      expect(typeof report.passed).toBe('boolean')
    })

    it('should run all five quality checks', async () => {
      const mockProc = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (code: number | null) => void) => {
          if (event === 'close') setTimeout(() => callback(0), 0)
        }),
      }

      vi.mocked(spawn).mockReturnValue(mockProc as any)

      const report = await runner.run()

      // Should call spawn 5 times (eslint, tsc, vitest, c8, npm-audit) plus one for c8 readFile
      expect(report.results.length).toBeGreaterThanOrEqual(5)
    })

    it('should report passed=true when all checks pass', async () => {
      const mockProc = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (code: number | null) => void) => {
          if (event === 'close') setTimeout(() => callback(0), 0)
        }),
      }

      vi.mocked(spawn).mockReturnValue(mockProc as any)

      const report = await runner.run()

      expect(report.passed).toBe(true)
      expect(report.results.every((r) => r.passed)).toBe(true)
    })

    it('should report passed=false when any check fails', async () => {
      const mockProcPass = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (code: number | null) => void) => {
          if (event === 'close') setTimeout(() => callback(0), 0)
        }),
      }

      const mockProcFail = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (code: number | null) => void) => {
          if (event === 'close') setTimeout(() => callback(1), 0)
        }),
      }

      // First call passes, second fails
      vi.mocked(spawn).mockReturnValueOnce(mockProcPass as any)
      vi.mocked(spawn).mockReturnValueOnce(mockProcFail as any)

      const report = await runner.run()

      expect(report.passed).toBe(false)
    })
  })

  describe('runEslint()', () => {
    it('should spawn eslint with correct arguments', async () => {
      const mockProc = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (code: number | null) => void) => {
          if (event === 'close') setTimeout(() => callback(0), 0)
        }),
      }

      vi.mocked(spawn).mockReturnValue(mockProc as any)

      await runner.runEslint()

      expect(spawn).toHaveBeenCalledWith('eslint', ['src', '--max-warnings', '0', '--format', 'json'], expect.any(Object))
    })

    it('should mark as failed when exit code is non-zero', async () => {
      const mockProc = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (code: number | null) => void) => {
          if (event === 'close') setTimeout(() => callback(1), 0)
        }),
      }

      vi.mocked(spawn).mockReturnValue(mockProc as any)

      const result = await runner.runEslint()

      expect(result.passed).toBe(false)
      expect(result.exitCode).toBe(1)
    })
  })

  describe('runTsc()', () => {
    it('should spawn tsc with strict mode', async () => {
      const mockProc = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (code: number | null) => void) => {
          if (event === 'close') setTimeout(() => callback(0), 0)
        }),
      }

      vi.mocked(spawn).mockReturnValue(mockProc as any)

      await runner.runTsc()

      expect(spawn).toHaveBeenCalledWith('tsc', ['--strict', '--noEmit'], expect.any(Object))
    })
  })

  describe('runNpmAudit()', () => {
    it('should spawn npm audit with json format', async () => {
      const mockProc = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (code: number | null) => void) => {
          if (event === 'close') setTimeout(() => callback(0), 0)
        }),
      }

      vi.mocked(spawn).mockReturnValue(mockProc as any)

      await runner.runNpmAudit()

      expect(spawn).toHaveBeenCalledWith('npm', ['audit', '--json'], expect.any(Object))
    })
  })

  describe('error handling', () => {
    it('should not throw when tool is not found', async () => {
      const mockProc = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback?: (error?: Error) => void) => {
          if (event === 'error' && callback) {
            setTimeout(() => callback(new Error('ENOENT: command not found')), 0)
          }
        }),
      }

      vi.mocked(spawn).mockReturnValue(mockProc as any)

      const result = await runner.runEslint()

      expect(result.passed).toBe(false)
      expect(result.stderr).toContain('ENOENT')
    })

    it('should accumulate stdout and stderr from data events', async () => {
      const mockProc = {
        stdout: {
          on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
            if (event === 'data') cb(Buffer.from('eslint output'))
          }),
        },
        stderr: {
          on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
            if (event === 'data') cb(Buffer.from('eslint warning'))
          }),
        },
        on: vi.fn((event: string, callback: (code: number | null) => void) => {
          if (event === 'close') setTimeout(() => callback(0), 0)
        }),
      }

      vi.mocked(spawn).mockReturnValue(mockProc as any)

      const result = await runner.runEslint()

      expect(result.stdout).toContain('eslint output')
      expect(result.stderr).toContain('eslint warning')
      expect(result.passed).toBe(true)
    })

    it('should handle synchronous spawn failure via catch block', async () => {
      vi.mocked(spawn).mockImplementationOnce(() => {
        throw new Error('spawn failed synchronously')
      })

      const result = await runner.runEslint()

      expect(result.passed).toBe(false)
      expect(result.stderr).toContain('spawn failed synchronously')
    })
  })
})
