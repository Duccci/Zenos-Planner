import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { templateHandlers } from '../../src/mcp/tools/template-tools.js'
import type { FunctionRegistry } from '../../src/integration/function-registry.js'

const mockGetTemplates = vi.fn()
const mockGetArtifact = vi.fn()

vi.mock('../../src/generation/artifact-discovery-service.js', () => ({
  createDiscoveryService: vi.fn().mockReturnValue({
    getTemplates: (...args: unknown[]) => mockGetTemplates(...args),
    getArtifact: (...args: unknown[]) => mockGetArtifact(...args),
  }),
}))

describe('template-tools coverage', () => {
  let handlers: Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>>

  beforeEach(() => {
    vi.clearAllMocks()
    const mockRegistry = {} as FunctionRegistry
    handlers = templateHandlers(mockRegistry)
  })

  describe('template_action: list', () => {
    it('should list templates', async () => {
      mockGetTemplates.mockResolvedValue([{ name: 'gate-prd', path: '/templates/gate.md' }])

      const result = await handlers['template_action']!({ action: 'list' })
      expect(result.isError).toBeUndefined()
      expect(result.content).toBeDefined()
    })

    it('should handle errors', async () => {
      mockGetTemplates.mockRejectedValue(new Error('discovery failed'))

      const result = await handlers['template_action']!({ action: 'list' })
      expect(result.isError).toBe(true)
    })
  })

  describe('template_action: get', () => {
    it('should get a template by name', async () => {
      mockGetArtifact.mockResolvedValue({ name: 'gate-prd', content: '# Template' })

      const result = await handlers['template_action']!({ action: 'get', name: 'gate-prd' })
      expect(result.isError).toBeUndefined()
    })

    it('should return error for missing name', async () => {
      const result = await handlers['template_action']!({ action: 'get' })
      expect(result.isError).toBe(true)
    })

    it('should return error for empty name', async () => {
      const result = await handlers['template_action']!({ action: 'get', name: '' })
      expect(result.isError).toBe(true)
    })

    it('should return not found for unknown template', async () => {
      mockGetArtifact.mockResolvedValue(null)

      const result = await handlers['template_action']!({ action: 'get', name: 'nonexistent' })
      expect(result.isError).toBe(true)
    })

    it('should include context when requested', async () => {
      mockGetArtifact.mockResolvedValue({ name: 'gate-prd', content: '# Template' })

      const result = await handlers['template_action']!({
        action: 'get',
        name: 'gate-prd',
        includeContext: true,
      })
      expect(result.isError).toBeUndefined()
      expect(result.content[0]?.text as string).toContain('Name: gate-prd')
    })

    it('should handle includeContext as string "true"', async () => {
      mockGetArtifact.mockResolvedValue({ name: 'gate-prd', content: '# Template' })

      const result = await handlers['template_action']!({
        action: 'get',
        name: 'gate-prd',
        includeContext: 'true',
      })
      expect(result.isError).toBeUndefined()
      expect(result.content[0]?.text as string).toContain('Name: gate-prd')
    })

    it('should handle get errors', async () => {
      mockGetArtifact.mockRejectedValue(new Error('read error'))

      const result = await handlers['template_action']!({ action: 'get', name: 'gate-prd' })
      expect(result.isError).toBe(true)
    })
  })

  describe('template_action: unknown action', () => {
    it('should return error for unknown action', async () => {
      const result = await handlers['template_action']!({ action: 'unknown' })
      expect(result.isError).toBe(true)
    })
  })
})
