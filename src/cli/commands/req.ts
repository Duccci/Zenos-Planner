/**
 * Requirements Command Category
 *
 * Commands for managing requirements (pending -> implemented -> tested)
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'

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
    .action((options: { gate?: string; project?: boolean }) => {
      logger.info('Requirements command: list')
      if (options.gate) {
        logger.info(`  Filter: gate ${options.gate}`)
      }
      if (options.project) {
        logger.info('  Filter: project-level')
      }
      logger.info('Not yet implemented - Gate 3 required')
      logger.info('This command will list requirements with status and dependencies')
    })

  reqCmd
    .command('show <hash>')
    .description('Show requirement details')
    .action((hash: string) => {
      logger.info(`Requirements command: show ${hash}`)
      logger.info('Not yet implemented - Gate 3 required')
      logger.info('This command will display requirement details including parent refs')
    })

  reqCmd
    .command('deps <hash>')
    .description('Show requirement dependency graph')
    .action((hash: string) => {
      logger.info(`Requirements command: deps ${hash}`)
      logger.info('Not yet implemented - Gate 3 required')
      logger.info('This command will display dependency graph for a requirement')
    })



  reqCmd
    .command('transfer <hash> <gate-id>')
    .description('Transfer requirement to another gate')
    .action((hash: string, gateId: string) => {
      logger.info(`Requirements command: transfer ${hash} ${gateId}`)
      logger.info('Not yet implemented - Gate 3 required')
      logger.info('This command will transfer a requirement between gates')
    })
}
