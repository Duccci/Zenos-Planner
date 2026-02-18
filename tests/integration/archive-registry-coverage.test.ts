import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerArchiveOps } from '../../src/integration/archive-registry.js'

vi.mock('../../src/core/archive-logic.js', () => ({
  archiveGate: vi.fn().mockResolvedValue({ archived: true, gateId: 'gate-01' }),
  archiveBatch: vi.fn().mockResolvedValue({ archived: true, count: 2 }),
}))

describe('archive-registry coverage', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new FunctionRegistry()
    registerArchiveOps(registry)
  })

  it('should register archive_action', () => {
    const tools = registry.list()
    expect(tools.some((t) => t.name === 'archive_action')).toBe(true)
  })

  it('should handle gate action', async () => {
    const result = await registry.invoke('archive_action', {
      action: 'gate',
      payload: { gateId: 'gate-01', completionNotes: 'Done' },
    }) as { success: boolean; data: unknown }

    // invoke() wraps the function return in { success, data }
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ archived: true, gateId: 'gate-01' })
  })

  it('should handle gate action with empty payload defaults', async () => {
    // payload defaults to {} which is parsed by zod; gateId is required string
    const result = await registry.invoke('archive_action', {
      action: 'gate',
    }) as { success: boolean; data: unknown }

    // Zod parse of {} fails because gateId is required
    expect(result.success).toBe(false)
  })

  it('should handle batch action', async () => {
    const result = await registry.invoke('archive_action', {
      action: 'batch',
      payload: {
        artifacts: [
          { type: 'gate', gateId: 'gate-01' },
          { type: 'gate', gateId: 'gate-02' },
        ],
        completionNotes: 'All done',
      },
    }) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ archived: true, count: 2 })
  })

  it('should handle unknown action', async () => {
    const result = await registry.invoke('archive_action', {
      action: 'unknown_action',
    }) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      success: false,
      error: {
        message: 'Unknown archive_action: unknown_action',
        code: 'UNKNOWN_ACTION',
      },
    })
  })
})
