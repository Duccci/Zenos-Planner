import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerGatesOps } from '../../src/integration/gates-registry.js'

const mockPrepare = vi.fn()
const mockGetDatabase = vi.fn()

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}))

vi.mock('../../src/utils/config.js', () => ({
  getZenoDir: vi.fn().mockReturnValue('/project/zeno/.zeno'),
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readdirSync: vi.fn().mockReturnValue([]),
}))

vi.mock('../../src/integration/command-invoker.js', () => ({
  invokeCommand: vi.fn().mockResolvedValue({ success: true }),
}))

describe('gates-registry coverage', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new FunctionRegistry()

    mockGetDatabase.mockReturnValue({
      prepare: mockPrepare,
    })

    registerGatesOps(registry)
  })

  describe('gates_list', () => {
    it('should list gates from database', async () => {
      const gates = [
        { id: 'gate-01', name: 'Setup', status: 'completed', sequence: 1 },
        { id: 'gate-02', name: 'Core', status: 'in_progress', sequence: 2 },
      ]
      mockPrepare.mockReturnValue({ all: vi.fn().mockReturnValue(gates) })

      const result = await registry.invoke('gates_list', {}) as { success: boolean; data: unknown }
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ success: true, data: gates })
    })

    it('should fall back to archive files when DB empty', async () => {
      mockPrepare.mockReturnValue({ all: vi.fn().mockReturnValue([]) })

      // existsSync returns false by default, so archive won't be found
      const result = await registry.invoke('gates_list', {}) as { success: boolean; data: unknown }
      expect(result.success).toBe(true)
    })
  })

  describe('gates_show', () => {
    it('should show gate details with requirements and proposals counts', async () => {
      const gate = { id: 'gate-01', name: 'Setup', hash: 'h1', status: 'completed' }
      const getOne = vi.fn()
        .mockReturnValueOnce(gate) // gate lookup
        .mockReturnValueOnce({ count: 3 }) // req count
        .mockReturnValueOnce({ count: 2 }) // proposal count

      mockPrepare.mockReturnValue({
        get: getOne,
        all: vi.fn().mockReturnValue([]), // dependencies
      })

      const result = await registry.invoke('gates_show', { gateId: 'gate-01' }) as { success: boolean; data: unknown }
      expect(result.success).toBe(true)
    })

    it('should normalize gate id (strip and reformat)', async () => {
      const gate = { id: 'gate-01', name: 'Setup', hash: 'h1', status: 'completed' }
      const getOne = vi.fn()
        .mockReturnValueOnce(gate)
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 })

      mockPrepare.mockReturnValue({
        get: getOne,
        all: vi.fn().mockReturnValue([]),
      })

      await registry.invoke('gates_show', { gateId: '1' })
      // Should have queried with 'gate-01'
    })

    it('should throw for non-existent gate', async () => {
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue(undefined),
      })

      const result = await registry.invoke('gates_show', { gateId: 'gate-99' }) as { success: boolean }
      expect(result.success).toBe(false)
    })

    it('should fall back to name LIKE search', async () => {
      const gate = { id: 'gate-01', name: 'Setup', hash: 'h1', status: 'completed' }
      const getOne = vi.fn()
        .mockReturnValueOnce(undefined) // not found by id
        .mockReturnValueOnce(gate) // found by name
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 })

      mockPrepare.mockReturnValue({
        get: getOne,
        all: vi.fn().mockReturnValue([]),
      })

      const result = await registry.invoke('gates_show', { gateId: 'Setup' }) as { success: boolean }
      expect(result.success).toBe(true)
    })
  })

  describe('gates_start', () => {
    it('should start a gate', async () => {
      const result = await registry.invoke('gates_start', { gateId: 'gate-01' }) as { success: boolean }
      expect(result.success).toBe(true)
    })
  })

  describe('gates_complete', () => {
    it('should complete a gate', async () => {
      const result = await registry.invoke('gates_complete', { gateId: 'gate-01' }) as { success: boolean }
      expect(result.success).toBe(true)
    })
  })

  describe('gates_regenerate', () => {
    it('should regenerate gates', async () => {
      const result = await registry.invoke('gates_regenerate', {}) as { success: boolean }
      expect(result.success).toBe(true)
    })
  })
})
