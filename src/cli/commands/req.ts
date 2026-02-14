/**
 * Requirements Command Category
 *
 * Commands for querying and managing requirements.
 * Database presence equals approval; progress tracked via Git.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-assignment */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { getGlobalRegistry } from '../../integration/function-implementations.js'

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
        const result = await registry.invoke('req_action', { action: 'list', payload: params })
        if (result.success) {
          const requirements = ((result.data as any)?.requirements as any[]) || []
          logger.info(`Requirements (${requirements.length}):`)
          for (const req of requirements) {
            const gateInfo = req.gateId ? ` [${req.gateId as string}]` : ' [project]'
            logger.info(`  ${req.hash as string}: ${req.description as string}${gateInfo}`)
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
        const result = await registry.invoke('req_action', { action: 'show', payload: { hash } })
        if (result.success) {
          const req = (result.data as any)?.requirement
          if (req) {
            logger.info(`Requirement: ${req.hash as string}`)
            logger.info(`Description: ${req.description as string}`)
            logger.info(`Type: ${req.type as string}`)
            logger.info(`Priority: ${req.priority as string}`)
            logger.info(`Project: ${req.projectId as string}`)
            if (req.gateId) logger.info(`Gate: ${req.gateId as string}`)
            if (req.parentId) logger.info(`Parent: ${req.parentId as string}`)
            if (req.acceptanceCriteria)
              logger.info(`Acceptance: ${req.acceptanceCriteria as string}`)
          } else {
            logger.error('Requirement not found')
          }
        } else {
          logger.error('Failed to show requirement:', result.error)
        }
      } catch (error) {
        logger.error('Error showing requirement:', error)
      }
    })

  reqCmd
    .command('deps <hash>')
    .description('Show requirement dependency graph')
    .action(async (hash: string) => {
      try {
        const registry = getGlobalRegistry()
        const result = await registry.invoke('req_action', { action: 'deps', payload: { hash } })
        if (result.success) {
          const graph = (result.data as { graph?: unknown })?.graph
          if (graph) {
            logger.info(`Dependency graph for ${hash}:`)
            // Simple text representation
            logger.info(JSON.stringify(graph, null, 2))
          } else {
            logger.error('No dependency graph found')
          }
        } else {
          logger.error('Failed to get dependencies:', result.error)
        }
      } catch (error) {
        logger.error('Error getting dependencies:', error)
      }
    })

  reqCmd
    .command('transfer <hash> <gate-id>')
    .description('Transfer requirement to another gate')
    .action(async (hash: string, gateId: string) => {
      try {
        const registry = getGlobalRegistry()
        const result = await registry.invoke('req_action', {
          action: 'transfer',
          payload: { hash, gateId },
        })
        if (result.success) {
          logger.info(`Requirement ${hash} transferred to gate ${gateId}`)
        } else {
          logger.error('Failed to transfer requirement:', result.error)
        }
      } catch (error) {
        logger.error('Error transferring requirement:', error)
      }
    })
}
