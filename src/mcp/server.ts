/**
 * MCP Server Implementation
 *
 * Implements the Model Context Protocol server using @modelcontextprotocol/sdk
 * with stdio transport for local LLM integration. Exposes all Zeno functions
 * as discoverable MCP tools with proper validation and error handling.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createFunctionRegistry } from '../integration/function-implementations.js'
import { logger } from '../utils/logger.js'
import { watch } from 'node:fs'
import { join } from 'node:path'

/**
 * Create and configure the MCP server
 */
export async function createMcpServer(): Promise<McpServer> {
  const server = new McpServer(
    {
      name: 'zeno-planner',
      version: '0.2.0'
    },
    {
      instructions: 'You are Zeno\'s Planner, an AI-powered project management system. Use the available tools to manage projects, gates, requirements, and proposals. Always follow the structured workflow: identify proposals, check dependencies, start proposals, implement tasks, update requirements, validate, and request completion.'
    }
  )

  // Create function registry
  const registry = createFunctionRegistry()

  // Register tools centrally (augmented with tool metadata when available)
  const { registerTools } = await import('./tools/index.js')
  const registered = registerTools(server, registry)
  logger.info(`Registered ${registered.length} MCP tools via centralized registry`)


  return server
}

/**
 * Main entry point for the MCP server
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting Zeno MCP server...')

    const server = await createMcpServer()
    const transport = new StdioServerTransport()

    await server.connect(transport)

    // Write PID so other processes can detect running MCP server
    let removePid: (() => void) | undefined
    try {
      const { writePid, removePid: removePidFn } = await import('./manager.js')
      removePid = removePidFn
      writePid()

      // Clean up pid on exit
      const cleanup = async () => {
        logger.info('Shutting down MCP server...')
        await server.close()
        removePid?.()
        process.exit(0)
      }

      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)
      process.on('uncaughtException', async (err) => {
        logger.error('Uncaught exception in MCP server', err)
        await server.close()
        removePid?.()
        process.exit(1)
      })
    } catch (err) {
      logger.warn('PID file management not available', err)
    }

    logger.info('Zeno MCP server started successfully')
    logger.info('Listening for MCP requests on stdio...')

    // Development mode: file watching for auto-restart
    const isDevMode = process.env['NODE_ENV'] === 'development' || process.argv.includes('--dev')
    const watchPattern = process.env['FILE_WATCH_PATTERN'] || 'src/**/*.ts'
    const watchDir = watchPattern.split('/')[0] || 'src' // Simple parsing, assume src/**

    if (isDevMode) {
      let restartTimeout: NodeJS.Timeout | null = null
      watch(join(process.cwd(), watchDir), { recursive: true }, (_eventType, filename) => {
        if (filename && filename.endsWith('.ts')) {
          if (restartTimeout) {
            clearTimeout(restartTimeout)
          }
          restartTimeout = setTimeout(async () => {
            logger.info(`Source file changed: ${filename}, restarting server...`)
            // Graceful shutdown
            await server.close()
            removePid?.()
            process.exit(0)
          }, 500) // Debounce 500ms
        }
      })
      logger.info(`Development mode: watching ${watchPattern} for changes`)
    }

  } catch (error) {
    logger.error('Failed to start MCP server:', error)
    process.exit(1)
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}