/**
 * Init Command
 *
 * Initialize a new Zeno project
 */

import type { Command } from 'commander'
import { input, confirm, editor } from '@inquirer/prompts'
import { logger } from '../../utils/logger.js'
import { directoryExists } from '../../utils/file.js'
import { findProjectRoot, loadConfig } from '../../utils/config.js'
import { getGlobalRegistry } from '../../integration/function-implementations.js'
import { syncMemoryFromProjectOverview } from '../../utils/memory-sync.js'

/**
 * Validate project name
 */
function validateProjectName(name: string): boolean | string {
  if (!name.trim()) {
    return 'Project name cannot be empty'
  }
  if (name.length > 100) {
    return 'Project name must be 100 characters or less'
  }
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    return 'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
  }
  return true
}

/**
 * Validate codebase path
 */
function validateCodebasePath(path: string): boolean | string {
  if (!directoryExists(path)) {
    return `Directory does not exist: ${path}`
  }
  return true
}

/**
 * Register init command
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new Zeno project')
    .option('-f, --force', 'Force reinitialization even if project is already initialized')
    .action(async (options) => {
      try {
        logger.info("Welcome to Zeno's Planner!")
        logger.info("Let's set up your project.\n")

        const projectRoot = process.cwd()
        const existingRoot = findProjectRoot(projectRoot)

        let existingConfig: Awaited<ReturnType<typeof loadConfig>> | null = null
        if (existingRoot) {
          try {
            existingConfig = await loadConfig(existingRoot)
            if (!(options as { force?: boolean }).force) {
              logger.info(`Project already initialized: ${existingConfig.projectName}`)
              if (existingConfig.endState) {
                logger.info(`End state: ${existingConfig.endState.substring(0, 100)}...`)
              }
              logger.info(
                'Use "zeno status" to see project status or "zeno gates list" to see your roadmap.'
              )
              logger.info('Use --force to reinitialize anyway.')
              return
            } else {
              logger.warn(
                `Forcing reinitialization of existing project: ${existingConfig.projectName}`
              )
            }
          } catch {
            logger.warn(
              'Could not load existing configuration, proceeding with fresh initialization'
            )
          }
        }

        // Prompt for project name
        const projectName = await input({
          message: 'What is your project name?',
          default: existingConfig?.projectName,
          validate: validateProjectName,
        })

        // Prompt for end state description
        const endState = await editor({
          message: "Describe your project's end state (what you want to build):",
          default: existingConfig?.endState ?? 'A complete, production-ready application that...',
          validate: (text) =>
            text.trim().length > 10 ||
            'Please provide a more detailed description (at least 10 characters)',
        })

        // Ask about existing codebase
        const hasExistingCodebase = await confirm({
          message: 'Do you have an existing codebase to analyze?',
          default: false,
        })

        if (hasExistingCodebase) {
          const codebasePath = await input({
            message: 'Path to existing codebase:',
            validate: validateCodebasePath,
          })
          logger.info(`Codebase path: ${codebasePath}`)
          // TODO: Implement codebase analysis
        }

        // Confirm and run
        const confirmed = await confirm({
          message: 'Ready to initialize project with these settings?',
          default: true,
        })

        if (!confirmed) {
          logger.info('Initialization cancelled')
          return
        }

        // Invoke the project_init function via registry
        const registry = getGlobalRegistry()
        const result = await registry.invoke('project_init', { projectName, endState })

        if (result.success) {
          const data = result.data as {
            message?: string
            gatesGenerated: number
            requirementsGenerated: number
          }
          logger.info('Project initialized successfully!')
          logger.info('')
          logger.info('Next steps:')
          logger.info('  1. Review zeno/overview/PROJECT_PRD.md for project overview')
          logger.info('  2. Check zeno/architecture/ for system diagrams')
          logger.info('  3. Run "zeno gates list" to see your roadmap')
          logger.info('  4. Start with "zeno gates start gate-01"')
          logger.info(`Generated ${String(data.gatesGenerated)} gates and ${String(data.requirementsGenerated)} requirements`)

          // Seed .serena/memories/project_overview.md with initial gate roadmap
          try {
            await syncMemoryFromProjectOverview(projectRoot)
          } catch {
            // Non-fatal — memory file may not exist in all environments
          }
        } else {
          const error = result.error as { code: string; message: string }
          if (error.code === 'PROJECT_EXISTS') {
            logger.info(error.message)
            logger.info('Use --force to reinitialize anyway.')
          } else {
            logger.error(`Initialization failed: ${error.message}`)
            process.exit(1)
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          logger.info('Initialization cancelled')
        } else {
          logger.error(
            `Initialization failed: ${error instanceof Error ? error.message : String(error)}`
          )
          process.exit(1)
        }
      }
    })
}

