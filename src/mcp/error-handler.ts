/**
 * MCP Error Handler
 *
 * Converts errors to structured MCP error responses with consistent formatting
 * and actionable error messages for LLM consumption.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../utils/logger.js'

/**
 * Error codes for different types of failures
 */
export enum McpErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT'
}

/**
 * Structured error response for MCP
 */
export interface McpError {
  code: McpErrorCode
  message: string
  context?: Record<string, unknown>
  suggestions?: string[]
}

/**
 * Map common error types to MCP error codes
 */
function mapErrorToCode(error: unknown): McpErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes('not found') || message.includes('does not exist')) {
      return McpErrorCode.NOT_FOUND
    }

    if (message.includes('permission') || message.includes('access denied')) {
      return McpErrorCode.PERMISSION_DENIED
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return McpErrorCode.VALIDATION_FAILED
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return McpErrorCode.TIMEOUT
    }

    if (message.includes('network') || message.includes('connection')) {
      return McpErrorCode.NETWORK_ERROR
    }
  }

  return McpErrorCode.INTERNAL_ERROR
}

/**
 * Generate actionable suggestions based on error type
 */
function generateSuggestions(errorCode: McpErrorCode): string[] {
  const suggestions: string[] = []

  switch (errorCode) {
    case McpErrorCode.NOT_FOUND:
      suggestions.push('Check if the requested resource exists')
      suggestions.push('Verify the ID or name is correct')
      suggestions.push('List available resources first')
      break

    case McpErrorCode.VALIDATION_FAILED:
      suggestions.push('Check the input parameters against the expected schema')
      suggestions.push('Ensure all required fields are provided')
      suggestions.push('Verify parameter types match the documentation')
      break

    case McpErrorCode.PERMISSION_DENIED:
      suggestions.push('Ensure you have the necessary permissions')
      suggestions.push('Check if the project is properly initialized')
      suggestions.push('Verify your access to the workspace')
      break

    case McpErrorCode.INTERNAL_ERROR:
      suggestions.push('This is an unexpected error - please report it')
      suggestions.push('Try the operation again')
      suggestions.push('Check the server logs for more details')
      break

    case McpErrorCode.NETWORK_ERROR:
      suggestions.push('Check your network connection')
      suggestions.push('Verify the service is running')
      suggestions.push('Try again in a few moments')
      break

    case McpErrorCode.TIMEOUT:
      suggestions.push('The operation took too long to complete')
      suggestions.push('Try breaking it into smaller operations')
      suggestions.push('Check system resources')
      break
  }

  return suggestions
}

/**
 * Create a structured MCP error response
 */
export function createMcpError(
  error: unknown,
  context?: Record<string, unknown>
): McpError {
  const errorCode = mapErrorToCode(error)
  const message = error instanceof Error ? error.message : 'Unknown error occurred'
  const suggestions = generateSuggestions(errorCode)

  const mcpError: McpError = {
    code: errorCode,
    message,
    context,
    suggestions
  }

  // Log the error with full context
  logger.error(`MCP Error: ${errorCode}`, {
    message,
    context,
    suggestions,
    originalError: error instanceof Error ? {
      name: error.name,
      stack: error.stack
    } : error
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
        text: JSON.stringify({
          error: error.message,
          code: error.code,
          context: error.context,
          suggestions: error.suggestions
        }, null, 2)
      }
    ],
    isError: true
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
    args: args ? Object.keys(args) : undefined
  }

  const mcpError = createMcpError(error, context)
  return mcpErrorToToolResult(mcpError)
}