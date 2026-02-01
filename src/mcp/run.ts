import { createFunctionRegistry } from '../integration/function-implementations.js'
import { createToolHandler } from './tool-handlers.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * Run a single tool once (ephemeral). Returns the MCP CallToolResult.
 */
export async function runToolOnce(toolName: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
  const registry = createFunctionRegistry()
  const handler = createToolHandler(registry, toolName)
  return handler(args)
}
