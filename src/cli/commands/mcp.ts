/**
 * MCP Server Commands
 *
 * CLI commands for running the MCP server.
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'

/**
 * Register MCP commands
 */
export function registerMcpCommands(program: Command): void {
  logger.debug('Registering MCP commands')
  const mcpCommand = program.command('mcp').description('Model Context Protocol server commands')

  mcpCommand
    .command('diagnostics')
    .description('Run MCP server diagnostics')
    .action(async () => {
      try {
        const { diagnostics } = await import('../../mcp/diagnostics.js')
        const { createFunctionRegistry } =
          await import('../../integration/function-implementations.js')

        const registry = createFunctionRegistry()
        const formatted = await diagnostics.formatReport(registry)

        console.log(formatted)
      } catch (error) {
        logger.error('Failed to run diagnostics:', error)
        process.exit(1)
      }
    })

  mcpCommand
    .command('tools')
    .description('List all registered MCP tools')
    .action(async () => {
      try {
        const { createFunctionRegistry } =
          await import('../../integration/function-implementations.js')

        const registry = createFunctionRegistry()
        const tools = registry.list()

        console.log('=== Registered MCP Tools ===')
        for (const tool of tools) {
          console.log(`${tool.name}: ${tool.description}`)
          console.log(`  Parameters: ${tool.parameters.map((p) => p.name).join(', ')}`)
          console.log()
        }
      } catch (error) {
        logger.error('Failed to list tools:', error)
        process.exit(1)
      }
    })

  mcpCommand
    .command('errors')
    .description('Show recent errors with context')
    .option('-c, --count <number>', 'Number of errors to show', '10')
    .action(async (opts: { count: string }) => {
      try {
        const { diagnostics } = await import('../../mcp/diagnostics.js')

        const count = parseInt(opts.count, 10) || 10
        const errors = diagnostics.getRecentErrors().slice(0, count)

        console.log('=== Recent MCP Errors ===')
        if (errors.length === 0) {
          console.log('No recent errors')
        } else {
          for (const error of errors) {
            console.log(`${error.timestamp.toISOString()}: ${error.function} - ${error.error}`)
          }
        }
      } catch (error) {
        logger.error('Failed to get errors:', error)
        process.exit(1)
      }
    })

  mcpCommand
    .command('install')
    .description('Install MCP configuration (auto-detects workspace topology)')
    .option('--server-name <name>', 'Override the MCP server key')
    .option('--dry-run', 'Do not modify files, only show actions')
    .action(async (opts: {
      serverName?: string
      dryRun?: boolean
    }) => {
      try {
        const { installMcpConfig } = await import('../../mcp/editor-adapters.js')
        const { findProjectRoot, getWorkspaceRoot, loadConfig, saveConfig } = await import('../../utils/config.js')

        const projectRoot = findProjectRoot(getWorkspaceRoot()) ?? process.cwd()

        const result = await installMcpConfig(projectRoot, {
          serverName: opts.serverName,
          dryRun: opts.dryRun,
        })

        if (opts.dryRun) {
          console.log('Dry run: no files modified.')
          process.exit(0)
        }

        if (result.written) {
          console.log(`[mcp-install] Wrote MCP entry '${result.serverName}' to ${result.targetPath}`)
        } else {
          console.log(`[mcp-install] MCP entry '${result.serverName}' already up to date in ${result.targetPath}`)
        }

        // Persist server name back to config if it changed.
        try {
          const cfg = await loadConfig(projectRoot)
          if (cfg.zenoServerName !== result.serverName) {
            cfg.zenoServerName = result.serverName
            await saveConfig(cfg, projectRoot)
          }
        } catch {
          // Config may not exist yet — skip persistence.
        }

        console.log('[mcp-install] Editor MCP config installed.')
        console.log('[mcp-install] The editor will start the MCP server automatically via stdio.')
        process.exit(0)
      } catch (error) {
        logger.error('Failed to run mcp install:', error)
        process.exit(1)
      }
    })

  mcpCommand
    .command('stop')
    .description('Stop a running background MCP server')
    .action(async () => {
      try {
        const { stopServer } = await import('../../mcp/manager.js')
        const stopped = stopServer(process.cwd())
        if (stopped) {
          console.log('[mcp-stop] MCP server stopped')
        } else {
          console.log('[mcp-stop] No running MCP server found')
        }
      } catch (error) {
        logger.error('Failed to stop MCP server:', error)
        process.exit(1)
      }
    })
}
