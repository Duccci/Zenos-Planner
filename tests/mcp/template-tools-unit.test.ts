import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { architectureHandlers } from '../../src/mcp/tools/architecture-tools.js'
import type { FunctionRegistry } from '../../src/integration/function-registry.js'

const mockGetTemplates = vi.fn()
const mockGetArtifact = vi.fn()

vi.mock('../../src/generation/artifact-discovery-service.js', () => ({
  createDiscoveryService: vi.fn().mockReturnValue({
    getTemplates: (...args: unknown[]) => mockGetTemplates(...args),
    getArtifact: (...args: unknown[]) => mockGetArtifact(...args),
  }),
}))

describe('diagram_action template coverage', () => {
  let handlers: Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>>

  beforeEach(() => {
    vi.clearAllMocks()
    const mockRegistry = {} as FunctionRegistry
    handlers = architectureHandlers(mockRegistry)
  })

  describe('diagram_action: list_template', () => {
    it('should list templates', async () => {
      mockGetTemplates.mockResolvedValue([
        {
          name: 'gate-prd-template',
          shortName: 'gate-prd',
          path: '/templates/gate-prd-template.md',
          description: 'Gate PRD template',
          category: 'markdown',
        },
      ])

      const result = await handlers['diagram_action']!({ action: 'list_template' })
      expect(result.isError).toBeFalsy()
      expect(result.content).toBeDefined()
      const text = (result.content[0] as any)?.text as string
      expect(text).toContain('templates')
      expect(text).toContain('gate-prd')
    })

    it('should handle errors', async () => {
      mockGetTemplates.mockRejectedValue(new Error('discovery failed'))

      const result = await handlers['diagram_action']!({ action: 'list_template' })
      expect(result.isError).toBe(true)
    })
  })

  describe('diagram_action: get_template', () => {
    it('should get a template by name', async () => {
      mockGetArtifact.mockResolvedValue({
        name: 'gate-prd',
        shortName: 'gate-prd',
        path: '/templates/gate-prd-template.md',
        description: 'Gate PRD template',
        category: 'markdown',
        content: '# Template',
      })

      const result = await handlers['diagram_action']!({ action: 'get_template', name: 'gate-prd' })
      expect(result.isError).toBeFalsy()
      const text = (result.content[0] as any)?.text as string
      expect(text).toContain('"name"')
      expect(text).toContain('gate-prd')
    })

    it('should return error for missing name', async () => {
      const result = await handlers['diagram_action']!({ action: 'get_template' })
      expect(result.isError).toBe(true)
    })

    it('should return error for empty name', async () => {
      const result = await handlers['diagram_action']!({ action: 'get_template', name: '' })
      expect(result.isError).toBe(true)
    })

    it('should return not found for unknown template', async () => {
      mockGetArtifact.mockResolvedValue(null)

      const result = await handlers['diagram_action']!({ action: 'get_template', name: 'nonexistent' })
      expect(result.isError).toBe(true)
    })

    it('should include context when requested', async () => {
      mockGetArtifact.mockResolvedValue({
        name: 'gate-prd',
        shortName: 'gate-prd',
        path: '/templates/gate-prd-template.md',
        description: 'Gate PRD template',
        category: 'markdown',
        content: '# Template',
      })

      const result = await handlers['diagram_action']!({
        action: 'get_template',
        name: 'gate-prd',
        includeContext: true,
      })
      expect(result.isError).toBeFalsy()
      const text = (result.content[0] as any)?.text as string
      expect(text).toContain('"_context"')
      expect(text).toContain('retrievedAt')
    })

    it('should handle includeContext as string "true"', async () => {
      mockGetArtifact.mockResolvedValue({
        name: 'gate-prd',
        shortName: 'gate-prd',
        path: '/templates/gate-prd-template.md',
        description: 'Gate PRD template',
        category: 'markdown',
        content: '# Template',
      })

      const result = await handlers['diagram_action']!({
        action: 'get_template',
        name: 'gate-prd',
        includeContext: 'true',
      })
      expect(result.isError).toBeFalsy()
      const text = (result.content[0] as any)?.text as string
      expect(text).toContain('"_context"')
    })

    it('should handle get errors', async () => {
      mockGetArtifact.mockRejectedValue(new Error('read error'))

      const result = await handlers['diagram_action']!({ action: 'get_template', name: 'gate-prd' })
      expect(result.isError).toBe(true)
    })
  })

  describe('diagram_action: unknown action', () => {
    it('should return error for unknown action', async () => {
      const result = await handlers['diagram_action']!({ action: 'unknown' })
      expect(result.isError).toBe(true)
    })
  })
})
