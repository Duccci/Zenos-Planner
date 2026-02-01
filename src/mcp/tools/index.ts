import { z } from 'zod'
import { gateToolDefinitions } from './gate-tools.js'
import { requirementToolDefinitions } from './requirement-tools.js'
import { proposalToolDefinitions } from './proposal-tools.js'
import { repositoryToolDefinitions } from './repository-tools.js'
import { analysisToolDefinitions } from './analysis-tools.js'
import { templateToolDefinitions, templateHandlers } from './template-tools.js'
import { repositoryToolDefinitions, repositoryHandlers } from './repository-tools.js'
import { analysisToolDefinitions, analysisHandlers } from './analysis-tools.js'
import { configToolDefinitions } from './config-tools.js'
import { gateHandlers } from './gate-tools.js'
import { requirementHandlers } from './requirement-tools.js'
import { proposalHandlers } from './proposal-tools.js'
import { configHandlers } from './config-tools.js'
import { createToolHandler } from '../tool-handlers.js'
import { logger } from '../../utils/logger.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'

const allToolDefs = [
  ...gateToolDefinitions,
  ...requirementToolDefinitions,
  ...proposalToolDefinitions,
  ...repositoryToolDefinitions,
  ...analysisToolDefinitions,
  ...templateToolDefinitions,
  ...configToolDefinitions
]

/**
 * Centralized MCP tool registration
 *
 * Precedence: Handler-based tools are registered first and take precedence
 * over CLI-backed function implementations. This allows handlers to provide
 * predictable, schema-validated `structuredContent` for LLM integration while
 * still relying on function registry implementations as a backend when needed.
 */
export function registerTools(server: McpServer, registry: FunctionRegistry) {
  const registered: string[] = []

  // Register handler-based tools first to allow them to override CLI-backed functions
  const handlerFactories = [templateHandlers, repositoryHandlers, analysisHandlers, gateHandlers, requirementHandlers, proposalHandlers, configHandlers]
  for (const factory of handlerFactories) {
    const handlers = factory(registry as FunctionRegistry)
    for (const [name, handler] of Object.entries(handlers)) {
      const override = allToolDefs.find(t => t.name === name)
      const title = override?.title ?? name
      const description = override?.description ?? ''
      const inputSchema = override?.inputSchema ?? z.any()

      // Register the handler-based tool (these take precedence)
      server.registerTool(
        name,
        { title, description, inputSchema: inputSchema as any, outputSchema: z.any() },
        handler as any
      )

      logger.info(`Registered MCP handler tool: ${name}`)
      registered.push(name)
    }
  }

  // Register remaining function-based tools, skipping any that handlers already registered
  const allFunctions = registry.list()
  for (const func of allFunctions) {
    if (registered.includes(func.name)) {
      logger.info(`Skipping function registration for ${func.name}; handler already registered`)
      continue
    }

    const override = allToolDefs.find(t => t.name === func.name)

    const title = override?.title ?? func.name
    const description = override?.description ?? func.description
    const inputSchema = override?.inputSchema ?? (func.schema as any) ?? z.any()

    server.registerTool(
      func.name,
      {
        title,
        description,
        inputSchema: inputSchema as any,
        outputSchema: z.any()
      },
      createToolHandler(registry, func.name)
    )

    logger.info(`Registered MCP tool: ${func.name}`)
    registered.push(func.name)
  }

  return registered
}

export const tools = allToolDefs
