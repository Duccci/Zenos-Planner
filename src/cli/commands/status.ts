/**
 * Status Command
 *
 * Show project overview and current state
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'

/**
 * Register status command
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show project overview and current state')
    .action(() => {
      logger.info('Status command')
      logger.info('Not yet implemented - Gate 2 required')
      logger.info('This command will display:')
      logger.info('  - Current gate status')
      logger.info('  - Proposal progress')
      logger.info('  - Requirement completion')
      logger.info('  - Quality metrics')
    })
}
