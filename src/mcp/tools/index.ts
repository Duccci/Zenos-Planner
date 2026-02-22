import { z } from 'zod'
import { logger } from '../../utils/logger.js'
import { gateHandlers, gateToolDefinitions } from './gate-tools.js'
import { requirementHandlers } from './requirement-tools.js'
import { proposalHandlers, proposalToolDefinitions } from './proposal-tools.js'
import { configHandlers } from './config-tools.js'
import { archiveHandlers } from './archive-tools.js'
import { validationHandlers, validationToolDefinitions } from './validation-tools.js'
import { templateHandlers, templateToolDefinitions } from './template-tools.js'
import { repositoryHandlers, repositoryToolDefinitions } from './repository-tools.js'
import { analysisHandlers, analysisToolDefinitions } from './analysis-tools.js'
import { architectureHandlers, architectureToolDefinitions } from './architecture-tools.js'
import { ToolRegistry } from '../schemas/registry.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'

// Build a name -> {description, inputSchema} map from all tool definition sources.
// ToolRegistry (unified action tools) takes precedence, then handler-level definitions.
const toolMetaMap = new Map<string, { description: string; inputSchema: z.ZodType }>()
type HandlerFn = (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>
type HandlerFactory = (registry: FunctionRegistry) => Record<string, HandlerFn>

// Collect handler-level definitions provided by handler modules
const handlerToolDefs = [
  ...templateToolDefinitions,
  ...repositoryToolDefinitions,
  ...analysisToolDefinitions,
  ...gateToolDefinitions,
  ...proposalToolDefinitions,
  ...validationToolDefinitions,
  ...architectureToolDefinitions,
]
for (const def of handlerToolDefs) {
  toolMetaMap.set(def.name, {
    description: def.description,
    inputSchema: def.inputSchema as unknown as z.ZodType,
  })
}

// ToolRegistry entries override handler-level definitions
for (const entry of Object.values(ToolRegistry)) {
  toolMetaMap.set(entry.toolName, {
    description: entry.description,
    inputSchema: entry.inputSchema as unknown as z.ZodType,
  })
}

// Preserve the original allToolDefs export shape for backwards compatibility
const allToolDefs = [...toolMetaMap.entries()].map(([name, meta]) => ({
  name,
  description: meta.description,
  inputSchema: meta.inputSchema,
}))

/**
 * Centralized MCP tool registration
 *
 * Precedence: Handler-based tools are registered first and take precedence
 * over CLI-backed function implementations. This allows handlers to provide
 * predictable, schema-validated `structuredContent` for LLM integration while
 * still relying on function registry implementations as a backend when needed.
 */
export function registerTools(server: McpServer, registry: FunctionRegistry): string[] {
  const registered: string[] = []

  // Register handler-based tools first to allow them to override CLI-backed functions
  const handlerFactories: HandlerFactory[] = [
    templateHandlers,
    repositoryHandlers,
    analysisHandlers,
    gateHandlers,
    requirementHandlers,
    proposalHandlers,
    configHandlers,
    archiveHandlers,
    validationHandlers,
    architectureHandlers,
  ]
  for (const factory of handlerFactories) {
    const handlers = factory(registry)
    for (const [name, handler] of Object.entries(handlers)) {
      const meta = toolMetaMap.get(name)
      const description = meta?.description ?? ''
      const inputSchema: z.ZodType = (meta?.inputSchema ?? z.any()) as z.ZodType

      if (!description) {
        logger.warn(`Tool "${name}" has no description — add it to its ToolDefinitions array`)
      }

      // Register the handler-based tool (these take precedence)
      server.registerTool(
        name,
        { description, inputSchema: inputSchema, outputSchema: z.any() as z.ZodType },
        async (args: unknown, extra: unknown): Promise<CallToolResult> =>
          (await handler(args as Record<string, unknown>, extra)) as CallToolResult
      )

      logger.info(`Registered MCP handler tool: ${name}`)
      registered.push(name)
    }
  }

  // Backwards compatibility removed: function-based tool registration is disabled.
  // Only handler-based tools are registered. This simplifies registration and
  // ensures handlers are the single source of truth for MCP tool behavior.
  logger.info(
    'Function-based tool registration disabled; only handler-based tools will be registered'
  )

  return registered
}

export const tools = allToolDefs
