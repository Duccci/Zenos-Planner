import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import {
  DiagramActionInputSchema,
  DiagramActionOutputSchema,
  getDiagramActionOutputSchema,
  ArchDiagramRenderOutputSchema,
} from '../schemas/architecture-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'
import { createDiscoveryService } from '../../generation/artifact-discovery-service.js'

const discovery = createDiscoveryService(process.cwd())

/**
 * Unified diagram_action tool definition.
 * Consolidates all architecture diagram and template operations into a single entrypoint.
 *
 * Actions: catalogue, select, generate, show, render, list_template, get_template
 */
export const architectureToolDefinitions = [
  {
    name: 'diagram_action',
    description: `REQUIRED TOOL: Use diagram_action for ALL architecture diagram and template operations.

Actions: catalogue (list all available diagram types with metadata), select (record which conditional diagrams to generate for a gate), generate (generate diagrams for a gate or a single type), show (retrieve and display a specific diagram), render (render raw DOT syntax to SVG using local Graphviz CLI), list (list available project templates), get (retrieve a template by name — requires name; optional includeContext).

Call this tool whenever: you need to view available diagram types, generate architecture diagrams, read diagram content, render DOT source to SVG, or work with project templates.`,
    inputSchema: DiagramActionInputSchema,
  },
]

export function architectureHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const archActionHandler = createEntityActionHandler(
    {
      entity: 'arch',
      actions: ['catalogue', 'select', 'generate', 'show', 'render'] as const,
      inputSchema: DiagramActionInputSchema,
      outputSchema: DiagramActionOutputSchema,
      actionOutputSchema: getDiagramActionOutputSchema,
      actionHandlers: {
        catalogue: async (_payload, r) => r.invoke('arch_catalogue', {}),
        select: async (payload, r) => r.invoke('arch_select', payload ?? {}),
        generate: async (payload, r) => r.invoke('arch_generate', payload ?? {}),
        show: async (payload, r) => {
          // arch_show registry uses `type` key, but MCP input uses `diagramType`
          const { diagramType, ...rest } = (payload ?? {}) as { diagramType?: string } & Record<string, unknown>
          return r.invoke('arch_show', { type: diagramType, ...rest })
        },
        render: async (payload) => {
          const { dotSyntax } = (payload ?? {}) as { dotSyntax?: string }
          if (!dotSyntax) return { success: false as const, error: { message: 'render action requires dotSyntax', code: 'VALIDATION_ERROR', context: {} } }
          try {
            const { dotToSvg } = await import('../../utils/dot-renderer.js')
            const svg = await dotToSvg(dotSyntax)
            const result = ArchDiagramRenderOutputSchema.parse({ svg, bytes: svg.length })
            return { success: true as const, data: result }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { success: false as const, error: { message, code: 'RENDER_ERROR', context: {} } }
          }
        },
      },
    },
    registry
  )

  return {
    diagram_action: async (args: Record<string, unknown> | null): Promise<CallToolResult> => {
      if (!args) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_ARGS', message: 'Arguments cannot be null' }, null, 2) }],
        }
      }

      const action = args['action']

      // --- template actions handled inline (use discovery service, not registry) ---
      if (action === 'list_template') {
        try {
          const templates = await discovery.getTemplates()
          return {
            content: [{ type: 'text', text: JSON.stringify({ templates }, null, 2) }],
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          const payload = { code: 'INTERNAL_ERROR', message, timestamp: new Date().toISOString() }
          return {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
            isError: true,
          }
        }
      }

      if (action === 'get_template') {
        const nameVal = args['name']
        const includeContextVal = args['includeContext']
        if (typeof nameVal !== 'string' || nameVal.length === 0) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ code: 'VALIDATION_ERROR', message: 'name is required for get_template' }, null, 2) }],
            isError: true,
          }
        }
        try {
          const includeContext = includeContextVal === true || includeContextVal === 'true'
          const artifact = await discovery.getArtifact('template', nameVal)
          if (!artifact) {
            const payload = { code: 'NOT_FOUND', message: `Template not found: ${nameVal}`, timestamp: new Date().toISOString() }
            return {
              content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
              isError: true,
            }
          }
          const artifactStr = JSON.stringify(artifact, null, 2)
          if (includeContext) {
            const context = `Name: ${nameVal}\nArtifact: ${artifactStr}`
            return {
              content: [{ type: 'text', text: context }],
            }
          }
          return { content: [{ type: 'text', text: artifactStr }] }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          const payload = { code: 'INTERNAL_ERROR', message, timestamp: new Date().toISOString() }
          return {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
            isError: true,
          }
        }
      }

      // --- architecture diagram actions delegated to entity action handler ---
      return archActionHandler(args)
    },
  }
}
