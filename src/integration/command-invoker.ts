/**
 * Command Invocation Helpers
 *
 * Utilities for AI agents to invoke Zeno commands programmatically
 * with proper argument validation and error handling.
 */

import { execSync } from 'child_process'
import { functionRegistry } from './function-registry.js'
import { logger } from '../utils/logger.js'
import { trackGitOperations } from '../mcp/audit/git-operation-tracker.js'

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
        error: `Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`,
        exitCode: 1,
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
      exitCode: 1,
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
  const func = functionRegistry.find((f) => f.name === command)
  if (!func) {
    return {
      valid: false,
      errors: [{ field: 'command', message: `Unknown command: ${command}` }],
    }
  }

  const errors: ValidationError[] = []

  // Check required parameters
  for (const param of func.parameters) {
    if (param.required && !(param.name in args)) {
      errors.push({
        field: param.name,
        message: `Required parameter '${param.name}' is missing`,
      })
    }
  }

  // Check parameter types
  for (const [key, value] of Object.entries(args)) {
    const param = func.parameters.find((p) => p.name === key)
    if (!param) {
      errors.push({
        field: key,
        message: `Unknown parameter '${key}'`,
      })
      continue
    }

    if (!validateParameterType(value, param.type)) {
      errors.push({
        field: key,
        message: `Parameter '${key}' must be of type ${param.type}, got ${typeof value}`,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Build command string from function name and arguments
 */
function buildCommandString(command: string, args: Record<string, unknown>): string {
  const cliCommand = functionNameToCliCommand(command)
  const funcDef = functionRegistry.find((f) => f.name === command)
  const positionalArgs: string[] = []
  const optionArgs: string[] = []
  const consumedParams = new Set<string>()

  if (funcDef) {
    for (const param of funcDef.parameters) {
      const value = args[param.name]
      if (value === undefined || value === null) {
        continue
      }
      consumedParams.add(param.name)
      if (param.required) {
        positionalArgs.push(formatCliValue(value))
      } else {
        optionArgs.push(formatOption(param.name, value))
      }
    }
  }

  for (const [key, value] of Object.entries(args)) {
    if (consumedParams.has(key)) {
      continue
    }
    if (value === undefined || value === null) {
      continue
    }
    optionArgs.push(formatOption(key, value))
  }

  const parts = [...positionalArgs, ...optionArgs]
  return `node bin/zeno.js ${cliCommand} ${parts.join(' ')}`.trim()
}

function formatCliValue(value: unknown): string {
  const stringValue = String(value)
  return `"${stringValue.replace(/"/g, '\\"')}"`
}

function formatOption(paramName: string, value: unknown): string {
  const cliName = paramToCliName(paramName)
  if (value === true) {
    return `--${cliName}`
  }
  const stringValue = String(value)
  return `--${cliName} "${stringValue.replace(/"/g, '\\"')}"`
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
 * Convert a registry parameter name to a CLI option name
 * Examples:
 *  - gateId -> gate
 *  - project -> project
 *  - someFlag -> some-flag
 */
function paramToCliName(paramName: string): string {
  if (paramName.endsWith('Id')) {
    // Map gateId -> gate, proposalId -> proposal
    return paramName
      .slice(0, -2)
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
  }
  return paramName.replace(/([A-Z])/g, '-$1').toLowerCase()
}

/**
 * Execute command and return result
 */
export async function executeCommand(commandString: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    try {
      // Detect git operations and enforce apply-phase guardrail if set
      try {
        const parts = commandString.split(/\s+/)
        const cmd = parts[0] ?? ''
        const args = parts.slice(1)
        // If global apply-phase flag is set, disallow git ops
        interface ZenoGlobal {
          __ZENOPROPOSAL_APPLY_PHASE?: boolean
        }
        const zenoGlobal = globalThis as unknown as ZenoGlobal
        const allowGit = zenoGlobal.__ZENOPROPOSAL_APPLY_PHASE !== true
        trackGitOperations(cmd, args, allowGit)
      } catch (gErr: unknown) {
        // Git violation detected — surface as structured command failure
        const message = gErr instanceof Error ? gErr.message : String(gErr)
        let code = 'GIT_VIOLATION'
        let operations: unknown = undefined
        if (typeof gErr === 'object' && gErr !== null) {
          const obj = gErr as Record<string, unknown>
          if (
            'code' in obj &&
            (typeof obj['code'] === 'string' || typeof obj['code'] === 'number')
          ) {
            code = String(obj['code'])
          }
          if ('operations' in obj && Array.isArray(obj['operations'])) {
            operations = obj['operations']
          }
        }
        const payload = {
          code,
          message,
          operations,
          timestamp: new Date().toISOString(),
        }
        logger.warn(`Blocked command due to git guardrail: ${message}`)
        resolve({ success: false, output: '', error: JSON.stringify(payload), exitCode: 2 })
        return
      }
      const output = execSync(commandString, {
        encoding: 'utf-8',
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB buffer
      })

      resolve({
        success: true,
        output: output.trim(),
        exitCode: 0,
      })
    } catch (error: unknown) {
      const err = error as {
        stdout?: string | Buffer
        stderr?: string | Buffer
        status?: number
        message?: string
      }
      const stdout = err.stdout
        ? (Buffer.isBuffer(err.stdout) ? err.stdout.toString() : err.stdout).trim()
        : ''
      const stderr = err.stderr
        ? (Buffer.isBuffer(err.stderr) ? err.stderr.toString() : err.stderr).trim()
        : (err.message ?? 'Unknown error')
      resolve({
        success: false,
        output: stdout,
        error: stderr,
        exitCode: err.status ?? 1,
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
  return functionRegistry.map((f) => f.name)
}

/**
 * Get command help
 */
export function getCommandHelp(command: string): string | undefined {
  const func = functionRegistry.find((f) => f.name === command)
  if (!func) return undefined

  const params = func.parameters
    .map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`)
    .join(', ')

  return `${func.name}(${params}): ${func.description}`
}
