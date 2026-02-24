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
          logger.error(`Failed to get status: ${JSON.stringify(result.error)}`)
          process.exit(1)
          return
        }

        const data = result.data as {
          activeGates: { id: string; name: string; status: string }[]
          completedGates: string[]
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

