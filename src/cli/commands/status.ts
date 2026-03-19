/**
 * Status Command
 *
 * Show project overview and current state
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { getGlobalRegistry } from '../../integration/function-implementations.js'

/**
 * Register status command
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show project overview and current state')
    .action(async () => {
      try {
        // Invoke the project_status function via registry
        const registry = getGlobalRegistry()
        const result = await registry.invoke('project_status', {})

        if (!result.success) {
          const errMsg = result.error.message
          logger.error(`failed to get project status: ${errMsg}. run "zeno init" if the project is not initialised.`)
          process.exit(1)
          return
        }

        const data = result.data as {
          activeGates: { id: string; name: string; status: string }[]
          completedGates: string[]
          requirements?: {
            total: number
            byPriority: Record<string, number>
            byLevel: Record<string, number>
          }
          proposals?: {
            total: number
            byStatus: Record<string, number>
          }
          mcp: { status: string; toolsRegistered: number; configLoaded: boolean }
        }

        logger.info('Project Status')
        logger.info('==============')

        // Display active gates
        if (data.activeGates.length > 0) {
          logger.info('Active Gates:')
          for (const gate of data.activeGates) {
            logger.info(`  ${gate.id}: ${gate.name} (${gate.status})`)
          }
        } else {
          logger.info('No active gates found.')
        }

        // Display completed gates
        if (data.completedGates.length > 0) {
          logger.info('Completed Gates:')
          for (const file of data.completedGates.sort()) {
            const match = /gate-(\d+)-(.+)/.exec(file)
            if (!match) continue
            const num = match[1] ?? ''
            const namePart = match[2] ?? ''
            const name = namePart.replace(/-/g, ' ')
            logger.info(`  Gate ${num}: ${name} (completed)`)
          }
        }

        // Display requirements summary
        if (data.requirements) {
          logger.info('Requirements:')
          logger.info(`  Total: ${String(data.requirements.total)}`)
          const p = data.requirements.byPriority
          logger.info(`  By priority: must=${String(p['must'] ?? 0)} should=${String(p['should'] ?? 0)} could=${String(p['could'] ?? 0)} wont=${String(p['wont'] ?? 0)}`)
          const l = data.requirements.byLevel
          logger.info(`  By level: project=${String(l['project'] ?? 0)} gate=${String(l['gate'] ?? 0)}`)
        }

        // Display proposals summary
        if (data.proposals) {
          logger.info('Proposals:')
          logger.info(`  Total: ${String(data.proposals.total)}`)
          const s = data.proposals.byStatus
          const parts: string[] = []
          for (const [key, val] of Object.entries(s)) {
            if (val > 0) parts.push(`${key}=${String(val)}`)
          }
          if (parts.length > 0) logger.info(`  By status: ${parts.join(' ')}`)
        }

        // Display MCP server status
        logger.info('MCP Server Status:')
        logger.info(`  Status: ${data.mcp.status.toUpperCase()}`)
        logger.info(`  Tools Registered: ${String(data.mcp.toolsRegistered)}`)
        logger.info(`  Config Loaded: ${String(data.mcp.configLoaded)}`)
      } catch (error) {
        logger.error(`Failed to get status: ${String(error)}`)
      }
    })
}

