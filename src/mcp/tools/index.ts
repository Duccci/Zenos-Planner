import { z } from 'zod'
import { logger } from '../../utils/logger.js'
import { gateHandlers, gateToolDefinitions } from './gate-tools.js'
import { requirementHandlers, requirementToolDefinitions } from './requirement-tools.js'
import { proposalHandlers, proposalToolDefinitions } from './proposal-tools.js'
import { configHandlers, configToolDefinitions } from './config-tools.js'
import { gitTraceHandlers, gitTraceToolDefinitions } from './git-trace-tools.js'
import { validationHandlers, validationToolDefinitions } from './validation-tools.js'
import { repositoryHandlers, repositoryToolDefinitions } from './repository-tools.js'
import { worktreeHandlers, worktreeToolDefinitions } from './worktree-tools.js'
import { architectureHandlers, architectureToolDefinitions } from './architecture-tools.js'
import { projectHandlers, projectToolDefinitions } from './project-tools.js'
import { contextHandlers, contextToolDefinitions } from './context-tools.js'
import { projectSyncHandlers, projectSyncToolDefinitions } from './project-sync-tools.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'

export interface McpToolDefinitionInfo {
  name: string
  description: string
  inputSchema: z.ZodType
  parameters: string[]
  actions: string[]
}

// Build a name -> {description, inputSchema} map from the same handler-level
// definitions used by registerTools(). Keeping registration and metadata on one
// path prevents stale registry entries from hiding real MCP tools.
const toolMetaMap = new Map<string, { description: string; inputSchema: z.ZodType }>()
type HandlerFn = (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>
type HandlerFactory = (registry: FunctionRegistry) => Record<string, HandlerFn>

// Collect handler-level definitions provided by handler modules
const handlerToolDefs = [
  ...repositoryToolDefinitions,
  ...gateToolDefinitions,
  ...requirementToolDefinitions,
  ...proposalToolDefinitions,
  ...configToolDefinitions,
  ...validationToolDefinitions,
  ...architectureToolDefinitions,
  ...projectToolDefinitions,
  ...contextToolDefinitions,
  ...gitTraceToolDefinitions,
  ...worktreeToolDefinitions,
  ...projectSyncToolDefinitions,
]
for (const def of handlerToolDefs) {
  toolMetaMap.set(def.name, {
    description: def.description,
    inputSchema: def.inputSchema as unknown as z.ZodType,
  })
}

function getInputSchemaParameters(inputSchema: z.ZodType): string[] {
  const maybeSchema = inputSchema as unknown as {
    shape?: Record<string, unknown>
    _def?: { shape?: Record<string, unknown> | (() => Record<string, unknown>) }
  }
  const shape = maybeSchema.shape ?? maybeSchema._def?.shape
  const resolvedShape = typeof shape === 'function' ? shape() : shape
  return resolvedShape ? Object.keys(resolvedShape) : []
}

function getInputSchemaActions(inputSchema: z.ZodType): string[] {
  const maybeSchema = inputSchema as unknown as {
    shape?: Record<string, unknown>
    _def?: { shape?: Record<string, unknown> | (() => Record<string, unknown>) }
  }
  const shape = maybeSchema.shape ?? maybeSchema._def?.shape
  const resolvedShape = typeof shape === 'function' ? shape() : shape
  const actionSchema = resolvedShape?.['action'] as
    | { options?: unknown[]; _def?: { innerType?: { options?: unknown[] } } }
    | undefined
  const options = actionSchema?.options ?? actionSchema?._def?.innerType?.options ?? []
  return options.filter((option): option is string => typeof option === 'string')
}

const allToolDefs = [...toolMetaMap.entries()].map(([name, meta]) => ({
  name,
  description: meta.description,
  inputSchema: meta.inputSchema,
}))

export function getMcpToolDefinitionInfo(): McpToolDefinitionInfo[] {
  return allToolDefs.map((tool) => ({
    ...tool,
    parameters: getInputSchemaParameters(tool.inputSchema),
    actions: getInputSchemaActions(tool.inputSchema),
  }))
}

function requireToolMeta(name: string): { description: string; inputSchema: z.ZodType } {
  const meta = toolMetaMap.get(name)
  if (!meta?.description) {
    throw new Error(`Missing MCP tool definition for registered handler "${name}"`)
  }
  return meta
}

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
    repositoryHandlers,
    gateHandlers,
    requirementHandlers,
    proposalHandlers,
    configHandlers,
    validationHandlers,
    architectureHandlers,
    projectHandlers,
    contextHandlers,
    gitTraceHandlers,
    worktreeHandlers,
    projectSyncHandlers,
  ]
  for (const factory of handlerFactories) {
    const handlers = factory(registry)
    for (const [name, handler] of Object.entries(handlers)) {
      const meta = requireToolMeta(name)
      const description = meta.description
      // z.any() must NOT be used here: normalizeObjectSchema(z.any()) returns undefined
      // (def.type='any', not 'object'), which causes safeParseAsync(undefined, ...) →
      // isZ4Schema(undefined) → TypeError: Cannot read properties of undefined (reading '_zod').
      // z.object({}).passthrough() has def.type='object' and normalizes correctly.
      const inputSchema: z.ZodType = meta.inputSchema

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
