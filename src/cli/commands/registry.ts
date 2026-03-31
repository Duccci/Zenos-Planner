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
import { loadConfig } from '../../utils/config.js'

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
        // 0. Load config to set zenoDir cache so sync functions use correct paths
        try {
          await loadConfig(projectRoot)
        } catch (error) {
          // Non-fatal: config may not exist on fresh projects
          logger.debug(
            `Config load failed (may be expected on fresh project): ${error instanceof Error ? error.message : String(error)}`
          )
        }

        // 1. Ensure DB exists with latest schema
        await initializeDatabase(projectRoot)
        const db = getDatabase(projectRoot)

        // 2. Gates — must run first (proposals FK → gates)
        logger.info('Syncing gates from disk…')
        const { syncGatesFromDisk, syncPlannedGatesFromState } = await import('../../storage/gate-sync.js')
        const gateResult = syncGatesFromDisk(db, projectRoot)
        logger.info(
          `  gates: ${String(gateResult.synced)} inserted, ${String(gateResult.skipped)} skipped`
        )

        // 2b. Planned gates (no MD file yet) — seeded from git-tracked project.json
        logger.info('Syncing planned gates from project.json…')
        const plannedResult = syncPlannedGatesFromState(db, projectRoot)
        logger.info(
          `  planned gates: ${String(plannedResult.synced)} inserted, ${String(plannedResult.skipped)} skipped`
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
        const { syncRequirementsFromDisk } =
          await import('../../storage/requirements-sync.js')
        const reqResult = syncRequirementsFromDisk(db, projectRoot)
        // NOTE: Do NOT call writeRequirementsManifest here.  The manifest is
        // the version-controlled source of truth; writing it back during rebuild
        // would drop gate-level requirements (the writer only persists
        // level='project' rows) and destroy data that was just read in.
        if (!reqResult.found) {
          logger.warn(`  requirements: manifest not found at ${reqResult.manifestPath}`)
        } else if (reqResult.synced === 0 && reqResult.inManifest > 0) {
          logger.info(
            `  requirements: ${String(reqResult.inManifest)} already in registry (0 new rows from manifest), path: ${reqResult.manifestPath}`
          )
        } else {
          logger.info(
            `  requirements: ${String(reqResult.synced)} inserted from manifest (${String(reqResult.inManifest)} in file), path: ${reqResult.manifestPath}`
          )
        }
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
