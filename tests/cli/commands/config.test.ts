import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../../../src/utils/config.js', () => ({
  findProjectRoot: vi.fn(),
  loadConfig: vi.fn(),
}))

const { registerConfigCommand } = await import('../../../src/cli/commands/config.js')

describe('Config Command', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exits when not in a Zeno project directory', async () => {
    const { findProjectRoot } = await import('../../../src/utils/config.js')
    vi.mocked(findProjectRoot).mockReturnValueOnce(null)

    const program = new Command()
    // Stub process.exit so test doesn't exit
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error('process.exit ' + code) }) as any)

    registerConfigCommand(program)

    try {
      await program.parseAsync(['node', 'test', 'config'])
    } catch (err: unknown) {
      // expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('prints specific key when --get matches', async () => {
    const { findProjectRoot, loadConfig } = await import('../../../src/utils/config.js')
    vi.mocked(findProjectRoot).mockReturnValueOnce('/project')
    vi.mocked(loadConfig).mockResolvedValueOnce({ a: { b: 'value' } } as any)

    const program = new Command()
    program.exitOverride()
    registerConfigCommand(program)

    await program.parseAsync(['node', 'test', 'config', '--get', 'a.b'])

    const { logger } = await import('../../../src/utils/logger.js')
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('a.b'))
  })

  it('prints JSON when ZENO_INTEGRATION is true', async () => {
    process.env['ZENO_INTEGRATION'] = 'true'

    const { findProjectRoot, loadConfig } = await import('../../../src/utils/config.js')
    vi.mocked(findProjectRoot).mockReturnValueOnce('/project')
    vi.mocked(loadConfig).mockResolvedValueOnce({ x: 1 } as any)

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const program = new Command()
    program.exitOverride()
    registerConfigCommand(program)

    await program.parseAsync(['node', 'test', 'config'])

    expect(logSpy).toHaveBeenCalled()

    logSpy.mockRestore()
    delete process.env['ZENO_INTEGRATION']
  })

  it('exits when requested key not found', async () => {
    const { findProjectRoot, loadConfig } = await import('../../../src/utils/config.js')
    vi.mocked(findProjectRoot).mockReturnValueOnce('/project')
    vi.mocked(loadConfig).mockResolvedValueOnce({} as any)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error('process.exit ' + code) }) as any)

    const program = new Command()
    registerConfigCommand(program)

    try {
      await program.parseAsync(['node', 'test', 'config', '--get', 'nope'])
    } catch (err: unknown) {
      // expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })
})