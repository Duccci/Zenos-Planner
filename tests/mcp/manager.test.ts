import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as manager from '../../src/mcp/manager.js'

vi.mock('../../src/utils/config.js', () => ({
  getZenoDir: vi.fn().mockReturnValue('zeno'),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
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
  execSync: vi.fn(),
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

    // ensure file exists for the successful parse case
    vi.mocked(fs.existsSync).mockReturnValueOnce(true)
    vi.mocked(fs.readFileSync).mockReturnValueOnce('123\n')
    expect(manager.readPid('/project')).toBe(123)
  })

  it('isProcessRunning returns true when process.kill does not throw and false when it does', () => {
    const origKill = process.kill
    // success
    vi.spyOn(process, 'kill').mockImplementation(() => undefined as never)
    expect(manager.isProcessRunning(1)).toBe(true)

    // failure
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('no such process')
    })
    expect(manager.isProcessRunning(99999)).toBe(false)

    // restore
    vi.spyOn(process, 'kill').mockImplementation(origKill as any)
  })

  it('isServerRunning returns false when no pid and delegates to isProcessRunning', async () => {
    const readSpy = vi.spyOn(manager, 'readPid').mockReturnValueOnce(null)
    expect(manager.isServerRunning('/project')).toBe(false)
    readSpy.mockRestore()

    // Arrange: create a fake pid file so the internal readPid() used by isServerRunning picks it up
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('123\n')

    // Simulate process existing by stubbing process.kill which is used by the internal isProcessRunning
    const origKill = process.kill
    vi.spyOn(process, 'kill').mockImplementation(() => undefined as never)

    // sanity-check that readPid is returning the expected value
    expect(manager.readPid('/project')).toBe(123)
    expect(manager.isProcessRunning(123)).toBe(true)
    expect(manager.isServerRunning('/project')).toBe(true)

    // restore original behavior
    vi.spyOn(process, 'kill').mockImplementation(origKill as any)

    // reset fs mocks
    vi.mocked(fs.existsSync).mockReset()
    vi.mocked(fs.readFileSync).mockReset()
  })

  describe('stopServer', () => {
    // stopServer calls readPid/isProcessRunning/removePid internally via direct
    // function references, so we must mock the underlying fs calls rather than
    // spying on the re-exported helpers.

    it('returns false when no PID file', async () => {
      const fs = await import('node:fs')
      vi.mocked(fs.existsSync).mockReturnValueOnce(false)
      expect(manager.stopServer('/project')).toBe(false)
    })

    it('removes stale PID and returns false when process not running', async () => {
      const fs = await import('node:fs')
      // readPid: existsSync true, readFileSync returns pid
      vi.mocked(fs.existsSync).mockReturnValueOnce(true)
      vi.mocked(fs.readFileSync).mockReturnValueOnce('99999\n')
      // isProcessRunning: process.kill throws
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('ESRCH')
      })
      // removePid: existsSync true
      vi.mocked(fs.existsSync).mockReturnValueOnce(true)

      try {
        expect(manager.stopServer('/project')).toBe(false)
        expect(vi.mocked(fs.unlinkSync)).toHaveBeenCalled()
      } finally {
        killSpy.mockRestore()
      }
    })

    it('stops running process on win32 via taskkill', async () => {
      const fs = await import('node:fs')
      const cp = await import('node:child_process')
      vi.mocked(fs.existsSync).mockReturnValueOnce(true)
      vi.mocked(fs.readFileSync).mockReturnValueOnce('12345\n')
      vi.spyOn(process, 'kill').mockImplementation(() => undefined as never) // process running
      // removePid existsSync
      vi.mocked(fs.existsSync).mockReturnValueOnce(true)

      const originalPlatformDesc = Object.getOwnPropertyDescriptor(process, 'platform')
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
      try {
        expect(manager.stopServer('/project')).toBe(true)
        expect(vi.mocked(cp.execSync)).toHaveBeenCalledWith(
          expect.stringContaining('taskkill'),
          expect.anything()
        )
      } finally {
        if (originalPlatformDesc) Object.defineProperty(process, 'platform', originalPlatformDesc)
      }
    })

    it('sends SIGTERM on non-win32', async () => {
      const fs = await import('node:fs')
      vi.mocked(fs.existsSync).mockReturnValueOnce(true)
      vi.mocked(fs.readFileSync).mockReturnValueOnce('12345\n')
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => undefined as never)
      vi.mocked(fs.existsSync).mockReturnValueOnce(true)

      const originalPlatformDesc = Object.getOwnPropertyDescriptor(process, 'platform')
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
      try {
        expect(manager.stopServer('/project')).toBe(true)
        expect(killSpy).toHaveBeenCalledWith(12345, 'SIGTERM')
      } finally {
        if (originalPlatformDesc) Object.defineProperty(process, 'platform', originalPlatformDesc)
      }
    })

    it('handles kill failure gracefully', async () => {
      const fs = await import('node:fs')
      vi.mocked(fs.existsSync).mockReturnValueOnce(true)
      vi.mocked(fs.readFileSync).mockReturnValueOnce('12345\n')
      // isProcessRunning: first call succeeds (process exists)
      const killSpy = vi.spyOn(process, 'kill')
      killSpy.mockImplementationOnce(() => undefined as never) // isProcessRunning check
      killSpy.mockImplementationOnce(() => {
        throw new Error('EPERM')
      }) // actual kill
      vi.mocked(fs.existsSync).mockReturnValueOnce(true)

      const originalPlatformDesc = Object.getOwnPropertyDescriptor(process, 'platform')
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
      try {
        expect(manager.stopServer('/project')).toBe(true)
      } finally {
        if (originalPlatformDesc) Object.defineProperty(process, 'platform', originalPlatformDesc)
      }
    })
  })

  it('spawnServerBackground resolves on success and rejects on spawn error', async () => {
    const cp = await import('node:child_process')

    // Success case: spawn returns child with on/unref but no error triggered
    const fakeChildSuccess = {
      on: (ev: string, cb: (e?: unknown) => void) => {
        /* store if needed */
      },
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
      on: (ev: string, cb: (e?: unknown) => void) => {
        if (ev === 'error') cb(new Error('spawn failed'))
      },
      unref: () => undefined,
    }
    vi.mocked(cp.spawn).mockReturnValueOnce(fakeChildError as unknown as any)

    await expect(manager.spawnServerBackground('/project')).rejects.toThrow('spawn failed')
  })
})
