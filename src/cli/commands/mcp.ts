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
    .description('Install MCP configuration and start the MCP server in the background')
    .option('--editor <editor>', 'Editor to target (vscode|cursor|windsurf|all)', 'vscode')
    .option('--dry-run', 'Do not modify files, only show actions')
    .action(async (opts: { editor: string; dryRun?: boolean }) => {
      try {
        const { ensureWorkspaceMcp, isZenoInstalled } = await import('../../mcp/editor-adapters.js')

        const projectRoot = process.cwd()

        // Check if Zeno is installed first
        const zeroInstallCheck = isZenoInstalled(projectRoot)
        if (!zeroInstallCheck.valid) {
          const reason = zeroInstallCheck.reason ?? 'Unknown reason'
          logger.error(`Zeno is not properly installed: ${reason}`)
          console.error(`Error: ${reason}`)
          console.error('Please ensure Zeno is installed by running: npm install')
          process.exit(1)
        }

        if (opts.dryRun) {
          console.log('Dry run: actions that would be performed:')
          console.log(`  - Ensure workspace .vscode/mcp.json exists`)
          process.exit(0)
        }

        const written = ensureWorkspaceMcp(projectRoot)
        if (written) console.log('[mcp-install] Wrote .vscode/mcp.json to workspace')
        else console.log('[mcp-install] Workspace MCP config already exists')

        // Note: The MCP server is launched by the editor via mcp.json stdio config.
        // We no longer spawn a detached background server here — that caused orphaned
        // node processes to accumulate because each `mcp install` call spawned a new
        // child without checking if one was already running, and detached processes
        // on Windows are not reliably cleaned up via SIGINT/SIGTERM.
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
