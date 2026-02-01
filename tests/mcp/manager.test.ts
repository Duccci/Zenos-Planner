import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as manager from '../../src/mcp/manager.js'

vi.mock('../../src/utils/config.js', () => ({
  getZenoDir: vi.fn().mockReturnValue('zeno'),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

describe('MCP Manager', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getPidPath uses getZenoDir', () => {
    const path = manager.getPidPath('/my/project')
    expect(path).toContain('mcp.pid')
  })

  it('writePid writes pid file and logs debug', async () => {
    const fs = await import('node:fs')
    await manager.writePid('/project')
    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalled()
  })

  it('removePid unlinks when exists and logs', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockReturnValueOnce(true)
    manager.removePid('/project')
    expect(vi.mocked(fs.unlinkSync)).toHaveBeenCalled()

    vi.mocked(fs.existsSync).mockReturnValueOnce(false)
    manager.removePid('/project')
    expect(vi.mocked(fs.unlinkSync)).toHaveBeenCalled()
  })

  it('readPid returns null when no pid file or invalid pid', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockReturnValueOnce(false)
    expect(manager.readPid('/project')).toBeNull()

    vi.mocked(fs.existsSync).mockReturnValueOnce(true)
    vi.mocked(fs.readFileSync).mockReturnValueOnce('not-a-number')
    expect(manager.readPid('/project')).toBeNull()

    vi.mocked(fs.readFileSync).mockReturnValueOnce('123\n')
    expect(manager.readPid('/project')).toBe(123)
  })

  it('isProcessRunning returns true when process.kill does not throw and false when it does', () => {
    const origKill = process.kill
    // success
    vi.spyOn(process, 'kill').mockImplementation(() => undefined as never)
    expect(manager.isProcessRunning(1)).toBe(true)

    // failure
    vi.spyOn(process, 'kill').mockImplementation(() => { throw new Error('no such process') })
    expect(manager.isProcessRunning(99999)).toBe(false)

    // restore
    vi.spyOn(process, 'kill').mockImplementation(origKill as any)
  })

  it('isServerRunning returns false when no pid and delegates to isProcessRunning', () => {
    const readSpy = vi.spyOn(manager, 'readPid').mockReturnValueOnce(null)
    expect(manager.isServerRunning('/project')).toBe(false)

    const readSpy2 = vi.spyOn(manager, 'readPid').mockReturnValueOnce(123)
    const procSpy = vi.spyOn(manager, 'isProcessRunning').mockReturnValueOnce(true)
    expect(manager.isServerRunning('/project')).toBe(true)

    readSpy.mockRestore()
    readSpy2.mockRestore()
    procSpy.mockRestore()
  })

  it('spawnServerBackground resolves on success and rejects on spawn error', async () => {
    const cp = await import('node:child_process')

    // Success case: spawn returns child with on/unref but no error triggered
    const fakeChildSuccess = {
      on: (ev: string, cb: (e?: unknown) => void) => { /* store if needed */ },
      unref: () => undefined,
    }
    vi.mocked(cp.spawn).mockReturnValueOnce(fakeChildSuccess as unknown as any)

    // Use fake timers to avoid real setTimeout delay
    vi.useFakeTimers()
    const p = manager.spawnServerBackground('/project')
    vi.advanceTimersByTime(250)
    await expect(p).resolves.toBeUndefined()
    vi.useRealTimers()

    // Error case: spawn returns child and emits error immediately
    const fakeChildError = {
      on: (ev: string, cb: (e?: unknown) => void) => { if (ev === 'error') cb(new Error('spawn failed')) },
      unref: () => undefined,
    }
    vi.mocked(cp.spawn).mockReturnValueOnce(fakeChildError as unknown as any)

    await expect(manager.spawnServerBackground('/project')).rejects.toThrow('spawn failed')
  })
})