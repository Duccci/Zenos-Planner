import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry, FunctionResult } from '../../integration/function-registry.js'
import {
  DiagramActionInputSchema,
  DiagramActionOutputSchema,
  getDiagramActionOutputSchema,
  ArchDiagramRenderOutputSchema,
} from '../schemas/architecture-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'
import { createDiscoveryService } from '../../generation/artifact-discovery-service.js'
import { getWorkspaceRoot } from '../../utils/config.js'

// Defer discovery creation until first use so it picks up ZENO_WORKSPACE if set.
let _discovery: ReturnType<typeof createDiscoveryService> | undefined
function getDiscovery(): ReturnType<typeof createDiscoveryService> {
  _discovery ??= createDiscoveryService(getWorkspaceRoot())
  return _discovery
}

/**
 * Handler for list_template action
 * Returns all available templates (markdown and architecture)
 */
async function handleListTemplate(
  _payload: Record<string, unknown> | undefined
): Promise<FunctionResult> {
  try {
    const templates = await getDiscovery().getTemplates()
    return {
      success: true,
      data: {
        templates: templates.map((t) => ({
          name: t.name,
          shortName: t.shortName,
          path: t.path,
          description: t.description,
          category: t.category,
        })),
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: {
        message,
        code: 'DISCOVERY_ERROR',
        context: { timestamp: new Date().toISOString() },
      },
    }
  }
}

/**
 * Handler for get_template action
 * Retrieves a specific template by name, optionally with full content
 */
async function handleGetTemplate(
  payload: Record<string, unknown> | undefined
): Promise<FunctionResult> {
  const name = payload?.['name'] as string | undefined ?? ''
  if (!name) {
    return {
      success: false,
      error: {
        message: 'name is required for get_template',
        code: 'VALIDATION_ERROR',
        context: {},
      },
    }
  }

  try {
    const includeContextVal = payload?.['includeContext']
    const includeContext = includeContextVal === true || includeContextVal === 'true'
    const artifact = await getDiscovery().getArtifact('template', name)

    if (!artifact) {
      return {
        success: false,
        error: {
          message: `Template not found: ${name}`,
          code: 'NOT_FOUND',
          context: { templateName: name },
        },
      }
    }

    // Type guard: artifact should be a Template for this handler
    const template = artifact as {
      name: string
      shortName: string
      path: string
      description: string
      category: 'markdown' | 'architecture'
      content?: string
    }

    const result = {
      name: template.name,
      shortName: template.shortName,
      path: template.path,
      description: template.description,
      category: template.category,
      ...(template.content && { content: template.content }),
      ...(includeContext && {
        _context: {
          retrievedAt: new Date().toISOString(),
          templateName: name,
        },
      }),
    }

    return {
      success: true,
      data: result,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: {
        message,
        code: 'INTERNAL_ERROR',
        context: { templateName: name, timestamp: new Date().toISOString() },
      },
    }
  }
}

/**
 * Unified diagram_action tool definition.
 * Consolidates all architecture diagram and template operations into a single entrypoint.
 *
 * Actions: catalogue, select, generate, show, render, list_template, get_template
 */
export const architectureToolDefinitions = [
  {
    name: 'diagram_action',
    description: `Architecture & templates: catalogue, select, generate, show, render, list_template, get_template. Use for diagram generation, viewing, rendering (DOT→SVG), and template management.`,
    inputSchema: DiagramActionInputSchema,
  },
]

export function architectureHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const archActionHandler = createEntityActionHandler(
    {
      entity: 'arch',
      actions: ['catalogue', 'select', 'generate', 'show', 'render', 'list_template', 'get_template'] as const,
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
        list_template: handleListTemplate,
        get_template: handleGetTemplate,
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

      // All actions (diagram + template) now delegated to entity action handler
      return archActionHandler(args)
    },
  }
}
