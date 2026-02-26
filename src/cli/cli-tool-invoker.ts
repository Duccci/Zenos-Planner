/**
 * CLI Tool Invoker
 *
 * Provides direct access to MCP tools from CLI commands without spawning shell processes.
 * This ensures all database access uses the schema-validated MCP tool interface, as per design.
 */

import { getGlobalRegistry } from '../integration/function-implementations.js'
import { logger } from '../utils/logger.js'

export interface ToolInvocationResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Invoke an MCP tool directly from CLI commands.
 * This replaces execSync-based invocations and direct database access.
 *
 * Example:
 * const result = await invokeCliTool('proposal_list', { gateId: 'gate-01' })
 */
export async function invokeCliTool<T = unknown>(
  functionName: string,
  payload?: Record<string, unknown>
): Promise<ToolInvocationResult<T>> {
  try {
    const registry = getGlobalRegistry()
    const result = await registry.invoke(functionName, payload ?? {})

    if (result.success) {
      return {
        success: true,
        data: result.data as T,
      }
    }

    return {
      success: false,
      error: result.error.message || 'Unknown error',
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`Tool invocation failed for ${functionName}: ${errorMessage}`)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Invoke proposal action via MCP tool
 */
export async function invokeProposalAction<T = unknown>(
  action: string,
  payload?: Record<string, unknown>
): Promise<ToolInvocationResult<T>> {
  const functionName = `proposal_${action}`
  return invokeCliTool<T>(functionName, payload)
}

/**
 * Invoke gates action via MCP tool
 */
export async function invokeGatesAction<T = unknown>(
  action: string,
  payload?: Record<string, unknown>
): Promise<ToolInvocationResult<T>> {
  return invokeCliTool<T>('gates_action', {
    action,
    ...payload,
  })
}

/**
 * Invoke requirements action via MCP tool
 */
export async function invokeRequirementAction<T = unknown>(
  action: string,
  payload?: Record<string, unknown>
): Promise<ToolInvocationResult<T>> {
  return invokeCliTool<T>('requirement_action', {
    action,
    ...payload,
  })
}
