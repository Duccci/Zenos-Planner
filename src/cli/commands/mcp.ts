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
  console.log('Registering MCP commands')
  const mcpCommand = program
    .command('mcp')
    .description('Model Context Protocol server commands')

  mcpCommand
    .command('diagnostics')
    .description('Run MCP server diagnostics')
    .action(async () => {
      try {
        const { diagnostics } = await import('../../mcp/diagnostics.js')
        const { createFunctionRegistry } = await import('../../integration/function-implementations.js')

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
        const { createFunctionRegistry } = await import('../../integration/function-implementations.js')

        const registry = createFunctionRegistry()
        const tools = registry.list()

        console.log('=== Registered MCP Tools ===')
        for (const tool of tools) {
          console.log(`${tool.name}: ${tool.description}`)
          console.log(`  Parameters: ${tool.parameters.map(p => p.name).join(', ')}`)
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

  // Install helper for editors: writes mcp.json workspace file or user-level file
  mcpCommand
    .command('install')
    .description('Install MCP configuration and optional editor helpers')
    .option('--editor <editor>', 'Editor to target (vscode|cursor|windsurf|all)', 'all')
    .option('--global', 'Install at user global level instead of workspace')
    .option('--dry-run', 'Do not modify files, only show actions')
    .action(async (opts: { editor: string; global?: boolean; dryRun?: boolean }) => {
      try {
        const { ensureWorkspaceMcp, getAdapterCommand } = await import('../../mcp/editor-adapters.js')
        const projectRoot = process.cwd()

        if (opts.dryRun) {
          console.log('Dry run: actions that would be performed:')
          console.log(`  - Ensure workspace .vscode/mcp.json exists`) 
          console.log(`  - Adapter activation command for ${opts.editor}: ${getAdapterCommand(opts.editor as any, projectRoot)}`)
          process.exit(0)
        }

        if (opts.global) {
          console.log('Global installation requested. Please run platform-specific steps to write to your editor user settings.')
          // Keep it intentionally minimal; full global install requires admin privileges and platform checks
          process.exit(0)
        }

        const written = ensureWorkspaceMcp(projectRoot)
        if (written) console.log('Wrote .vscode/mcp.json to workspace (recommended)')
        else console.log('Workspace already contains .vscode/mcp.json; no changes made')

        // Show installation URL for VSCode
        if (opts.editor === 'vscode' || opts.editor === 'all') {
          const { getVSCodeInstallUrl } = await import('../../mcp/editor-adapters.js')
          console.log(`\nOne-click VSCode setup: "${getVSCodeInstallUrl()}"`)
          console.log('Click the link above to install MCP server automatically')
        }

        console.log(`Adapter activation command: ${getAdapterCommand(opts.editor as any, projectRoot)}`)
        process.exit(0)
      } catch (error) {
        logger.error('Failed to run mcp install:', error)
        process.exit(1)
      }
    })
}