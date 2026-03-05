/**
 * Init Command
 *
 * Initialize a new Zeno project
 */

import type { Command } from 'commander'
import { input, confirm, editor } from '@inquirer/prompts'
import { logger } from '../../utils/logger.js'
import { createProjectStructure } from '../../scaffold/index.js'
import { RequirementGenerator } from '../../generation/requirement-generator.js'
import { generateGates } from '../../core/gate-generator.js'
import { directoryExists } from '../../utils/file.js'
import { findProjectRoot, loadConfig, getDefaultConfig, saveConfig } from '../../utils/config.js'
import { initializeDatabase } from '../../storage/database.js'

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
 * Run the initialization workflow
 */
async function runInitWorkflow(projectName: string, endState: string): Promise<void> {
  const projectRoot = process.cwd()

  logger.info('Initializing Zeno project...')
  logger.info(`Project: ${projectName}`)
  logger.info(`Root: ${projectRoot}`)

  // 1. Create project structure
  logger.info('Creating project structure...')
  const createdPaths = await createProjectStructure(projectRoot)
  logger.info(`Created ${createdPaths.length.toString()} directories/files`)

  // 2. Update config with project name and end state
  const config = getDefaultConfig(projectName, endState)
  await saveConfig(config, projectRoot)

  // 3. Initialize database
  logger.info('Initializing database...')
  await initializeDatabase(projectRoot)

  // 4. Generate project requirements
  logger.info('Generating project requirements...')
  const reqGen = new RequirementGenerator()
  const requirements = reqGen.generateFromEndState(endState)
  logger.info(`Generated ${requirements.length.toString()} project requirements`)

  // 5. Generate gates
  logger.info('Generating project gates...')
  const gatesResult = generateGates(endState, undefined, requirements)
  logger.info(
    `Generated ${gatesResult.gates.length.toString()} gates with ${gatesResult.totalComplexity.toString()} total complexity`
  )

  logger.info('Project initialized successfully!')
  logger.info('')
  logger.info('Next steps:')
  logger.info('  1. Review zeno/PROJECT_PRD.md for project overview')
  logger.info('  2. Check zeno/architecture/ for system diagrams')
  logger.info('  3. Run "zeno gates list" to see your roadmap')
  logger.info('  4. Start with "zeno gates start gate-01"')
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

        await runInitWorkflow(projectName, endState)
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
