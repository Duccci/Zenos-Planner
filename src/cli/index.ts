/**
 * Zeno CLI Entry Point
 *
 * Main CLI entry point using Commander.js with global error handling
 * and command registration.
 */

import { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { formatError, isZenoError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import { initializeDatabase } from '../storage/database.js'
import { getGlobalRegistry } from '../integration/function-implementations.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface CommanderExitLike {
  code?: string
  exitCode?: number
  message?: string
}

function isCommanderExitLike(error: unknown): error is CommanderExitLike {
  return typeof error === 'object' && error !== null && ('code' in error || 'exitCode' in error)
}

function isCommanderNonErrorExit(error: CommanderExitLike): boolean {
  return (
    error.code === 'commander.helpDisplayed' ||
    error.code === 'commander.version' ||
    error.message === '(outputHelp)' ||
    error.exitCode === 0
  )
}

/**
 * Load package.json to get version
 */
async function getVersion(): Promise<string> {
  try {
    const packagePath = join(__dirname, '../../package.json')
    const packageContent = await readFile(packagePath, 'utf-8')
    const packageJson = JSON.parse(packageContent) as { version?: string }
    return packageJson.version ?? '0.1.0'
  } catch {
    return '0.1.0'
  }
}

/**
 * Create and configure the CLI program
 */
export async function createProgram(): Promise<Command> {
  const version = await getVersion()
  const program = new Command()

  program
    .name('zeno')
    .description(
      "Zeno's Planner - Progressively approach project completion through iterative gates"
    )
    .version(version, '-v, --version', 'display version number')

  // Global error handler
  program.configureOutput({
    writeErr: (str) => {
      process.stderr.write(str)
    },
  })

  // Convert Commander exits to exceptions so main() can handle consistently
  program.exitOverride((err) => {
    throw err
  })

  // Register command categories
  const { registerCommands } = await import('./commands/index.js')
  registerCommands(program)

  return program
}

/**
 * Main CLI execution
 */
export async function main(): Promise<void> {
  try {
    const program = await createProgram()

    // Initialize database (creates tables and runs migrations if needed)
    // Only sync proposals in production (skip during tests to prevent side effects)
    const shouldSyncProposals = process.env['NODE_ENV'] !== 'test'
    await initializeDatabase(process.cwd(), { syncProposals: shouldSyncProposals, syncRequirements: shouldSyncProposals, syncGates: shouldSyncProposals })

    // Initialize function registry (enables all Zeno operations)
    getGlobalRegistry()
    logger.debug('Function registry initialized')

    // Parse arguments
    await program.parseAsync(process.argv)

    // If no command provided, show help without triggering exit override
    if (!process.argv.slice(2).length) {
      program.outputHelp()
      return
    }
  } catch (error) {
    if (isCommanderExitLike(error)) {
      if (isCommanderNonErrorExit(error)) {
        return
      }

      if (error.message) {
        logger.error(`Error: ${error.message}`)
      }
      process.exit(error.exitCode ?? 1)
    }

    if (isZenoError(error)) {
      logger.error(formatError(error))
      process.exit(1)
    } else if (error instanceof Error) {
      logger.error(`Unexpected error: ${error.message}`)
      if (error.stack) {
        logger.debug(error.stack)
      }
      process.exit(1)
    } else {
      logger.error(`Unknown error: ${String(error)}`)
      process.exit(1)
    }
  }
}

/**
 * Main CLI execution function (for the zeno command)
 */
export async function run(): Promise<void> {
  await main()
}
