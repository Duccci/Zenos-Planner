/**
 * MCP Server Commands
 *
 * CLI commands for running the MCP server.
 */

import type { Command } from 'commander'
import { createMcpServer } from '../../mcp/server.js'
import { logger } from '../../utils/logger.js'

/**
 * Register MCP commands
 */
export function registerMcpCommands(program: Command): void {
  const mcpCommand = program
    .command('mcp')
    .description('Model Context Protocol server commands')

  mcpCommand
    .command('server')
    .description('Start the MCP server for LLM integration')
    .action(async () => {
      try {
        logger.info('Starting MCP server...')

        const server = await createMcpServer()

        // For now, we only support stdio transport
        // HTTP transport would be added in future gates
        const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js')

        const transport = new StdioServerTransport()

        await server.connect(transport)

        logger.info('MCP server started successfully')
        logger.info('Listening for MCP requests on stdio...')

        // Keep the process alive
        process.on('SIGINT', async () => {
          logger.info('Shutting down MCP server...')
          await server.close()
          process.exit(0)
        })

        // Keep alive - the transport handles the event loop
        await new Promise(() => {}) // Never resolves, keeps process running

      } catch (error) {
        logger.error('Failed to start MCP server:', error)
        process.exit(1)
      }
    })

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

  // Ephemeral single-tool invocation (hybrid mode)
  mcpCommand
    .command('run')
    .description('Run a single MCP tool (ephemeral, no long-lived server)')
    .requiredOption('-t, --tool <name>', 'Tool name to invoke')
    .option('-j, --json <json>', 'JSON string of arguments for the tool')
    .action(async (opts: { tool: string; json?: string }) => {
      try {
        const { runToolOnce } = await import('../../mcp/run.js')

        // Parse arguments
        let args: Record<string, unknown> = {}
        if (opts.json) {
          try {
            args = JSON.parse(opts.json)
          } catch (err) {
            logger.error('Invalid JSON provided for tool arguments')
            console.error('Invalid JSON provided for tool arguments')
            process.exit(1)
          }
        }

        const result = await runToolOnce(opts.tool, args)

        // Print structured content when available, otherwise plain text
        if (result.structuredContent) {
          process.stdout.write(JSON.stringify(result.structuredContent, null, 2) + '\n')
        } else if (result.content && result.content.length > 0) {
          // Find first text content if available, otherwise fallback to first item
          const textItem = (result.content as any[]).find((c) => c.type === 'text') || (result.content as any[])[0]
          process.stdout.write(String((textItem as any).text ?? JSON.stringify(textItem)) + '\n')
        } else {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n')
        }

        process.exit(result.isError ? 1 : 0)
      } catch (error) {
        logger.error('Failed to run tool:', error)
        console.error('Failed to run tool:', error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })
}