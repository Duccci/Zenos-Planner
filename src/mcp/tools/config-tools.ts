export const configToolDefinitions = [
  {
    name: 'config_get',
    title: 'Config Get',
    description: 'Get project configuration values',
    inputSchema: z.any()
  }
]

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { createSchemaValidatingHandler } from './handler-factory.js'
import { z } from 'zod'

export function configHandlers(registry: FunctionRegistry) {
  return {
    // Use the schema-validating factory with a permissive schema (z.any()) so
    // parsed JSON output becomes the structured content when possible.
    config_get: createSchemaValidatingHandler(registry, 'config_get', z.any())
  }
}
