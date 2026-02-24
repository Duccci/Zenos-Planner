/**
 * Project Operations Registry
 *
 * Registers project-level operations with the function registry.
 * Handles: project_init, project_status
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { logger } from '../utils/logger.js'
import { createProjectStructure } from '../scaffold/index.js'
import { RequirementGenerator } from '../generation/requirement-generator.js'
import { generateGates } from '../core/gate-generator.js'
import { writeAgentsMD } from '../generation/agents-writer.js'
import { generateAgentsMD } from '../generation/agents-generator.js'
import {
  findProjectRoot,
  loadConfig,
  getDefaultConfig,
  saveConfig,
} from '../utils/config.js'
import { initializeDatabase, getDatabase } from '../storage/database.js'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Input schema for project_init
 */
const ProjectInitInputSchema = z.object({
  projectName: z.string().min(1).max(100),
  endState: z.string().min(1),
})

/**
 * Input schema for project_status
 */
const ProjectStatusInputSchema = z.object({})

/**
 * Register project operations with the function registry.
 */
export function registerProjectOps(registry: FunctionRegistry): void {
  /**
   * project_init: Initialize a new Zeno project
   */
  registry.register(
    'project_init',
    async (params: Record<string, unknown>) => {
      const input = ProjectInitInputSchema.parse(params)
      const projectRoot = process.cwd()

      try {
        // Check if project already exists
        const existingRoot = findProjectRoot(projectRoot)
        if (existingRoot) {
          try {
            const existingConfig = await loadConfig(existingRoot)
            return {
              success: false,
              error: {
                code: 'PROJECT_EXISTS',
                message: `Zeno project already exists: ${existingConfig.projectName}`,
              },
            }
          } catch {
            // If we can't load config, continue with fresh init
          }
        }

        logger.info('Initializing Zeno project...')
        logger.info(`Project: ${input.projectName}`)
        logger.info(`Root: ${projectRoot}`)

        // 1. Create project structure
        logger.info('Creating project structure...')
        const createdPaths = await createProjectStructure(projectRoot)
        logger.info(`Created ${createdPaths.length.toString()} directories/files`)

        // 2. Update config with project name and end state
        const config = getDefaultConfig(input.projectName, input.endState)
        await saveConfig(config, projectRoot)

        // 3. Initialize database
        logger.info('Initializing database...')
        await initializeDatabase(projectRoot, { syncProposals: true })

        // 4. Generate project requirements
        logger.info('Generating project requirements...')
        const reqGen = new RequirementGenerator()
        const requirements = reqGen.generateFromEndState(input.endState)
        logger.info(`Generated ${requirements.length.toString()} project requirements`)

        // 5. Generate gates
        logger.info('Generating project gates...')
        const gatesResult = generateGates(input.endState, undefined, requirements)
        logger.info(
          `Generated ${gatesResult.gates.length.toString()} gates with ${gatesResult.totalComplexity.toString()} total complexity`
        )

        // 6. Generate AGENTS.md
        logger.info('Generating AGENTS.md...')
        const agentsContent = generateAgentsMD(config, gatesResult.gates, requirements)
        await writeAgentsMD(agentsContent, projectRoot)

        logger.info('Project initialized successfully!')

        return {
          success: true,
          projectName: input.projectName,
          message: 'Project initialized successfully',
          gatesGenerated: gatesResult.gates.length,
          requirementsGenerated: requirements.length,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Project initialization failed: ${message}`)
        return {
          success: false,
          error: {
            code: 'INIT_FAILED',
            message: `Initialization failed: ${message}`,
          },
        }
      }
    },
    {
      description: 'Initialize a new Zeno project',
      parameters: [
        { name: 'projectName', type: 'string', description: 'Project name', required: true },
        { name: 'endState', type: 'string', description: 'Project end state description', required: true },
      ],
      returnType: 'ProjectInitOutput',
      schema: ProjectInitInputSchema,
    }
  )

  /**
   * project_status: Get project status and overview
   */
  registry.register(
    'project_status',
    async () => {
      try {
        const projectRoot = process.cwd()
        const zenoDir = join(projectRoot, 'zeno')
        const gatesDir = join(zenoDir, 'gates')
        const archiveDir = join(gatesDir, 'archive')

        // Check database for gates
        const db = getDatabase()

        // Query active gates
        const activeGates = (
          db
            .prepare(
              "SELECT * FROM gates WHERE status NOT IN ('completed', 'cancelled', 'backlog') ORDER BY sequence"
            )
            .all() as {
            id: string
            name: string
            status: string
          }[]
        ).map((gate) => ({
          id: gate.id,
          name: gate.name,
          status: gate.status,
        }))

        // Query completed gates
        let completedGates: string[] = []
        try {
          const archivedFiles = await readdir(archiveDir)
          const archivedGateFiles = archivedFiles.filter((f) => f.startsWith('gate-') && f.endsWith('.md'))
          completedGates = archivedGateFiles.map((f) => f.replace(/\.md$/, ''))
        } catch {
          // Archive directory doesn't exist yet, empty list
        }

        // Get MCP server status
        let mcpStatus = 'unknown'
        let toolsRegistered = 0
        let configLoaded = false

        try {
          const { diagnostics } = await import('../mcp/diagnostics.js')
          const { createFunctionRegistry } = await import('./function-implementations.js')

          const registry = createFunctionRegistry()
          const report = await diagnostics.generateReport(registry)

          mcpStatus = report.health.status
          toolsRegistered = report.health.toolsRegistered
          configLoaded = report.config.configLoaded
        } catch {
          // MCP diagnostics not available
          mcpStatus = 'unavailable'
        }

        return {
          activeGates,
          completedGates,
          mcp: {
            status: mcpStatus,
            toolsRegistered,
            configLoaded,
          },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to get project status: ${message}`)
        throw error
      }
    },
    {
      description: 'Get project status and overview',
      parameters: [],
      returnType: 'ProjectStatusOutput',
      schema: ProjectStatusInputSchema,
    }
  )
}
