import { z } from 'zod'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

// template_action removed — template operations are now part of diagram_action
// (list_template and get_template actions). This file is kept as a stub to avoid
// breaking any residual imports; it exports no tool definitions or handlers.
export const templateToolDefinitions: { name: string; description: string; inputSchema: z.ZodType }[] = []

export function templateHandlers(
  _registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  return {}
}
