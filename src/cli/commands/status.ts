/**
 * Status Command
 *
 * Show project overview and current state
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { getDatabase } from '../../storage/database.js'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Register status command
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show project overview and current state')
    .action(async () => {
      try {
        const projectRoot = process.cwd()
        const zenoDir = join(projectRoot, 'zeno')
        const gatesDir = join(zenoDir, 'gates')
        const archiveDir = join(gatesDir, 'archive')

        logger.info('Project Status')
        logger.info('==============')

        // Check database for active gates
        const db = getDatabase()
        const activeGates = db
          .prepare("SELECT * FROM gates WHERE status NOT IN ('completed', 'cancelled', 'backlog') ORDER BY sequence")
          .all() as {
          id: string
          name: string
          status: string
        }[]

        if (activeGates.length > 0) {
          logger.info('Active Gates:')
          for (const gate of activeGates) {
            logger.info(`  ${gate.id}: ${gate.name} (${gate.status})`)
          }
        } else {
          logger.info('No active gates found.')
        }

        // Check cancelled gates
        const cancelledGates = db
          .prepare("SELECT * FROM gates WHERE status = 'cancelled' ORDER BY sequence")
          .all() as {
          id: string
          name: string
          status: string
        }[]

        if (cancelledGates.length > 0) {
          logger.info('Cancelled Gates:')
          for (const gate of cancelledGates) {
            logger.info(`  ${gate.id}: ${gate.name} (cancelled)`)
          }
        }

        // Check backlog gates
        const backlogGates = db
          .prepare("SELECT * FROM gates WHERE status = 'backlog' ORDER BY sequence")
          .all() as {
          id: string
          name: string
          status: string
        }[]

        if (backlogGates.length > 0) {
          logger.info('Backlog Gates (deferred):')
          for (const gate of backlogGates) {
            logger.info(`  ${gate.id}: ${gate.name} (backlog)`)
          }
        }

        // Check cancelled proposals
        const cancelledProposals = db
          .prepare("SELECT id, gate_id, title, hash FROM proposals WHERE status = 'cancelled' ORDER BY created_at DESC")
          .all() as {
          id: string
          gate_id: string | null
          title: string
          hash: string
        }[]

        if (cancelledProposals.length > 0) {
          logger.info('Cancelled Proposals:')
          for (const proposal of cancelledProposals) {
            logger.info(`  #${proposal.hash.slice(0, 8)} [${proposal.gate_id ?? 'solitary'}] ${proposal.title}`)
          }
        }

        // Check backlog proposals
        const backlogProposals = db
          .prepare("SELECT id, gate_id, title, hash FROM proposals WHERE status = 'backlog' ORDER BY created_at DESC")
          .all() as {
          id: string
          gate_id: string | null
          title: string
          hash: string
        }[]

        if (backlogProposals.length > 0) {
          logger.info('Backlog Proposals (deferred):')
          for (const proposal of backlogProposals) {
            logger.info(`  #${proposal.hash.slice(0, 8)} [${proposal.gate_id ?? 'solitary'}] ${proposal.title}`)
          }
        }

        // Check archived gates
        let archivedFiles: string[] = []
        try {
          archivedFiles = await readdir(archiveDir)
        } catch (error) {
          logger.warn(`Failed to read archive dir ${archiveDir}: ${String(error)}`)
        }
        const archivedGates = archivedFiles.filter(
          (f) => f.startsWith('gate-') && f.endsWith('.md')
        )

        if (archivedGates.length > 0) {
          logger.info('Completed Gates:')
          for (const file of archivedGates.sort()) {
            const match = /gate-(\d+)-(.+)\.md/.exec(file)
            if (!match) continue
            const num = match[1] ?? ''
            const namePart = match[2] ?? ''
            const name = namePart.replace(/-/g, ' ')
            logger.info(`  Gate ${num}: ${name} (completed)`)
          }
        }

        // TODO: Add proposal progress, requirement completion, quality metrics

        // Try to get MCP server status
        try {
          const { diagnostics } = await import('../../mcp/diagnostics.js')
          const { createFunctionRegistry } =
            await import('../../integration/function-implementations.js')

          const registry = createFunctionRegistry()
          const report = await diagnostics.generateReport(registry)

          const statusLabel = report.health.status.toUpperCase()
          const toolsRegistered = String(report.health.toolsRegistered)
          const configLoaded = String(report.config.configLoaded)

          logger.info('MCP Server Status:')
          logger.info(`  Status: ${statusLabel}`)
          logger.info(`  Tools Registered: ${toolsRegistered}`)
          logger.info(`  Config Loaded: ${configLoaded}`)
        } catch {
          logger.warn('MCP server status not available (server not running or not configured)')
        }
      } catch (error) {
        logger.error(`Failed to get status: ${String(error)}`)
      }
    })
}
