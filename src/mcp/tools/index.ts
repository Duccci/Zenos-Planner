import { z } from 'zod'
import { logger } from '../../utils/logger.js'
import { gateHandlers, gateToolDefinitions } from './gate-tools.js'
import { requirementHandlers } from './requirement-tools.js'
import { proposalHandlers, proposalToolDefinitions } from './proposal-tools.js'
import { configHandlers } from './config-tools.js'
import { validationHandlers, validationToolDefinitions } from './validation-tools.js'
import { templateHandlers, templateToolDefinitions } from './template-tools.js'
import { repositoryHandlers, repositoryToolDefinitions } from './repository-tools.js'
import { analysisHandlers, analysisToolDefinitions } from './analysis-tools.js'
import { architectureHandlers, architectureToolDefinitions } from './architecture-tools.js'
import { projectHandlers, projectToolDefinitions } from './project-tools.js'
import { contextHandlers, contextToolDefinitions } from './context-tools.js'
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
  ...projectToolDefinitions,
  ...contextToolDefinitions,
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
 * consistent, schema-validated responses for LLM integration while
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
    validationHandlers,
    architectureHandlers,
    projectHandlers,
    contextHandlers,
  ]
  for (const factory of handlerFactories) {
    const handlers = factory(registry)
    for (const [name, handler] of Object.entries(handlers)) {
      const meta = toolMetaMap.get(name)
      const description = meta?.description ?? ''
      // z.any() must NOT be used here: normalizeObjectSchema(z.any()) returns undefined
      // (def.type='any', not 'object'), which causes safeParseAsync(undefined, ...) →
      // isZ4Schema(undefined) → TypeError: Cannot read properties of undefined (reading '_zod').
      // z.object({}).passthrough() has def.type='object' and normalizes correctly.
      const inputSchema: z.ZodType = meta?.inputSchema ?? z.looseObject({})

      if (!description) {
        logger.warn(`Tool "${name}" has no description — add it to its ToolDefinitions array`)
      }

      // Register the handler-based tool (these take precedence).
      // NOTE: outputSchema is intentionally omitted — passing z.any() causes
      // the MCP SDK's validateToolOutput to call normalizeObjectSchema(z.any()),
      // which returns undefined (z.any() has def.type='any', not 'object'),
      // then calls safeParseAsync(undefined, ...) → isZ4Schema(undefined) →
      // TypeError: Cannot read properties of undefined (reading '_zod').
      // Handlers validate their own output via config.outputSchema.parse() instead.
      server.registerTool(
        name,
        { description, inputSchema: inputSchema },
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
