/**
 * Configuration Tool Definitions and Handlers
 *
 * MCP tools for accessing project configuration.
 */

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { createSchemaValidatingHandler } from './handler-factory.js'
import { z } from 'zod'
import { ConfigGetOutputSchema } from '../schemas/config-schemas.js'

/**
 * Tool definitions for configuration operations.
 * Exposed to LLMs via MCP.
 */
export const configToolDefinitions = [
  {
    name: 'config_get',
    title: 'Get Configuration',
    description:
      'Get project configuration including quality thresholds, git settings, version, and versioning settings. Returns structured ZenoConfig object with all project settings.',
    inputSchema: z.object({}), // No input parameters required
  },
]

/**
 * Handlers for configuration tools.
 * Validates outputs against schemas.
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export function configHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  return {
    config_get: createSchemaValidatingHandler(registry, 'config_get', ConfigGetOutputSchema),
  }
}
