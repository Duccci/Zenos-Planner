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

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
    .description('Zeno\'s Planner - Progressively approach project completion through iterative gates')
    .version(version, '-v, --version', 'display version number')

  // Global error handler
  program.configureOutput({
    writeErr: (str) => {
      process.stderr.write(str)
    },
  })

  // Catch unhandled errors
  program.exitOverride((err) => {
    if (isZenoError(err)) {
      logger.error(formatError(err))
      process.exit(err.exitCode || 1)
    } else if (err instanceof Error) {
      logger.error(`Error: ${err.message}`)
      process.exit((err as { exitCode?: number }).exitCode ?? 1)
    } else {
      logger.error(`Unknown error: ${String(err)}`)
      process.exit(1)
    }
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

    // Parse arguments
    await program.parseAsync(process.argv)

    // If no command provided, show help
    if (!process.argv.slice(2).length) {
      program.help()
    }
  } catch (error) {
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
 * Main CLI execution function (for bin/zeno.js)
 */
export async function run(): Promise<void> {
  await main()
}
