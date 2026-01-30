/**
 * Command Invocation Helpers
 *
 * Utilities for AI agents to invoke Zeno commands programmatically
 * with proper argument validation and error handling.
 */

import { execSync } from 'child_process'
import { functionRegistry } from './function-registry.js'
import { logger } from '../utils/logger.js'

export interface CommandResult {
  success: boolean
  output: string
  error?: string
  exitCode: number
}

export interface ValidationError {
  field: string
  message: string
}

/**
 * Invoke a Zeno command with argument validation
 */
export async function invokeCommand(
  command: string,
  args: Record<string, unknown> = {}
): Promise<CommandResult> {
  try {
    // Validate arguments
    const validation = validateCommandArguments(command, args)
    if (!validation.valid) {
      return {
        success: false,
        output: '',
        error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
        exitCode: 1
      }
    }

    // Build command string
    const commandString = buildCommandString(command, args)

    logger.debug(`Invoking command: ${commandString}`)

    // Execute command
    const result = await executeCommand(commandString)

    logger.debug(`Command result: ${result.success ? 'success' : 'failed'}`)

    return result
  } catch (error) {
    logger.error(`Command invocation failed: ${String(error)}`)
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
      exitCode: 1
    }
  }
}

/**
 * Validate command arguments against function signature
 */
export function validateCommandArguments(
  command: string,
  args: Record<string, unknown>
): { valid: boolean; errors: ValidationError[] } {
  const func = functionRegistry.find(f => f.name === command)
  if (!func) {
    return {
      valid: false,
      errors: [{ field: 'command', message: `Unknown command: ${command}` }]
    }
  }

  const errors: ValidationError[] = []

  // Check required parameters
  for (const param of func.parameters) {
    if (param.required && !(param.name in args)) {
      errors.push({
        field: param.name,
        message: `Required parameter '${param.name}' is missing`
      })
    }
  }

  // Check parameter types
  for (const [key, value] of Object.entries(args)) {
    const param = func.parameters.find(p => p.name === key)
    if (!param) {
      errors.push({
        field: key,
        message: `Unknown parameter '${key}'`
      })
      continue
    }

    if (!validateParameterType(value, param.type)) {
      errors.push({
        field: key,
        message: `Parameter '${key}' must be of type ${param.type}, got ${typeof value}`
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Build command string from function name and arguments
 */
function buildCommandString(command: string, args: Record<string, unknown>): string {
  // Convert function name to CLI command
  const cliCommand = functionNameToCliCommand(command)

  // Build argument string
  const argParts: string[] = []

  for (const [key, value] of Object.entries(args)) {
    if (value === true) {
      // Boolean flag
      argParts.push(`--${key}`)
    } else if (value !== null && value !== undefined) {
      // Value parameter
      const stringValue = String(value as string | number | boolean)
      argParts.push(`--${key} "${stringValue.replace(/"/g, '\\"')}"`)
    }
  }

  return `node bin/zeno.js ${cliCommand} ${argParts.join(' ')}`.trim()
}

/**
 * Convert function name to CLI command
 */
function functionNameToCliCommand(funcName: string): string {
  const parts = funcName.split('_')
  if (parts.length === 0) {
    return funcName
  }
  if (parts.length === 1) {
    return parts[0] ?? ''
  }

  const [category, ...actionParts] = parts
  const action = actionParts.join('-')

  return `${category ?? ''} ${action}`
}

/**
 * Execute command and return result
 */
async function executeCommand(commandString: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    try {
      const output = execSync(commandString, {
        encoding: 'utf-8',
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      })

      resolve({
        success: true,
        output: output.trim(),
        exitCode: 0
      })
    } catch (error: unknown) {
      const err = error as { stdout?: string | Buffer; stderr?: string | Buffer; status?: number; message?: string }
      const stdout = err.stdout ? (Buffer.isBuffer(err.stdout) ? err.stdout.toString() : err.stdout).trim() : ''
      const stderr = err.stderr ? (Buffer.isBuffer(err.stderr) ? err.stderr.toString() : err.stderr).trim() : (err.message ?? 'Unknown error')
      resolve({
        success: false,
        output: stdout,
        error: stderr,
        exitCode: err.status ?? 1
      })
    }
  })
}

/**
 * Validate parameter type
 */
function validateParameterType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && !isNaN(value)
    case 'boolean':
      return typeof value === 'boolean'
    default:
      // For complex types, accept any value
      return true
  }
}

/**
 * Get available commands
 */
export function getAvailableCommands(): string[] {
  return functionRegistry.map(f => f.name)
}

/**
 * Get command help
 */
export function getCommandHelp(command: string): string | undefined {
  const func = functionRegistry.find(f => f.name === command)
  if (!func) return undefined

  const params = func.parameters
    .map(p => `${p.name}${p.required ? '' : '?'}: ${p.type}`)
    .join(', ')

  return `${func.name}(${params}): ${func.description}`
}