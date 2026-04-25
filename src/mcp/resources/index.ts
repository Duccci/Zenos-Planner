/**
 * MCP Resources Implementation
 *
 * Registers MCP resources for project artifacts (PRDs, proposals, architecture diagrams)
 * discovered from the current working directory. Supports filesystem watching to add/remove
 * resources dynamically as files are created or deleted.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { glob } from 'glob'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getZenoGitDir, isZenoProject as isZenoProjectFromConfig } from '../../utils/config.js'
import { logger } from '../../utils/logger.js'

/**
 * Find all Zeno projects in the workspace
 */
function findZenoProjects(workspacePath: string): string[] {
  const projects: string[] = []

  // Check if the workspace root itself is a Zeno project
  if (isZenoProject(workspacePath)) {
    projects.push(workspacePath)
  }

  // Scan subdirectories for Zeno projects (but skip 'zeno' directory to avoid nesting)
  try {
    const items = readdirSync(workspacePath)
    for (const item of items) {
      // Skip the 'zeno' and '.zeno' directories themselves to prevent self-discovery
      if (item === 'zeno' || item === '.zeno') continue

      const fullPath = join(workspacePath, item)
      if (statSync(fullPath).isDirectory() && isZenoProject(fullPath)) {
        projects.push(fullPath)
      }
    }
  } catch (err) {
    logger.warn('Failed to scan workspace for Zeno projects:', err)
  }

  return projects
}

/**
 * Check if a directory is a Zeno project
 */
function isZenoProject(dirPath: string): boolean {
  // Use config utility which respects the cached zenoDir (e.g. '.' for standalone repos)
  if (isZenoProjectFromConfig(dirPath)) return true
  // Fall back to checking for .zeno/ directory directly (standalone layout not yet loaded)
  try {
    return statSync(join(dirPath, '.zeno')).isDirectory()
  } catch {
    return false
  }
}
const RESOURCE_TYPES = {
  prd: {
    pattern: '**/overview/*PRD.md',
    mimeType: 'text/markdown',
    description: 'Project Requirements Document',
  },
  gate: {
    pattern: '**/gates/**/gate-*.md',
    mimeType: 'text/markdown',
    description: 'Gate PRD',
  },
  proposal: {
    pattern: '**/proposals/**/*.md',
    mimeType: 'text/markdown',
    description: 'Project Proposal',
  },
  // Architecture docs removed - apply agents should not read them to reduce context burden
} as const

/** Shape returned by discoverResources */
interface DiscoveredResource {
  uri: string
  name: string
  description: string
  mimeType: string
}

/**
 * Discover resources from working directory
 */
async function discoverResources(basePath: string): Promise<DiscoveredResource[]> {
  const resources: DiscoveredResource[] = []

  // Always include a workspace-independent placeholder template. This ensures
  // that `registerResources` registers at least one entry on every call, which
  // forces the MCP SDK to initialise its resource request handlers (and the
  // accompanying `resources` capability) before the server's stdio transport
  // is connected. Without this, a workspace that initially has no Zeno
  // projects would defer capability registration until after `connect()`, at
  // which point a later rebind would fail with:
  //   "Cannot register capabilities after connecting to transport"
  resources.push({
    uri: 'template://zeno/placeholder',
    name: 'zeno:template:placeholder',
    description:
      'Placeholder template ensuring the MCP resources capability is declared before transport connect.',
    mimeType: 'text/markdown',
  })

  // Find all Zeno projects in the workspace
  const projectPaths = findZenoProjects(basePath)

  for (const projectPath of projectPaths) {
    const projectName = relative(basePath, projectPath) || 'root'

    for (const [type, config] of Object.entries(RESOURCE_TYPES)) {
      try {
        // Use glob to find files matching the pattern relative to the project path
        const files = await glob(config.pattern, { cwd: projectPath, absolute: true })

        for (const fullPath of files) {
          const relPath = relative(projectPath, fullPath)
          resources.push({
            uri: pathToFileURL(fullPath).href,
            name: `${projectName}:${type}:${relPath}`,
            description: `${config.description} (${projectName}): ${relPath}`,
            mimeType: config.mimeType,
          })
        }
      } catch (err) {
        logger.warn(`Failed to discover ${type} resources in ${projectPath}:`, err)
      }
    }

    // Add parameterized resource templates for convenient access (e.g., gate/{id}/prd)
    // These are not tied to a specific file but provide a discoverable pattern
    resources.push({
      uri: `template://${projectName}/gate/{id}/prd`,
      name: `${projectName}:template:gate/{id}/prd`,
      description: `Parameterized gate PRD template (${projectName}): gate/{id}/prd`,
      mimeType: 'text/markdown',
    })
  }

  return resources
}

/** Creates the read callback for a resource (avoids creating a unique closure per resource) */
function makeReadCallback(res: DiscoveredResource) {
  return () => {
    if (res.uri.startsWith('file://')) {
      const filePath = fileURLToPath(res.uri)
      if (!existsSync(filePath)) {
        throw new Error(`Resource not available: ${res.name}`)
      }
      const content = readFileSync(filePath, 'utf8')
      return {
        contents: [{ uri: res.uri, text: content, mimeType: res.mimeType }],
      }
    }

    if (res.uri.startsWith('template://')) {
      return {
        contents: [
          {
            uri: res.uri,
            text: `Template: ${res.description}\n\nUse the pattern in the name to build a concrete resource URI (e.g., replace {id}).`,
            mimeType: res.mimeType,
          },
        ],
      }
    }

    throw new Error(`Unsupported resource type: ${res.uri}`)
  }
}

/**
 * Manager returned from `registerResources` when watching is enabled.
 *
 * - `count`   – number of resources currently registered
 * - `close()` – stop the filesystem watcher; safe to call multiple times
 * - `rebind(newBasePath)` – tear down all currently registered resources +
 *   stop the watcher, then re-discover and re-register at `newBasePath`.
 *   Used by the MCP server when the workspace is renegotiated via the
 *   client's `roots` capability.
 */
export interface ResourceManager {
  count: number
  watcher?: { close: () => void }
  close: () => void
  rebind: (newBasePath: string) => Promise<number>
}

/**
 * Register MCP resources on the server
 */
export async function registerResources(
  server: McpServer,
  workspacePath?: string,
  options?: { watch?: boolean }
): Promise<number | ResourceManager> {
  const basePath = workspacePath ?? process.cwd()

  // Ensure server supports resource registration
  if (
    typeof (server as unknown as { registerResource?: unknown }).registerResource !== 'function'
  ) {
    logger.warn(
      'MCP server does not support resource registration; skipping resource registration.'
    )
    return 0
  }

  // Tracks the active registration's resource handles + watcher so we can
  // tear them down on `close()` or `rebind()`.
  const state: {
    handles: Map<string, { remove: () => void }>
    watcher?: { close: () => void }
    basePath: string
  } = {
    handles: new Map(),
    basePath,
  }

  /** Register resources discovered under `path` and update internal state. */
  async function registerAt(path: string): Promise<number> {
    state.basePath = path
    const resources = await discoverResources(path)

    for (const resource of resources) {
      try {
        const handle = server.registerResource(
          resource.name,
          resource.uri,
          {
            description: resource.description,
            mimeType: resource.mimeType,
          },
          makeReadCallback(resource)
        )
        state.handles.set(resource.uri, handle as unknown as { remove: () => void })
      } catch (err) {
        // registerResource throws on duplicate URI or invalid args
        logger.warn(
          `Failed to register MCP resource ${resource.name} (${resource.uri}): ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    logger.info(
      `Registered ${String(state.handles.size)} MCP resources from workspace: ${path}`
    )
    return state.handles.size
  }

  /** Remove every currently-registered handle. */
  function removeAllHandles(): void {
    for (const [uri, handle] of state.handles) {
      try {
        handle.remove()
      } catch {
        // ignore — may already be removed
      }
      state.handles.delete(uri)
    }
  }

  /** Start a filesystem watcher on the .md files under the planning dir. */
  async function startWatcher(path: string): Promise<{ close: () => void } | undefined> {
    const { watch } = await import('node:fs')
    const watchDir = getZenoGitDir(path)
    if (!existsSync(watchDir)) {
      logger.warn(`Resource watcher skipped: watch directory does not exist: ${watchDir}`)
      return undefined
    }
    let debounce: NodeJS.Timeout | null = null
    let refreshInFlight = false
    let lastRefreshTime = 0
    const MIN_REFRESH_INTERVAL_MS = 10_000

    const watcher = watch(watchDir, { recursive: true }, (_evt, filename) => {
      if (!filename) return
      if (!filename.endsWith('.md')) return

      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        if (refreshInFlight) return
        const now = Date.now()
        if (now - lastRefreshTime < MIN_REFRESH_INTERVAL_MS) {
          return
        }
        lastRefreshTime = now
        refreshInFlight = true

        void (async () => {
          try {
            const updated = await discoverResources(state.basePath)
            const updatedUris = new Set(updated.map((r) => r.uri))

            for (const [uri, handle] of state.handles) {
              if (!updatedUris.has(uri)) {
                try {
                  handle.remove()
                } catch {
                  // ignore
                }
                state.handles.delete(uri)
                logger.info(`Resource removed: ${uri}`)
              }
            }

            for (const res of updated) {
              if (!state.handles.has(res.uri)) {
                try {
                  const handle = server.registerResource(
                    res.name,
                    res.uri,
                    { description: res.description, mimeType: res.mimeType },
                    makeReadCallback(res)
                  )
                  state.handles.set(res.uri, handle as unknown as { remove: () => void })
                  logger.info(`New resource discovered: ${res.name}`)
                } catch (err) {
                  logger.warn(
                    `Failed to register MCP resource ${res.name} (${res.uri}): ${err instanceof Error ? err.message : String(err)}`
                  )
                }
              }
            }
          } catch (err) {
            logger.warn('Resource watcher failed to refresh resources', err)
          } finally {
            refreshInFlight = false
          }
        })()
      }, 2000)
    })

    watcher.on('error', (err) => {
      logger.warn('Resource watcher error:', err)
    })

    logger.info(`Resource watcher started on ${watchDir}`)
    return {
      close: () => {
        if (debounce) clearTimeout(debounce)
        try {
          watcher.close()
        } catch {
          // ignore
        }
      },
    }
  }

  await registerAt(basePath)

  if (!options?.watch) {
    return state.handles.size
  }

  state.watcher = await startWatcher(basePath)

  const manager: ResourceManager = {
    get count() {
      return state.handles.size
    },
    get watcher() {
      return state.watcher
    },
    close() {
      try {
        state.watcher?.close()
      } catch {
        // ignore
      }
      state.watcher = undefined
    },
    async rebind(newBasePath: string) {
      logger.info(`Rebinding MCP resources to new workspace: ${newBasePath}`)
      // Stop the current watcher first so its debounced refresh callback
      // doesn't race with the upcoming registerAt.
      try {
        state.watcher?.close()
      } catch {
        // ignore
      }
      state.watcher = undefined
      removeAllHandles()
      await registerAt(newBasePath)
      state.watcher = await startWatcher(newBasePath)
      return state.handles.size
    },
  }

  return manager
}
