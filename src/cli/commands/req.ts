/**
 * Requirements Command Category
 *
 * Commands for querying and managing requirements.
 * Database presence equals approval; progress tracked via Git.
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { getGlobalRegistry } from '../../integration/function-implementations.js'
import type { RequirementSummary } from '../../mcp/schemas/requirement-schemas.js'

/**
 * Register requirements commands
 */
export function registerReqCommands(program: Command): void {
  const reqCmd = program
    .command('req')
    .description('Manage requirements')
    .alias('requirement')
    .alias('requirements')

  reqCmd
    .command('list')
    .description('List requirements')
    .option('--gate <gate-id>', 'Filter by gate')
    .option('--project', 'Show project-level requirements')
    .action(async (options: { gate?: string; project?: boolean }) => {
      try {
        const registry = getGlobalRegistry()
        const params: { gateId?: string } = {}
        if (options.gate) {
          params.gateId = options.gate
        }
        const result = await registry.invoke('reg_action', { action: 'list', payload: params })
        if (result.success) {
          const data = result.data as { requirements?: RequirementSummary[] }
          const requirements = data.requirements ?? []
          logger.info(`Requirements (${String(requirements.length)}):`)
          for (const req of requirements) {
            logger.info(`  ${req.hash}: ${req.title}`)
          }
        } else {
          logger.error('Failed to list requirements:', result.error)
        }
      } catch (error) {
        logger.error('Error listing requirements:', error)
      }
    })

  reqCmd
    .command('show <hash>')
    .description('Show requirement details')
    .action(async (hash: string) => {
      try {
        const registry = getGlobalRegistry()
        const result = await registry.invoke('reg_action', { action: 'show', payload: { hash } })
        if (result.success) {
          const data = result.data as {
            requirement?: {
              hash?: string
              description?: string
              type?: string
              priority?: string
              projectId?: string
              gateId?: string
              parentId?: string
              acceptanceCriteria?: string
            }
          }
          const req = data.requirement
          if (req?.hash) {
            logger.info(`Requirement: ${req.hash}`)
            logger.info(`Description: ${req.description ?? ''}`)
            logger.info(`Type: ${req.type ?? ''}`)
            logger.info(`Priority: ${req.priority ?? ''}`)
            logger.info(`Project: ${req.projectId ?? ''}`)
            if (req.gateId) logger.info(`Gate: ${req.gateId}`)
            if (req.parentId) logger.info(`Parent: ${req.parentId}`)
            if (req.acceptanceCriteria) logger.info(`Acceptance: ${req.acceptanceCriteria}`)
          } else {
            logger.error(`Requirement not found: ${hash}. Run "zeno req list" to see available requirements.`)
          }
        } else {
          logger.error('Failed to show requirement:', result.error)
        }
      } catch (error) {
        logger.error(`Error showing requirement ${hash}: ${error instanceof Error ? error.message : String(error)}`)
      }
    })

  reqCmd
    .command('deps <hash>')
    .description('Show requirement dependency graph')
    .action(async (hash: string) => {
      try {
        const registry = getGlobalRegistry()
        const result = await registry.invoke('reg_action', { action: 'deps', payload: { hash } })
        if (result.success) {
          const graph = (result.data as { graph?: unknown }).graph
          if (graph) {
            logger.info(`Dependency graph for ${hash}:`)
            // Simple text representation
            logger.info(JSON.stringify(graph, null, 2))
          } else {
            logger.error(`No dependency graph found for requirement ${hash}`)
          }
        } else {
          logger.error('Failed to get dependencies:', result.error)
        }
      } catch (error) {
        logger.error(`Error getting dependencies for ${hash}: ${error instanceof Error ? error.message : String(error)}`)
      }
    })

  reqCmd
    .command('transfer <hash> <gate-id>')
    .description('Transfer requirement to another gate')
    .action(async (hash: string, gateId: string) => {
      try {
        const registry = getGlobalRegistry()
        const result = await registry.invoke('reg_action', {
          action: 'transfer',
          payload: { hash, gateId },
        })
        if (result.success) {
          logger.info(`Requirement ${hash} transferred to gate ${gateId}`)
        } else {
          logger.error('Failed to transfer requirement:', result.error)
        }
      } catch (error) {
        logger.error(`Error transferring requirement ${hash}: ${error instanceof Error ? error.message : String(error)}`)
      }
    })

  reqCmd
    .command('update <hash>')
    .description('Update mutable fields of a requirement')
    .option('--title <text>', 'New title / description')
    .option('--type <type>', 'New type: functional | non_functional | constraint')
    .option('--priority <priority>', 'New priority: must | should | could | wont')
    .option('--acceptance <text>', 'New acceptance criteria')
    .action(
      async (
        hash: string,
        options: { title?: string; type?: string; priority?: string; acceptance?: string }
      ) => {
        try {
          const registry = getGlobalRegistry()
          const result = await registry.invoke('reg_action', {
            action: 'update',
            payload: {
              hash,
              ...(options.title !== undefined && { title: options.title }),
              ...(options.type !== undefined && { type: options.type }),
              ...(options.priority !== undefined && { priority: options.priority }),
              ...(options.acceptance !== undefined && { acceptance: options.acceptance }),
            },
          })
          if (result.success) {
            const data = result.data as { message?: string }
            logger.info(data.message ?? `Requirement ${hash} updated`)
          } else {
            logger.error(`Failed to update requirement ${hash}: ${result.error instanceof Object ? JSON.stringify(result.error) : String(result.error)}`)
          }
        } catch (error) {
          logger.error(`Error updating requirement ${hash}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    )

  reqCmd
    .command('search <query>')
    .description('Search requirements by keyword')
    .option('--gate <gate-id>', 'Filter by gate')
    .option('--type <type>', 'Filter by requirement type')
    .action(
      async (
        query: string,
        options: { gate?: string; type?: string }
      ) => {
        try {
          const registry = getGlobalRegistry()
          const result = await registry.invoke('reg_action', {
            action: 'search',
            payload: {
              query,
              gateId: options.gate,
              type: options.type,
            },
          })
          if (result.success) {
            const data = result.data as
              | { requirements?: { hash: string; title?: string; description?: string; gateId?: string }[]; total?: number }
              | undefined
            const requirements = data?.requirements ?? []
            const total = data?.total ?? requirements.length
            logger.info(
              `Search results for "${query}" (${String(requirements.length)}/${String(total)}):`
            )
            for (const req of requirements) {
              const gateInfo = req.gateId ? ` [${req.gateId}]` : ' [project]'
              logger.info(`  ${req.hash}: ${req.title ?? req.description ?? ''}${gateInfo}`)
            }
          } else {
            logger.error(`Failed to search requirements: ${result.error instanceof Object ? JSON.stringify(result.error) : String(result.error)}`)
          }
        } catch (error) {
          logger.error(`Error searching requirements: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    )
}
