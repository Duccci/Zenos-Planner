/**
 * Database maintenance commands
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { getDatabasePath } from '../../storage/database.js'
import { cleanupStaleFiles, validateDatabaseIntegrity } from '../../storage/database-cleanup.js'
import { checkpointWAL } from '../../storage/database.js'

export function registerDbCommands(program: Command): void {
  const db = program.command('db').description('Database maintenance commands')

  db.command('cleanup')
    .description('Remove stale WAL/SHM files for the database')
    .option('--path <path>', 'Path to .db file (defaults to project registry DB)')
    .action((options: { path?: string }) => {
      try {
        const path = options.path ?? getDatabasePath()
        const res = cleanupStaleFiles(path)

        if (res.deleted === 0) {
          logger.info('No stale files removed')
        } else {
          logger.info(`Removed ${String(res.deleted)} stale file(s):`)
          for (const f of res.files) logger.info(`  - ${f}`)
        }
      } catch (error) {
        logger.error('DB cleanup command failed', error instanceof Error ? error : undefined)
        process.exit(1)
      }
    })

  db.command('validate')
    .description('Run integrity and foreign key checks on the database')
    .option('--path <path>', 'Path to .db file (defaults to project registry DB)')
    .action((options: { path?: string }) => {
      try {
        const res = validateDatabaseIntegrity(options.path)

        if (res.integrityOk) {
          logger.info('Database integrity: OK')
        } else {
          logger.warn('Database integrity: ISSUES FOUND')
          logger.info('Integrity output:')
          for (const l of res.integrityOutput) logger.info(`  - ${l}`)
          if (res.foreignKeyViolations.length > 0) {
            logger.info('Foreign key violations:')
            for (const v of res.foreignKeyViolations) logger.info(`  - ${JSON.stringify(v)}`)
          }
          process.exit(2)
        }
      } catch (error) {
        logger.error('DB validate command failed', error instanceof Error ? error : undefined)
        process.exit(1)
      }
    })

  db.command('checkpoint')
    .description('Force a WAL checkpoint (PRAGMA wal_checkpoint(TRUNCATE))')
    .action(() => {
      try {
        const result = checkpointWAL()
        if (result.status === 'ok') {
          logger.info('WAL checkpoint: OK')
        } else {
          logger.warn(`WAL checkpoint: ${result.status} - ${result.detail ?? ''}`)
          process.exit(2)
        }
      } catch (error) {
        logger.error('DB checkpoint command failed', error instanceof Error ? error : undefined)
        process.exit(1)
      }
    })
}
