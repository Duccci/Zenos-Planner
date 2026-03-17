import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import { ShellValidationRunner } from '../../src/core/shell-validation-runner.js'

vi.mock('node:child_process')
vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    readFile: vi.fn(async () => JSON.stringify({ total: { lines: { pct: 90 } } })),
  }
})

// ─── helpers ─────────────────────────────────────────────────────────────────

function mockSpawn(exitCode: number) {
  return {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, cb: (code: number | null) => void) => {
      if (event === 'close') setTimeout(() => cb(exitCode), 0)
    }),
  }
}

function mockSpawnError(code: string) {
  return {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, cb: ((code: number | null) => void) | ((err: Error) => void)) => {
      if (event === 'error') {
        const err = Object.assign(new Error('spawn failed'), { code })
        setTimeout(() => (cb as (err: Error) => void)(err), 0)
      }
    }),
  }
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('ShellValidationRunner (integration)', () => {
  let runner: ShellValidationRunner

  beforeEach(() => {
    runner = new ShellValidationRunner()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── run() ─────────────────────────────────────────────────────────────────

  describe('run()', () => {
    it('returns ValidationReport with passed:true when all simulated exits are 0', async () => {
      vi.mocked(spawn).mockImplementation(() => mockSpawn(0) as any)

      const report = await runner.run()

      expect(report.passed).toBe(true)
      expect(report.results.every((r) => r.passed)).toBe(true)
      expect(report.results.length).toBeGreaterThanOrEqual(4)
      expect(typeof report.timestamp).toBe('string')
    })

    it('returns passed:false when any simulated exit is non-zero', async () => {
      vi.mocked(spawn)
        .mockImplementationOnce(() => mockSpawn(0) as any) // eslint passes
        .mockImplementationOnce(() => mockSpawn(1) as any) // tsc fails
        .mockImplementation(() => mockSpawn(0) as any)

      const report = await runner.run()

      expect(report.passed).toBe(false)
    })

    it('sets passed:false without throwing when spawn emits ENOENT', async () => {
      vi.mocked(spawn).mockImplementation(() => mockSpawnError('ENOENT') as any)

      const report = await runner.run()

      expect(report.passed).toBe(false)
    })
  })

  // ─── individual tools ──────────────────────────────────────────────────────

  describe('runEslint()', () => {
    it('returns passed:true when eslint exits 0', async () => {
      vi.mocked(spawn).mockReturnValueOnce(mockSpawn(0) as any)

      const result = await runner.runEslint()

      expect(result.tool).toBe('eslint')
      expect(result.passed).toBe(true)
      expect(result.exitCode).toBe(0)
    })

    it('returns passed:false when eslint exits non-zero', async () => {
      vi.mocked(spawn).mockReturnValueOnce(mockSpawn(1) as any)

      const result = await runner.runEslint()

      expect(result.passed).toBe(false)
    })
  })

  describe('runTsc()', () => {
    it('returns passed:true when tsc exits 0', async () => {
      vi.mocked(spawn).mockReturnValueOnce(mockSpawn(0) as any)

      const result = await runner.runTsc()

      expect(result.tool).toBe('tsc')
      expect(result.passed).toBe(true)
    })

    it('returns passed:false when tsc exits non-zero', async () => {
      vi.mocked(spawn).mockReturnValueOnce(mockSpawn(2) as any)

      const result = await runner.runTsc()

      expect(result.passed).toBe(false)
      expect(result.exitCode).toBe(2)
    })
  })

  describe('runVitest()', () => {
    it('returns passed:true when vitest exits 0', async () => {
      vi.mocked(spawn).mockReturnValueOnce(mockSpawn(0) as any)

      const result = await runner.runVitest()

      expect(result.tool).toBe('vitest')
      expect(result.passed).toBe(true)
    })

    it('returns passed:false when vitest exits non-zero', async () => {
      vi.mocked(spawn).mockReturnValueOnce(mockSpawn(1) as any)

      const result = await runner.runVitest()

      expect(result.passed).toBe(false)
    })
  })

  describe('runC8()', () => {
    it('returns passed:true when coverage summary file is readable', async () => {
      const { readFile } = await import('node:fs/promises')
      vi.mocked(readFile).mockResolvedValueOnce(
        JSON.stringify({ total: { lines: { pct: 91 } } }) as any,
      )

      const result = await runner.runC8()

      expect(result.tool).toBe('c8')
      expect(result.passed).toBe(true)
    })

    it('returns passed:false when coverage summary file is not found', async () => {
      const { readFile } = await import('node:fs/promises')
      vi.mocked(readFile).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
      )

      const result = await runner.runC8()

      expect(result.tool).toBe('c8')
      expect(result.passed).toBe(false)
    })
  })

  describe('runNpmAudit()', () => {
    it('returns passed:true when npm audit exits 0', async () => {
      vi.mocked(spawn).mockReturnValueOnce(mockSpawn(0) as any)

      const result = await runner.runNpmAudit()

      expect(result.tool).toBe('npm-audit')
      expect(result.passed).toBe(true)
    })

    it('returns passed:false when npm audit exits non-zero', async () => {
      vi.mocked(spawn).mockReturnValueOnce(mockSpawn(1) as any)

      const result = await runner.runNpmAudit()

      expect(result.passed).toBe(false)
    })
  })
})
