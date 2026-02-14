/**
 * MCP Error Handler
 *
 * Converts errors to structured MCP error responses with consistent formatting
 * and actionable error messages for LLM consumption.
 *
 * Uses the unified ErrorCode enum from common-schemas.ts for all error codes.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../utils/logger.js'
import type { ErrorCode } from './schemas/common-schemas.js'

/**
 * @deprecated Use `ErrorCode` from `common-schemas.ts` instead.
 * Kept for backward compatibility during migration.
 */
export enum McpErrorCode {
  VALIDATION_FAILED = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'COMMAND_FAILED',
}

/**
 * Structured error response for MCP
 */
export interface McpError {
  // Keep deprecated enum in the type for backwards compatibility — lint disabled where needed
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  code: ErrorCode | McpErrorCode
  message: string
  context?: Record<string, unknown>
  suggestions?: string[]
  timestamp?: string
}

/**
 * Map common error types to unified error codes
 */
function mapErrorToCode(error: unknown): ErrorCode {
  if (error instanceof Error) {
    // Check for explicit code on the error object
    const explicitCode = (error as unknown as Record<string, unknown>)['code']
    if (typeof explicitCode === 'string') {
      // Map known explicit codes to unified codes
      const codeMap: Record<string, ErrorCode> = {
        GIT_VIOLATION: 'GIT_VIOLATION',
        FUNCTION_NOT_FOUND: 'NOT_FOUND',
        INVALID_PARAMETERS: 'INVALID_INPUT',
        INVOCATION_ERROR: 'INTERNAL_ERROR',
      }
      if (codeMap[explicitCode]) return codeMap[explicitCode]
    }

    const message = error.message.toLowerCase()

    if (message.includes('not found') || message.includes('does not exist')) {
      return 'NOT_FOUND'
    }

    if (message.includes('permission') || message.includes('access denied')) {
      return 'PERMISSION_DENIED'
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return 'VALIDATION_ERROR'
    }

    if (message.includes('already exists') || message.includes('duplicate')) {
      return 'ALREADY_EXISTS'
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'COMMAND_FAILED'
    }

    if (message.includes('conflict')) {
      return 'CONFLICT'
    }
  }

  return 'INTERNAL_ERROR'
}

/**
 * Generate actionable suggestions based on error type
 */
function generateSuggestions(errorCode: string, context?: Record<string, unknown>): string[] {
  const suggestions: string[] = []
  const code = errorCode

  switch (code) {
    case 'NOT_FOUND':
      suggestions.push('Check if the requested resource exists')
      suggestions.push('Verify the ID or name is correct')
      suggestions.push('List available resources first')
      break

    case 'VALIDATION_ERROR':
    case 'INVALID_INPUT':
      suggestions.push('Check the input parameters against the expected schema')
      suggestions.push('Ensure all required fields are provided')
      suggestions.push('Verify parameter types match the documentation')
      break

    case 'PERMISSION_DENIED':
    case 'UNAUTHORIZED':
      suggestions.push('Ensure you have the necessary permissions')
      suggestions.push('Check if the project is properly initialized')
      break

    case 'INTERNAL_ERROR':
      suggestions.push('This is an unexpected error — please report it')
      suggestions.push('Try the operation again')
      suggestions.push('Check the server logs for more details')
      break

    case 'COMMAND_FAILED':
      suggestions.push('The command returned a non-zero exit code')
      suggestions.push('Check command arguments and environment')
      break

    case 'GIT_VIOLATION':
      suggestions.push('Git operations are forbidden during apply phase')
      suggestions.push('Remove git commands from the operation')
      suggestions.push('Git commits occur only at gate completion')
      break

    case 'ALREADY_EXISTS':
      suggestions.push('An entity with this identifier already exists')
      suggestions.push('Use a different identifier or update the existing entity')
      break

    case 'CONFLICT':
      suggestions.push('The operation conflicts with current state')
      suggestions.push('Refresh your view of the resource and retry')
      break

    case 'DEPENDENCY_BLOCKED':
      suggestions.push('A dependency must be resolved before this operation')
      suggestions.push('Check dependency chain with `zeno req deps <hash>`')
      break
  }

  // Add VSCode-specific connection troubleshooting if this seems like a connection issue
  if (context?.['function'] === 'connection' || errorCode === 'NETWORK_ERROR') {
    suggestions.push('VSCode Troubleshooting:')
    suggestions.push('  1. Check .vscode/mcp.json exists and points to correct executable')
    suggestions.push('  2. Verify bin/mcp-server.js is executable (run: npm run build)')
    suggestions.push('  3. Restart VSCode MCP server from command palette')
    suggestions.push('  4. Check VSCode MCP output panel for startup errors')
  }

  return suggestions
}

/**
 * Create a structured MCP error response
 */
export function createMcpError(error: unknown, context?: Record<string, unknown>): McpError {
  const errorCode = mapErrorToCode(error)
  const message = error instanceof Error ? error.message : 'Unknown error occurred'
  const suggestions = generateSuggestions(errorCode, context)

  const mcpError: McpError = {
    code: errorCode,
    message,
    context,
    suggestions,
    timestamp: new Date().toISOString(),
  }

  // Log the error with full context
  logger.error(`MCP Error: ${errorCode}`, {
    message,
    context,
    suggestions,
    originalError:
      error instanceof Error
        ? {
            name: error.name,
            stack: error.stack,
          }
        : error,
  })

  return mcpError
}

/**
 * Convert an MCP error to a CallToolResult
 */
export function mcpErrorToToolResult(error: McpError): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            error: error.message,
            code: error.code,
            context: error.context,
            suggestions: error.suggestions,
            timestamp: error.timestamp,
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  }
}

/**
 * Handle errors in tool execution and return appropriate MCP response
 */
export function handleToolError(
  error: unknown,
  functionName: string,
  args?: Record<string, unknown>
): CallToolResult {
  const context = {
    function: functionName,
    args: args ? Object.keys(args) : undefined,
  }

  const mcpError = createMcpError(error, context)
  return mcpErrorToToolResult(mcpError)
}
