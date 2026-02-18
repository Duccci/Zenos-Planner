import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Capture the watch callback so we can trigger it manually
let watchCallback: ((evt: string, filename: string | null) => void) | null = null
const mockWatcher = {
  close: vi.fn(),
}

vi.mock('node:fs', () => ({
  watch: vi.fn((_dir: string, _opts: unknown, cb: (evt: string, filename: string | null) => void) => {
    watchCallback = cb
    return mockWatcher
  }),
}))

import { enableDevMode } from '../../src/mcp/dev-mode.js'

describe('Dev mode', () => {
  beforeEach(() => {
    watchCallback = null
    mockWatcher.close.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returned object has close() method that calls watcher.close()', () => {
    const onRestart = vi.fn().mockResolvedValue(undefined)
    const handle = enableDevMode({ watchPattern: 'src/**/*.ts', debounceMs: 100, onRestart })
    expect(typeof handle.close).toBe('function')
    handle.close()
    expect(mockWatcher.close).toHaveBeenCalledOnce()
  })

  it('invokes onRestart after debounce when a .ts file changes', async () => {
    const onRestart = vi.fn().mockResolvedValue(undefined)
    enableDevMode({ debounceMs: 100, onRestart })

    // Trigger watcher callback with a .ts file
    expect(watchCallback).not.toBeNull()
    watchCallback!('change', 'some-file.ts')

    // Advance fake timers past the debounce
    await vi.runAllTimersAsync()

    expect(onRestart).toHaveBeenCalledWith('some-file.ts')
  })

  it('ignores non-.ts files', async () => {
    const onRestart = vi.fn().mockResolvedValue(undefined)
    enableDevMode({ debounceMs: 100, onRestart })

    watchCallback!('change', 'README.md')
    await vi.runAllTimersAsync()

    expect(onRestart).not.toHaveBeenCalled()
  })

  it('ignores events where filename is null', async () => {
    const onRestart = vi.fn().mockResolvedValue(undefined)
    enableDevMode({ debounceMs: 100, onRestart })

    watchCallback!('change', null)
    await vi.runAllTimersAsync()

    expect(onRestart).not.toHaveBeenCalled()
  })

  it('debounces repeated events (calls onRestart only once)', async () => {
    const onRestart = vi.fn().mockResolvedValue(undefined)
    enableDevMode({ debounceMs: 200, onRestart })

    watchCallback!('change', 'a.ts')
    watchCallback!('change', 'b.ts')
    watchCallback!('change', 'c.ts')

    await vi.runAllTimersAsync()

    expect(onRestart).toHaveBeenCalledOnce()
    expect(onRestart).toHaveBeenCalledWith('c.ts')
  })

  it('uses defaults when options not provided', () => {
    const onRestart = vi.fn().mockResolvedValue(undefined)
    // No watchPattern or debounceMs provided - uses defaults
    enableDevMode({ onRestart })
    expect(watchCallback).not.toBeNull()
  })

  it('swallows errors thrown by onRestart', async () => {
    const onRestart = vi.fn().mockRejectedValue(new Error('restart failed'))
    enableDevMode({ debounceMs: 10, onRestart })

    watchCallback!('change', 'error.ts')
    // Should not throw
    await expect(vi.runAllTimersAsync()).resolves.not.toThrow()
  })

  it('close() does not throw when watcher.close() throws', () => {
    const onRestart = vi.fn()
    mockWatcher.close.mockImplementationOnce(() => { throw new Error('close error') })
    const handle = enableDevMode({ onRestart })
    expect(() => handle.close()).not.toThrow()
  })
})