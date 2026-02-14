import { z } from 'zod'
import { logger } from '../../utils/logger.js'
import { gateHandlers } from './gate-tools.js'
import { requirementHandlers } from './requirement-tools.js'
import { proposalHandlers } from './proposal-tools.js'
import { configHandlers } from './config-tools.js'
import { archiveHandlers } from './archive-tools.js'
import { templateHandlers } from './template-tools.js'
import { repositoryHandlers } from './repository-tools.js'
import { analysisHandlers } from './analysis-tools.js'
import { workflowHandlers } from './workflow-tools.js'
import { ToolRegistry } from '../schemas/registry.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'

// Programmatically generate tool definitions from the ToolRegistry metadata
const allToolDefs = Object.values(ToolRegistry).map((entry) => ({
  name: entry.toolName,
  description: entry.description,
  inputSchema: entry.inputSchema as unknown as z.ZodType,
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
  const handlerFactories = [
    templateHandlers,
    repositoryHandlers,
    analysisHandlers,
    gateHandlers,
    requirementHandlers,
    proposalHandlers,
    configHandlers,
    archiveHandlers,
    workflowHandlers,
  ]
  for (const factory of handlerFactories) {
    const handlers = factory(registry)
    for (const [name, handler] of Object.entries(handlers)) {
      const override = allToolDefs.find((t) => t.name === name)
      const description = override?.description ?? ''
      const inputSchema: z.ZodType = (override?.inputSchema ?? z.any()) as z.ZodType

      // Register the handler-based tool (these take precedence)
      server.registerTool(
        name,
        { description, inputSchema: inputSchema, outputSchema: z.any() as z.ZodType },
        (args: unknown) => handler(args as Record<string, unknown>)
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
