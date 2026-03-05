/**
 * Registry commands
 *
 * `zeno registry rebuild` — Reconstructs the gitignored SQLite registry
 * (`.zeno/registry.db`) from the version-controlled source files:
 *
 *   1. Gate markdown files   (`zeno/gates/*.md`)       → `gates` table
 *   2. Proposal markdown files (`zeno/proposals/**`)   → `proposals` table
 *   3. Requirements manifest  (`zeno/.zeno/requirements.json`) → `requirements` table
 *
 * Intended for fresh clones, CI environments, and post-`git reset` recovery.
 * Idempotent: existing rows are never overwritten — only missing rows are added.
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { getDatabase, initializeDatabase } from '../../storage/database.js'

export function registerRegistryCommands(program: Command): void {
  const registry = program.command('registry').description('Registry maintenance commands')

  registry
    .command('rebuild')
    .description(
      'Rebuild the SQLite registry from version-controlled markdown and JSON files.\n' +
      'Safe to run on an existing database — only missing rows are inserted.'
    )
    .option('--project-root <path>', 'Project root directory (defaults to cwd)')
    .action(async (options: { projectRoot?: string }) => {
      const projectRoot = options.projectRoot ?? process.cwd()

      try {
        // 1. Ensure DB exists with latest schema
        await initializeDatabase(projectRoot)
        const db = getDatabase(projectRoot)

        // 2. Gates — must run first (proposals FK → gates)
        logger.info('Syncing gates from disk…')
        const { syncGatesFromDisk } = await import('../../storage/gate-sync.js')
        const gateResult = syncGatesFromDisk(db, projectRoot)
        logger.info(
          `  gates: ${String(gateResult.synced)} inserted, ${String(gateResult.skipped)} skipped`
        )

        // 3. Proposals — depends on gate rows existing
        logger.info('Syncing proposals from disk…')
        const { syncProposalsFromDisk } = await import('../../storage/proposal-sync.js')
        syncProposalsFromDisk(db, projectRoot)
        const proposalCount = (
          db.prepare('SELECT COUNT(*) AS n FROM proposals').get() as { n: number }
        ).n
        logger.info(`  proposals: ${String(proposalCount)} total in registry`)

        // 4. Requirements — restored from requirements.json manifest
        logger.info('Syncing requirements from disk…')
        const { syncRequirementsFromDisk, writeRequirementsManifest } =
          await import('../../storage/requirements-sync.js')
        syncRequirementsFromDisk(db, projectRoot)
        // Re-write manifest so it reflects any requirements that were in the DB
        // but not yet in the file (e.g., generated mid-session).
        writeRequirementsManifest(db, projectRoot)
        const reqCount = (
          db.prepare('SELECT COUNT(*) AS n FROM requirements').get() as { n: number }
        ).n
        logger.info(`  requirements: ${String(reqCount)} total in registry`)

        logger.info('Registry rebuild complete.')
      } catch (error) {
        logger.error(
          `Registry rebuild failed: ${error instanceof Error ? error.message : String(error)}`
        )
        process.exit(1)
      }
    })
}
