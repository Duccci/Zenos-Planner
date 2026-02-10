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

/**
 * Create and configure the MCP server
 */
export async function createMcpServer(workspacePath?: string): Promise<McpServer> {
  const server = new McpServer(
    {
      name: 'zeno-planner',
      version: '0.2.0',
    },
    {
      instructions:
        "You are Zeno's Planner, an AI-powered project management system. Use the available tools to manage projects, gates, requirements, and proposals across multiple Zeno projects in your workspace. Always specify the project path when working with project-specific tools. Follow the structured workflow: identify proposals, check dependencies, start proposals, implement tasks, update requirements, validate, and request completion.",
    }
  )

  // Create function registry with workspace support
  const registry = createFunctionRegistry()

  // Register tools centrally (augmented with tool metadata when available)
  const { registerTools } = await import('./tools/index.js')
  const registered = registerTools(server, registry)
  logger.info(`Registered ${String(registered.length)} MCP tools via centralized registry`)

  // Register resources for project artifacts
  const { registerResources } = await import('./resources/index.js')
  const resourceResult = await registerResources(server, workspacePath, { watch: true })
  const resourceCountNumber =
    typeof resourceResult === 'number' ? resourceResult : resourceResult.count
  logger.info(`Registered ${String(resourceCountNumber)} MCP resources`)

  // Store resource watcher for cleanup on server shutdown
  let resourceWatcher: { close: () => void } | undefined
  if (typeof resourceResult === 'object' && 'watcher' in resourceResult) {
    resourceWatcher = resourceResult.watcher
  }

  // Attach watcher to server for lifecycle management
  ;(server as unknown as { _resourceWatcher?: { close: () => void } })._resourceWatcher =
    resourceWatcher

  return server
}

/**
 * Main entry point for the MCP server
 */
export async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const workspacePath = process.env['ZENO_WORKSPACE'] ?? process.cwd()

    logger.info('Starting Zeno MCP server...')
    logger.info(`Workspace: ${workspacePath}`)

    const server = await createMcpServer(workspacePath)
    const transport = new StdioServerTransport()

    await server.connect(transport)

    // Write PID so other processes can detect running MCP server
    let removePid: (() => void) | undefined
    try {
      const { writePid, removePid: removePidFn } = await import('./manager.js')
      removePid = removePidFn
      writePid()

      // Clean up pid on exit
      const cleanup = (): void => {
        logger.info('Shutting down MCP server...')
        void (async () => {
          // 1. Close resource watcher first
          try {
            const resourceWatcher = (
              server as unknown as { _resourceWatcher?: { close: () => void } }
            )._resourceWatcher
            resourceWatcher?.close()
          } catch (err) {
            logger.debug('Failed to close resource watcher', err)
          }

          // 2. Stop database checkpoint interval and close database
          try {
            const { stopWalCheckpointInterval, closeDatabase } = await import(
              '../storage/database.js'
            )
            stopWalCheckpointInterval()
            closeDatabase()
          } catch (err) {
            logger.debug('Failed to stop WAL checkpoint interval', err)
          }

          // 3. Close MCP server
          await server.close()

          // 4. Remove PID file
          removePid?.()

          process.exit(0)
        })()
      }

      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)
      process.on('uncaughtException', (err) => {
        logger.error('Uncaught exception in MCP server', err)
        void (async () => {
          // Cleanup watchers and database on uncaught exception
          try {
            const resourceWatcher = (
              server as unknown as { _resourceWatcher?: { close: () => void } }
            )._resourceWatcher
            resourceWatcher?.close()
          } catch {
            // ignore
          }

          try {
            const { stopWalCheckpointInterval, closeDatabase } = await import(
              '../storage/database.js'
            )
            stopWalCheckpointInterval()
            closeDatabase()
          } catch {
            // ignore
          }

          await server.close()
          removePid?.()
          process.exit(1)
        })()
      })
    } catch (err) {
      logger.warn('PID file management not available', err)
    }

    logger.info('Zeno MCP server started successfully')
    logger.info('Listening for MCP requests on stdio...')

    // Development mode: file watching for auto-restart
    const isDevMode = process.env['NODE_ENV'] === 'development' || process.argv.includes('--dev')
    const watchPattern = process.env['FILE_WATCH_PATTERN'] ?? 'src/**/*.ts'

    if (isDevMode) {
      const { enableDevMode } = await import('./dev-mode.js')
      const watcher = enableDevMode({
        watchPattern,
        debounceMs: 500,
        onRestart: async (filename) => {
          logger.info(`Source file changed: ${filename}, restarting server...`)
          await server.close()
          removePid?.()
          process.exit(0)
        },
      })

      // On server shutdown, ensure watcher closed
      process.on('exit', () => {
        watcher.close()
      })
      logger.info(`Development mode: watching ${watchPattern} for changes`)
    }
  } catch (error) {
    logger.error('Failed to start MCP server:', error)
    process.exit(1)
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  void main()
}
