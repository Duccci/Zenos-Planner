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
          .prepare('SELECT * FROM gates WHERE status != ? ORDER BY sequence')
          .all('completed') as {
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
