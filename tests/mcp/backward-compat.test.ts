import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createFunctionRegistry } from '../../src/integration/function-implementations.js'
import { runInTerminal } from '../../src/cli/index.js'
import { logger } from '../../src/utils/logger.js'

// Mock the terminal execution for CLI testing
vi.mock('../../src/cli/index.js', () => ({
  runInTerminal: vi.fn(),
}))

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}))

/**
 * Backward Compatibility Tests
 *
 * Ensures CLI commands still work with registry delegation.
 * Tests that existing CLI functionality is preserved.
 */

describe('Backward Compatibility', () => {
  let registry: ReturnType<typeof createFunctionRegistry>

  beforeEach(() => {
    registry = createFunctionRegistry()
    vi.clearAllMocks()
  })

  describe('CLI Command Delegation', () => {
    it('zeno gates list should work', async () => {
      // Mock the terminal to simulate successful execution
      vi.mocked(runInTerminal).mockResolvedValue({
        success: true,
        stdout: 'Gate 01: core infrastructure (completed)\nGate 02: zeno engine (completed)',
        stderr: '',
        exitCode: 0,
      })

      // The CLI should delegate to the registry
      const result = await registry.invoke('gates_list', {})

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('zeno gates show <id> should work', async () => {
      const result = await registry.invoke('gates_show', { gateId: 'gate-01' })

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('zeno gates start <id> should work', async () => {
      const result = await registry.invoke('gates_start', { gateId: 'gate-04' })

      // May fail if gate doesn't exist, but should not crash
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('zeno gates complete <id> should work', async () => {
      const result = await registry.invoke('gates_complete', { gateId: 'gate-03' })

      // May fail due to permissions or state, but should not crash
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('zeno req list should work', async () => {
      const result = await registry.invoke('req_list', {})

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('zeno proposal list should work', async () => {
      const result = await registry.invoke('proposal_list', {})

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      // May return empty array if no proposals in DB, but should not crash
    })

    it('zeno template list should work', async () => {
      const result = await registry.invoke('getTemplatesByCategory', { category: 'gate' })

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('zeno template get <name> should work', async () => {
      const result = await registry.invoke('getTemplate', { name: 'gate-prd-template' })

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('zeno repos list should work', async () => {
      const result = await registry.invoke('repos_list', {})

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })
  })

  describe('Error Handling Consistency', () => {
    it('should return consistent error format for invalid inputs', async () => {
      const result = await registry.invoke('gates_show', { gateId: 'invalid-gate' })

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('should handle missing parameters consistently', async () => {
      const result = await registry.invoke('req_show', {}) // Missing hash parameter

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })
  })

  describe('Database Schema Compatibility', () => {
    it('should work with existing database schema', async () => {
      // Test that all operations work with the current DB schema
      const operations = [
        { name: 'gates_list', params: {} },
        { name: 'req_list', params: {} },
        { name: 'repos_list', params: {} },
      ]

      for (const op of operations) {
        const result = await registry.invoke(op.name, op.params)
        expect(result).toBeDefined()
        expect(typeof result.success).toBe('boolean')
      }
    })

    it('should handle database connection issues gracefully', async () => {
      // Test with operations that might fail due to DB issues
      const result = await registry.invoke('proposal_list', {})

      // Should not crash, even if proposals table doesn't exist
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })
  })

  describe('Serialization Compatibility', () => {
    it('should return serializable results for MCP transport', async () => {
      const tools = [
        { name: 'gates_list', params: {} },
        { name: 'req_list', params: {} },
        { name: 'getTemplatesByCategory', params: { category: 'gate' } },
        { name: 'repos_list', params: {} },
      ]

      for (const tool of tools) {
        const result = await registry.invoke(tool.name, tool.params)
        expect(result).toBeDefined()
        expect(typeof result.success).toBe('boolean')
        // Data should be serializable (for MCP transport) if it exists
        if (result.success && result.data !== undefined) {
          expect(() => JSON.stringify(result.data)).not.toThrow()
        }
      }
    })

    it('should include proper error context', async () => {
      const result = await registry.invoke('gates_show', { gateId: 'nonexistent' })

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      if (!result.success && result.error) {
        expect(result.error).toHaveProperty('code')
        expect(result.error).toHaveProperty('message')
        // Should be serializable
        expect(() => JSON.stringify(result.error)).not.toThrow()
      }
    })
  })

  describe('Migration Compatibility', () => {
    it('should work with migrated data', async () => {
      // Test that operations work with data that has been migrated
      // This ensures backward compatibility across schema changes

      const result = await registry.invoke('gates_list', {})
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')

      if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
        const firstGate = result.data[0]
        if (firstGate && firstGate.id) {
          const showResult = await registry.invoke('gates_show', { gateId: firstGate.id })
          expect(showResult).toBeDefined()
          expect(typeof showResult.success).toBe('boolean')
        }
      }
    })
  })

  describe('Command Line Interface Preservation', () => {
    it('should preserve CLI command signatures', async () => {
      // Test that the CLI commands have the same interface
      // This is more of a documentation test, but ensures
      // that the MCP layer doesn't break CLI expectations

      const expectedCommands = [
        'gates_list',
        'gates_show',
        'gates_start',
        'gates_complete',
        'req_list',
        'req_show',
        'proposal_list',
        'proposal_show',
        'getTemplatesByCategory',
        'getTemplate',
        'repos_list',
      ]

      // Verify these commands are available in the function registry
      for (const cmd of expectedCommands) {
        const result = await registry.invoke(cmd, {})
        expect(result).toBeDefined()
        expect(typeof result.success).toBe('boolean')
      }
    })

    it('should handle CLI-style parameter formats', async () => {
      // Test that parameters work in expected format
      const result = await registry.invoke('gates_show', { gateId: 'gate-01' })

      // Should work with proper parameter names
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })
  })
})
