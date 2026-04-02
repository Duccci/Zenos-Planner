/**
 * Refresh Command
 *
 * Re-reconciles all gate PRDs that have drifted from the current template and
 * regenerates the AGENTS.md Zeno-managed block.
 *
 * Usage:
 *   zeno refresh            # reconcile stale gate PRDs and refresh AGENTS.md
 *   zeno refresh --dry-run  # report what would change without writing
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { getWorkspaceRoot, getZenoGitDir, findProjectRoot, loadConfig } from '../../utils/config.js'
import { reconcileGatePRD, computeTemplateHash } from '../../core/gate-prd-reconciler.js'
import { generateAgentsMD } from '../../generation/agents-generator.js'
import { writeAgentsMD } from '../../generation/agents-writer.js'

function extractTemplateHash(content: string): string | null {
  const match = /^\s*template_hash:\s*['"]?([a-f0-9]{16})['"]?\s*$/m.exec(content)
  return match?.[1] ?? null
}

function extractGateId(filename: string): string | null {
  return /^(gate-\d+)/.exec(basename(filename, '.md'))?.[1] ?? null
}

export function registerRefreshCommand(program: Command): void {
  program
    .command('refresh')
    .description('Reconcile stale gate PRDs with the current template and refresh AGENTS.md')
    .option('--dry-run', 'List files that would be updated without writing')
    .action(async (options: { dryRun?: boolean }) => {
      const dryRun = options.dryRun ?? false
      const projectRoot = findProjectRoot(getWorkspaceRoot()) ?? getWorkspaceRoot()

      // ── 1. Locate gates directory ────────────────────────────────────────
      const gatesDir = join(getZenoGitDir(projectRoot), 'gates')
      if (!existsSync(gatesDir)) {
        logger.info('No gates directory found — nothing to refresh.')
        return
      }

      let entries: string[]
      try {
        entries = readdirSync(gatesDir).filter((f) => f.endsWith('.md'))
      } catch (err) {
        logger.error(`Could not read gates directory: ${String(err)}`)
        process.exit(1)
        return
      }

      // ── 2. Compute current template hash ─────────────────────────────────
      let expectedHash: string
      try {
        expectedHash = computeTemplateHash()
      } catch (err) {
        logger.error(`Could not compute template hash: ${String(err)}`)
        process.exit(1)
        return
      }

      // ── 3. Find stale gate PRDs ──────────────────────────────────────────
      const staleGateIds: string[] = []

      for (const filename of entries) {
        const filePath = join(gatesDir, filename)
        const gateId = extractGateId(filename)
        if (!gateId) continue

        try {
          const content = readFileSync(filePath, 'utf-8')
          const fileHash = extractTemplateHash(content)
          if (fileHash !== null && fileHash !== expectedHash) {
            staleGateIds.push(gateId)
          }
        } catch {
          // Unreadable — skip silently
        }
      }

      // ── 4. Reconcile stale PRDs ──────────────────────────────────────────
      if (staleGateIds.length === 0) {
        logger.info(`All gate PRDs are up-to-date (template hash: ${expectedHash}).`)
      } else if (dryRun) {
        logger.info(`Would reconcile ${String(staleGateIds.length)} stale gate PRD(s):`)
        for (const gateId of staleGateIds) {
          logger.info(`  - ${gateId}`)
        }
      } else {
        logger.info(`Reconciling ${String(staleGateIds.length)} stale gate PRD(s)…`)
        for (const gateId of staleGateIds) {
          try {
            await reconcileGatePRD(gateId, projectRoot)
            logger.info(`  ✔ ${gateId}`)
          } catch (err) {
            logger.warn(`  ✖ ${gateId}: ${String(err)}`)
          }
        }
      }

      // ── 5. Refresh AGENTS.md ─────────────────────────────────────────────
      try {
        const config = await loadConfig(projectRoot)
        const innerContent = generateAgentsMD(config)
        if (dryRun) {
          logger.info('Would refresh AGENTS.md (Zeno-managed block).')
        } else {
          const writtenPath = await writeAgentsMD(innerContent, projectRoot)
          logger.info(`Refreshed AGENTS.md → ${writtenPath}`)
        }
      } catch (err) {
        logger.warn(`AGENTS.md refresh skipped: ${String(err)}`)
      }
    })
}
