/**
 * MCP Server Implementation
 *
 * Implements the Model Context Protocol server using @modelcontextprotocol/sdk
 * with stdio transport for local LLM integration. Exposes all Zeno functions
 * as discoverable MCP tools with proper validation and error handling.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { RootsListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js'
import { fileURLToPath } from 'url'
import { createFunctionRegistry } from '../integration/function-implementations.js'
import { initializeDatabase } from '../storage/database.js'
import {
  findEmbeddedPlannerSubmodule,
  isZenoProject,
  loadConfig,
  setActiveWorkspaceRoot,
} from '../utils/config.js'
import { logger } from '../utils/logger.js'

/**
 * Create and configure the MCP server
 */
export async function createMcpServer(workspacePath?: string): Promise<McpServer> {
  const projectRoot = workspacePath ?? process.cwd()

  // Pre-load config to warm the zenoDir cache before any path resolution so
  // that a non-default zenoDir value in config.json is honoured by all
  // getZenoDir() callers that don't pass config explicitly.
  try {
    await loadConfig(projectRoot)
  } catch {
    // Non-fatal: project may not be initialised yet.
  }

  // Run DB migrations (including the proposal status CHECK constraint patch)
  // before registering tools so that syncProposalsFromDisk never encounters
  // the stale constraint that is missing 'validated'.
  try {
    await initializeDatabase(projectRoot, { syncGates: true, syncProposals: true, syncRequirements: true })
    logger.info('Database initialised and migrations applied')
  } catch (err) {
    // Non-fatal: the project root may not have a .zeno dir yet (first-run or
    // plain workspace). Individual tool calls will create the DB on demand.
    logger.warn('Database pre-initialisation skipped (project may not be initialised yet)', err)
  }

  const server = new McpServer(
    {
      name: 'zeno-planner',
      version: '0.2.0',
    },
    {
      instructions: `You are Zeno's Planner, an AI-powered project management system.

## Database Access via MCP Tools

**All database queries must use MCP tools, not custom scripts:**
- Use \`reg_action\` tool to query requirements (list, show, deps, transfer)
- Use \`gates_action\` tool to manage gates (list, show, create, start, complete)
- Use \`proposal_action\` tool to work with proposals

**Never write or execute custom better-sqlite3 scripts.** These tools are the primary, schema-validated interface for database access.

## Workflow

1. Use gates_action to view/create gates and understand roadmap
2. Use reg_action to list and understand requirements
3. Use proposal_action to create and manage proposals
4. Use config_get to access configuration and quality thresholds

Always specify the project path when working with project-specific tools. Follow the structured workflow: identify proposals, check dependencies, start proposals, implement tasks, update requirements, validate, and request completion.`,
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

  // Store resource manager for cleanup on server shutdown and for rebinding
  // when the active workspace is renegotiated via the MCP `roots` capability.
  let resourceManager:
    | { close: () => void; rebind?: (newBasePath: string) => Promise<number> }
    | undefined
  if (typeof resourceResult === 'object') {
    resourceManager = resourceResult
  }

  // Attach manager to server for lifecycle management
  ;(
    server as unknown as {
      _resourceWatcher?: { close: () => void }
      _resourceManager?: { close: () => void; rebind?: (p: string) => Promise<number> }
    }
  )._resourceWatcher = resourceManager
  ;(
    server as unknown as {
      _resourceManager?: { close: () => void; rebind?: (p: string) => Promise<number> }
    }
  )._resourceManager = resourceManager

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

    // Run environment diagnostics on MCP startup; log a warning if any check fails or warns.
    try {
      const { runAllChecks } = await import('../cli/commands/doctor/runner.js')
      const report = await runAllChecks()
      if (report.failed > 0 || report.warned > 0) {
        const parts: string[] = []
        if (report.failed > 0) parts.push(`${report.failed.toString()} failed`)
        if (report.warned > 0) parts.push(`${report.warned.toString()} warned`)
        logger.warn(`Environment check: ${parts.join(', ')} — run \`zeno doctor\` for details`)
      } else {
        logger.info('Environment check: all checks passed')
      }
    } catch (err) {
      logger.warn('Environment diagnostics could not run', err)
    }

    const server = await createMcpServer(workspacePath)
    const transport = new StdioServerTransport()

    await server.connect(transport)

    // Negotiate the active workspace from the connected client's `roots`
    // capability when ZENO_WORKSPACE was not set explicitly.  This lets a
    // single user-level install correctly target whichever workspace the
    // editor (VS Code, Cursor, etc.) currently has open.
    if (!process.env['ZENO_WORKSPACE']) {
      // Wait until the client's `initialize` handshake completes so
      // `getClientCapabilities()` and `listRoots()` have valid data.
      server.server.oninitialized = () => {
        void negotiateWorkspaceFromRoots(server, workspacePath)
      }

      // React to live workspace changes (multi-root toggling, folder add/remove).
      server.server.setNotificationHandler(RootsListChangedNotificationSchema, () => {
        void negotiateWorkspaceFromRoots(server, workspacePath)
      })
    }

    // Pre-import modules needed for cleanup so they're available synchronously
    // in signal handlers (dynamic import in signal handlers is unreliable on Windows)
    const { writePid, removePid: removePidFn } = await import('./manager.js')
    const { stopWalCheckpointInterval, closeDatabase } = await import('../storage/database.js')

    // Write PID so other processes can detect running MCP server
    let removePid: (() => void) | undefined
    try {
      removePid = removePidFn
      writePid()
    } catch (err) {
      logger.warn('PID file management not available', err)
    }

    // Track whether cleanup has already run to prevent double-cleanup
    let cleaningUp = false

    // Synchronous cleanup that doesn't rely on async import or process.exit
    // inside an async void. Signal handlers on Windows need to be fast and
    // synchronous to avoid orphaned processes.
    const cleanupSync = (exitCode: number): void => {
      if (cleaningUp) return
      cleaningUp = true
      logger.info('Shutting down MCP server...')

      // 1. Close resource watcher (sync)
      try {
        const resourceWatcher = (server as unknown as { _resourceWatcher?: { close: () => void } })
          ._resourceWatcher
        resourceWatcher?.close()
      } catch (err) {
        logger.debug('Failed to close resource watcher', err)
      }

      // 2. Stop database checkpoint interval and close database (sync)
      try {
        stopWalCheckpointInterval()
        closeDatabase()
      } catch (err) {
        logger.debug('Failed to stop WAL checkpoint interval', err)
      }

      // 3. Close MCP server (async but we don't wait — process is exiting)
      server.close().catch(() => {
        // Ignore errors during shutdown
      })

      // 4. Remove PID file (sync)
      try {
        removePid?.()
      } catch {
        // ignore
      }

      process.exit(exitCode)
    }

    process.on('SIGINT', () => {
      cleanupSync(0)
    })
    process.on('SIGTERM', () => {
      cleanupSync(0)
    })

    // Windows orphan prevention: when the parent editor closes the stdio pipe,
    // stdin emits 'end'. Without this, the process hangs forever on Windows
    // because SIGINT/SIGTERM are not reliably delivered from a dead parent.
    process.stdin.on('end', () => {
      logger.info('stdin closed — parent disconnected')
      cleanupSync(0)
    })
    process.stdin.on('error', () => {
      logger.info('stdin error — parent disconnected')
      cleanupSync(0)
    })

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception in MCP server', err)
      cleanupSync(1)
    })

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

/**
 * Track the workspace path most recently activated via roots negotiation so
 * we only re-initialise the database when the resolved root actually changes.
 */
let _lastNegotiatedRoot: string | undefined

/**
 * Query the connected client's `roots` capability and, when a usable workspace
 * is returned, install it as the active workspace override.  Re-initialises the
 * database for the new root so subsequent tool calls see the correct gates,
 * proposals, and requirements.
 *
 * Best-effort: silently no-ops when the client does not advertise the `roots`
 * capability, returns no roots, or returns a non-`file://` URI.
 *
 * @param server          - The connected MCP server instance.
 * @param fallbackRoot    - The workspace path used at startup, returned to the
 *                          caller for parity with `listRoots`-less clients.
 */
async function negotiateWorkspaceFromRoots(
  server: McpServer,
  fallbackRoot: string
): Promise<void> {
  try {
    const capabilities = server.server.getClientCapabilities()
    if (!capabilities?.roots) {
      logger.debug('Client did not advertise roots capability — using startup workspace')
      return
    }

    const result = await server.server.listRoots()
    const fileRoots = result.roots.filter((r) => r.uri.startsWith('file://'))
    if (fileRoots.length === 0) {
      logger.debug('Client returned no file:// roots — using startup workspace')
      return
    }

    // Multi-root workspaces: scan every reported root and pick the first that
    // hosts a Zeno project (either directly or via an embedded planner
    // submodule).  Without this, a user-level MCP install bound to a workspace
    // whose first folder isn't the planner would silently fall back to default
    // thresholds because `loadConfig` couldn't find `.zeno/config.json`.
    let negotiated: string | undefined
    let resolved: string | undefined
    let embeddedFor: string | undefined
    for (const root of fileRoots) {
      const candidate = fileURLToPath(root.uri)
      if (isZenoProject(candidate)) {
        negotiated = candidate
        resolved = candidate
        break
      }
      const embedded = findEmbeddedPlannerSubmodule(candidate)
      if (embedded) {
        negotiated = candidate
        resolved = embedded
        embeddedFor = candidate
        break
      }
    }

    // Nothing matched — fall back to the first file root so behaviour for
    // non-Zeno workspaces (e.g. fresh folders) is unchanged from before.
    if (!negotiated || !resolved) {
      const first = fileRoots[0]
      if (!first) return
      negotiated = fileURLToPath(first.uri)
      resolved = negotiated
    }

    if (negotiated === _lastNegotiatedRoot) {
      return
    }

    if (embeddedFor) {
      logger.info(
        `Embedded planner submodule detected: ${resolved} (consumer root: ${embeddedFor})`
      )
    }

    _lastNegotiatedRoot = negotiated
    setActiveWorkspaceRoot(resolved)
    logger.info(`Workspace negotiated from MCP roots: ${resolved} (fallback: ${fallbackRoot})`)

    // Re-run DB init for the negotiated root so proposals/requirements are
    // synced from the correct .zeno directory.  Best-effort — the project may
    // not be initialised yet.
    try {
      await loadConfig(resolved)
      await initializeDatabase(resolved, {
        syncGates: true,
        syncProposals: true,
        syncRequirements: true,
      })
      logger.info('Database re-initialised for negotiated workspace')
    } catch (err) {
      // CONFIG_NOT_FOUND is expected when the negotiated workspace is not a
      // Zeno-initialised project (e.g. user opened an unrelated folder).
      // Log at debug to avoid noise; surface other errors as warnings.
      const code = (err as { code?: string } | undefined)?.code
      if (code === 'CONFIG_NOT_FOUND') {
        logger.debug(
          'Database re-initialisation skipped: negotiated workspace is not Zeno-initialised',
          err
        )
      } else {
        logger.warn('Database re-initialisation skipped for negotiated workspace', err)
      }
    }

    // Re-bind MCP resources (PRDs, proposals, …) to the negotiated workspace
    // so editor "Add Context" panels surface the correct project's artifacts.
    try {
      const manager = (
        server as unknown as {
          _resourceManager?: { rebind?: (p: string) => Promise<number> }
        }
      )._resourceManager
      if (manager?.rebind) {
        const count = await manager.rebind(resolved)
        logger.info(`Re-registered ${String(count)} MCP resources for negotiated workspace`)
      }
    } catch (err) {
      logger.warn('Failed to re-register resources for negotiated workspace', err)
    }
  } catch (err) {
    logger.debug('Failed to negotiate workspace from MCP roots', err)
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  void main()
}
