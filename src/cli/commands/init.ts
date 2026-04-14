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
import { directoryExists, fileExists } from '../../utils/file.js'
import { findProjectRoot, loadConfig, getDefaultConfig, saveConfig, getDefaultProject, saveProject, getProjectPath, readProject, getZenoGitDir } from '../../utils/config.js'
import type { ProjectGate } from '../../utils/config.js'
import { shortHash } from '../../utils/hash.js'
import { isZenoSubmodule, addZenoSubmodule } from '../../utils/git.js'
import { generateAgentsMD } from '../../generation/agents-generator.js'
import { writeAgentsMD } from '../../generation/agents-writer.js'
import { writeTerminologyMD } from '../../generation/terminology-writer.js'
import { loadGitignoreTemplate } from '../../generation/template-discovery.js'
import { resolve, join } from 'node:path'

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
async function runInitWorkflow(
  projectName: string,
  projectStatement: string,
  submoduleUrl?: string
): Promise<void> {
  const projectRoot = process.cwd()

  logger.info('Initializing Zeno project...')
  logger.info(`Project: ${projectName}`)
  logger.info(`Root: ${projectRoot}`)

  // 0. Set up submodule if requested (runs before createProjectStructure so
  //    the mounted zeno/ directory is present when scaffold checks for it)
  if (submoduleUrl) {
    logger.info(`Adding zeno submodule from ${submoduleUrl}...`)
    await addZenoSubmodule(submoduleUrl, projectRoot)
    logger.info('Submodule added — zeno/ is now a separate git repository')
  }

  // Detect whether zeno/ is a submodule (explicit --submodule flag or pre-existing)
  const usingSubmodule = submoduleUrl !== undefined || isZenoSubmodule(projectRoot)
  if (usingSubmodule && !submoduleUrl) {
    logger.info('Detected existing zeno/ git submodule — enabling submodule mode')
  }

  // Build config — workspace topology is auto-detected at runtime from the
  // filesystem (submodule vs standard layout), so no workspace fields needed.
  const config = getDefaultConfig(projectName, projectStatement)

  // Create project structure (auto-detects layout from submodule state)
  logger.info('Creating project structure...')
  const createdPaths = await createProjectStructure(projectRoot, config)
  logger.info(`Created ${createdPaths.length.toString()} directories/files`)

  // Save config
  await saveConfig(config, projectRoot)

  // 3. Create project.json if it doesn't exist
  const projectJsonPath = getProjectPath(projectRoot)
  if (!fileExists(projectJsonPath)) {
    logger.info('Creating project.json...')
    const defaultProject = getDefaultProject(projectName, projectStatement)
    await saveProject(defaultProject, projectRoot)
    createdPaths.push(projectJsonPath)
  }

  // 4. Generate AGENTS.md and TERMINOLOGY.md
  //    In submodule mode, write to consumer's planning dir (project root),
  //    not inside the submodule.
  logger.info('Generating AGENTS.md...')
  const planningDir = getZenoGitDir(projectRoot)
  const agentsContent = generateAgentsMD(config)
  await writeAgentsMD(agentsContent, planningDir)

  logger.info('Generating TERMINOLOGY.md...')
  await writeTerminologyMD(projectName, planningDir)

  // 4. Generate project requirements
  logger.info('Generating project requirements...')
  const reqGen = new RequirementGenerator()

  // 4a. Extract requirements from spec files already present in the project root
  const fileReqs = await reqGen.generateFromProjectFiles(projectRoot)
  if (fileReqs.length > 0) {
    logger.info(`Extracted ${fileReqs.length.toString()} requirements from existing project files`)
  }

  // 4b. Extract requirements from the project statement
  const requirements = reqGen.generateFromProjectStatement(projectStatement)
  logger.info(`Generated ${requirements.length.toString()} project requirements`)

  // 5. Generate gates (only when requirements exist — empty description yields no meaningful gates)
  if (requirements.length > 0) {
    logger.info('Generating project gates...')
    const gatesResult = generateGates(projectStatement, undefined, requirements)
    logger.info(
      `Generated ${gatesResult.gates.length.toString()} gates with ${gatesResult.totalComplexity.toString()} total complexity`
    )

    // Persist generated gates to project.json
    const now = new Date().toISOString()
    const projectGates: ProjectGate[] = gatesResult.gates.map((gate, idx) => ({
      id: gate.id,
      sequence: idx + 1,
      name: gate.name,
      hash: shortHash(`${gate.id}:${gate.name}:${gate.description}`),
      status: 'pending' as const,
      goal: gate.objectives[0]?.description ?? gate.description,
      estimatedComplexity: gate.estimatedComplexity.toString(),
      milestones: gate.milestones,
      createdAt: now,
      completedAt: null,
    }))
    const project = await readProject(projectRoot)
    project.gates = projectGates
    project.project.totalGatesPlanned = projectGates.length
    project.lastUpdated = now
    await saveProject(project, projectRoot)
    logger.info(`Saved ${projectGates.length.toString()} gates to project.json`)
  } else {
    logger.info('Skipping gate generation: provide a detailed project description to generate gates')
  }

  // Write a .gitignore for the project from the bundled template.
  // If one already exists, only append lines that are not yet present.
  const gitignorePath = join(projectRoot, '.gitignore')
  const { readFileSync, writeFileSync, appendFileSync } = await import('node:fs')
  let existingGitignore = ''
  try {
    existingGitignore = readFileSync(gitignorePath, 'utf-8')
  } catch {
    // does not exist yet
  }

  try {
    const templateContent = await loadGitignoreTemplate()
    if (!existingGitignore) {
      writeFileSync(gitignorePath, templateContent, 'utf-8')
      logger.info('Created .gitignore from Zeno template')
    } else {
      // Append only non-empty, non-comment lines that are not yet covered
      const newLines = templateContent
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith('#') && !existingGitignore.includes(line.trim()))
      if (newLines.length > 0) {
        appendFileSync(gitignorePath, '\n# ── Added by zeno init ─────────────────────────────────────\n' + newLines.join('\n') + '\n', 'utf-8')
        logger.info(`Updated .gitignore with ${String(newLines.length)} missing entries from Zeno template`)
      }
    }
    existingGitignore = readFileSync(gitignorePath, 'utf-8')
  } catch (err) {
    logger.warn(`Could not apply .gitignore template: ${err instanceof Error ? err.message : String(err)}`)
  }

  // In submodule mode, also append tool-directory-specific entries that the
  // generic template cannot know (the mounted submodule path).
  if (usingSubmodule) {
    const submoduleEntries = [
      `zeno/.zeno/`,
    ]
    const missingSubmodule = submoduleEntries.filter((e) => !existingGitignore.includes(e))
    if (missingSubmodule.length > 0) {
      appendFileSync(
        gitignorePath,
        '\n# Zeno submodule tool directory — do not commit consumer state inside it\n' +
          missingSubmodule.join('\n') + '\n',
        'utf-8'
      )
      logger.info('Updated .gitignore with Zeno submodule tool-directory exclusions')
    }
  }

  logger.info('Project initialized successfully!')
  logger.info('')
  logger.info('Next steps:')
  if (usingSubmodule) {
    logger.info('  1. cd into zeno/ and install dependencies: cd zeno && npm install && npm run build')
    logger.info(`  2. Run "node zeno/bin/zeno.js mcp install" to configure the editor MCP server (server key: '${config.zenoServerName ?? 'zeno-planner'}')`)
    logger.info('  3. Commit the submodule changes: git add zeno .vscode && git commit')
    logger.info('  4. Run "node zeno/bin/zeno.js gates list" to see your roadmap')
    logger.info('  5. Start with "node zeno/bin/zeno.js gates start gate-01"')
  } else {
    logger.info('  1. Review zeno/PROJECT_PRD.md for project overview')
    logger.info('  2. Check zeno/architecture/ for system diagrams')
    logger.info(`  3. Run "zeno mcp install" to configure the editor MCP server (server key: '${config.zenoServerName ?? 'zeno-planner'}')`)
    logger.info('  4. Run "zeno gates list" to see your roadmap')
    logger.info('  5. Start with "zeno gates start gate-01"')
  }
}

/**
 * Register init command
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new Zeno project')
    .option('-f, --force', 'Force reinitialization even if project is already initialized')
    .option(
      '-s, --submodule <url>',
      'URL of a remote git repo to mount as the zeno/ submodule (runs git submodule add <url> zeno)'
    )
    .action(async (options) => {
      try {
        logger.info("Welcome to Zeno's Planner!")
        logger.info("Let's set up your project.\n")

        const projectRoot = process.cwd()
        const existingRoot = findProjectRoot(projectRoot)

        let existingConfig: Awaited<ReturnType<typeof loadConfig>> | null = null
        if (existingRoot) {
          // Guard: if the found root differs from the current working directory we
          // are inside the zeno/ planning directory of an existing project.
          // Proceeding would create a nested zeno/zeno/.zeno structure.
          if (resolve(existingRoot) !== resolve(projectRoot)) {
            logger.error(
              `Cannot run "zeno init" from "${projectRoot}": this path is inside the zeno/ ` +
              `planning directory of an existing project at "${existingRoot}".`
            )
            logger.error(
              `Run "zeno init" from the project root instead: "${existingRoot}"`
            )
            return
          }
          try {
            existingConfig = await loadConfig(existingRoot)
            if (!(options as { force?: boolean }).force) {
              logger.info(`Project already initialized: ${existingConfig.projectName}`)
              if (existingConfig.projectStatement) {
                logger.info(`Project statement: ${existingConfig.projectStatement.substring(0, 100)}...`)
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
        const projectStatement = await editor({
          message: "Describe your project (what you want to build):",
          default: existingConfig?.projectStatement ?? 'A complete, production-ready application that...',
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

        await runInitWorkflow(projectName, projectStatement, (options as { submodule?: string }).submodule)
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
