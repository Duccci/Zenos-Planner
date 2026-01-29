/**
 * Gates Command Category
 *
 * Commands for managing gates (pending -> in_progress -> completed)
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { completeGate } from '../../core/completions.js'

/**
 * Register gates commands
 */
export function registerGatesCommands(program: Command): void {
  const gatesCmd = program
    .command('gates')
    .description('Manage project gates (milestones)')
    .alias('gate')

  gatesCmd
    .command('list')
    .description('List all gates')
    .action(() => {
      logger.info('Gates command: list')
      logger.info('Not yet implemented - Gate 2 required')
      logger.info('This command will list all gates with their status and sequence')
    })

  gatesCmd
    .command('show <gate-id>')
    .description('Show gate details')
    .action((gateId: string) => {
      logger.info(`Gates command: show ${gateId}`)
      logger.info('Not yet implemented - Gate 2 required')
      logger.info('This command will display gate PRD, requirements, and proposal status')
    })

  gatesCmd
    .command('start <gate-id>')
    .description('Start a gate (status: pending -> in_progress)')
    .action((gateId: string) => {
      logger.info(`Gates command: start ${gateId}`)
      logger.info('Not yet implemented - Gate 2 required')
      logger.info('This command will generate gate-specific requirements and proposals')
    })

  gatesCmd
    .command('complete <gate-id>')
    .description('Complete a gate (status: -> completed, creates tag)')
    .option('--push', 'Push commit/tag to remote after completion (if configured)')
    .action(async (gateId: string, options: { push?: boolean }) => {
      const result = await completeGate(gateId, { push: options.push })
      logger.info(`Gate completed: ${result.gateId} - ${result.gateName}`)
      logger.info(`Version: ${result.previousVersion} -> ${result.newVersion} (${result.bump})`)
    })

  gatesCmd
    .command('regenerate')
    .description('Regenerate future gates')
    .action(() => {
      logger.info('Gates command: regenerate')
      logger.info('Not yet implemented - Gate 2 required')
      logger.info('This command will regenerate gates based on current project state')
    })
}
