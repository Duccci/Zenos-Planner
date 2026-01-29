/**
 * Show Command
 *
 * Resolve hash reference to entity
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'

/**
 * Register show command
 */
export function registerShowCommand(program: Command): void {
  program
    .command('show <hash>')
    .description('Resolve hash reference to entity (gate, requirement, proposal)')
    .action((hash: string) => {
      logger.info(`Show command: ${hash}`)
      logger.info('Not yet implemented - Gate 3 required')
      logger.info('This command will resolve a hash to its entity and display details')
      logger.info('Supports: gates, requirements, proposals, repositories')
    })
}
