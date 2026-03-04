/**
 * MCP Tool Handlers
 *
 * Wrappers that convert function registry invocations to MCP tool calls.
 * Handles input validation, function execution, and result formatting.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { FunctionRegistry } from '../integration/function-registry.js'
import { logger } from '../utils/logger.js'
import { handleToolError } from './error-handler.js'
import { diagnostics } from './diagnostics.js'

/**
 * Create a tool handler for a registered function
 */
export function createToolHandler(
  registry: FunctionRegistry,
  functionName: string
) {
  return async (args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      logger.debug(`Executing tool: ${functionName}`, { args })

      const result = await registry.invoke(functionName, args)

      if (result.success) {
        const response: CallToolResult = {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2)
            }
          ],
        }

        logger.debug(`Tool execution successful: ${functionName}`)
        return response
      } else {
        // Format error as tool result
        const errorResponse: CallToolResult = {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: result.error.message,
                code: result.error.code,
                context: result.error.context
              }, null, 2)
            }
          ],
          isError: true
        }

        logger.warn(`Tool execution failed: ${functionName}`, { error: result.error })
        diagnostics.recordError(functionName, result.error.message)
        return errorResponse
      }
    } catch (error) {
      diagnostics.recordError(functionName, error instanceof Error ? error.message : 'Unknown error')
      return handleToolError(error, functionName, args)
    }
  }
}
