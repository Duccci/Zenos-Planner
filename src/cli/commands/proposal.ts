/**
 * Proposal Command Category
 *
 * Commands for managing implementation proposals
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { approveProposal } from '../../core/completions.js'

/**
 * Register proposal commands
 */
export function registerProposalCommands(program: Command): void {
  const proposalCmd = program
    .command('proposal')
    .description('Manage implementation proposals')
    .alias('prop')
    .alias('proposals')

  proposalCmd
    .command('list')
    .description('List proposals')
    .option('--gate <gate-id>', 'Filter by gate')
    .option('--status <status>', 'Filter by status (pending/in_progress/completed/rejected)')
    .action((options: { gate?: string; status?: string }) => {
      logger.info('Proposal command: list')
      if (options.gate) {
        logger.info(`  Filter: gate ${options.gate}`)
      }
      if (options.status) {
        logger.info(`  Filter: status ${options.status}`)
      }
      logger.info('Not yet implemented - Gate 2 required')
      logger.info('This command will list proposals with their status and requirements')
    })

  proposalCmd
    .command('show <hash>')
    .description('Show proposal details')
    .action((hash: string) => {
      logger.info(`Proposal command: show ${hash}`)
      logger.info('Not yet implemented - Gate 2 required')
      logger.info('This command will display proposal details including tasks and dependencies')
    })

  proposalCmd
    .command('start <hash>')
    .description('Start implementation (status: pending -> in_progress)')
    .action((hash: string) => {
      logger.info(`Proposal command: start ${hash}`)
      logger.info('Not yet implemented - Gate 2 required')
      logger.info('This command will mark a proposal as in progress')
    })

  proposalCmd
    .command('validate <hash>')
    .description('Run automated checks on proposal')
    .action((hash: string) => {
      logger.info(`Proposal command: validate ${hash}`)
      logger.info('Not yet implemented - Gate 2 required')
      logger.info('This command will run lint, type, test, coverage, and security checks')
    })

  proposalCmd
    .command('approve <hash>')
    .description('Approve proposal (status: -> completed)')
    .option('--push', 'Push commit/tag to remote after completion (if configured)')
    .action(async (hash: string, options: { push?: boolean }) => {
      const result = await approveProposal(hash, { push: options.push })
      logger.info(`Proposal completed: #${result.proposalHash}`)
      logger.info(`Gate: ${result.gateId}`)
      logger.info(`Version: ${result.previousVersion} -> ${result.newVersion}`)
    })

  proposalCmd
    .command('reject <hash>')
    .description('Reject proposal (status: -> rejected)')
    .action((hash: string) => {
      logger.info(`Proposal command: reject ${hash}`)
      logger.info('Not yet implemented - Gate 2 required')
      logger.info('This command will mark a proposal as rejected')
    })
}
