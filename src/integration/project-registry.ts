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
  getWorkspaceRoot,
} from '../utils/config.js'
import { initializeDatabase, getDatabase } from '../storage/database.js'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Input schema for project_init
 */
const ProjectInitInputSchema = z.object({
  projectName: z.string().min(1).max(100),
  projectStatement: z.string().min(1),
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
      const projectRoot = getWorkspaceRoot()

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
        const config = getDefaultConfig(input.projectName, input.projectStatement)
        await saveConfig(config, projectRoot)

        // 3. Initialize database
        logger.info('Initializing database...')
        await initializeDatabase(projectRoot, { syncProposals: true, syncRequirements: true })

        // 4. Generate project requirements
        logger.info('Generating project requirements...')
        const reqGen = new RequirementGenerator()
        const requirements = reqGen.generateFromProjectStatement(input.projectStatement)
        logger.info(`Generated ${requirements.length.toString()} project requirements`)

        // 5. Generate gates
        logger.info('Generating project gates...')
        const gatesResult = generateGates(input.projectStatement, undefined, requirements)
        logger.info(
          `Generated ${gatesResult.gates.length.toString()} gates with ${gatesResult.totalComplexity.toString()} total complexity`
        )

        // 6. Generate AGENTS.md
        logger.info('Generating AGENTS.md...')
        const agentsContent = generateAgentsMD(config)
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
        { name: 'projectStatement', type: 'string', description: 'Project statement describing what is being built', required: true },
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
        const projectRoot = getWorkspaceRoot()
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

        // Aggregate requirements by priority and level
        const reqRows = db
          .prepare('SELECT priority, level, COUNT(*) as cnt FROM requirements GROUP BY priority, level')
          .all() as { priority: string; level: string; cnt: number }[]
        const requirements = {
          total: 0,
          byPriority: { must: 0, should: 0, could: 0, wont: 0 } as Record<string, number>,
          byLevel: { project: 0, gate: 0 } as Record<string, number>,
        }
        for (const row of reqRows) {
          requirements.total += row.cnt
          const pVal = requirements.byPriority[row.priority]
          if (pVal !== undefined) requirements.byPriority[row.priority] = pVal + row.cnt
          const lVal = requirements.byLevel[row.level]
          if (lVal !== undefined) requirements.byLevel[row.level] = lVal + row.cnt
        }

        // Aggregate proposals by status
        const propRows = db
          .prepare('SELECT status, COUNT(*) as cnt FROM proposals GROUP BY status')
          .all() as { status: string; cnt: number }[]
        const proposals = {
          total: 0,
          byStatus: { pending: 0, validated: 0, approved: 0, in_progress: 0, completed: 0, rejected: 0 } as Record<string, number>,
        }
        for (const row of propRows) {
          proposals.total += row.cnt
          const sVal = proposals.byStatus[row.status]
          if (sVal !== undefined) proposals.byStatus[row.status] = sVal + row.cnt
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
          requirements,
          proposals,
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
