/**
 * MCP Resources Implementation
 *
 * Registers MCP resources for project artifacts (PRDs, proposals, architecture diagrams)
 * discovered from the current working directory. Supports filesystem watching to add/remove
 * resources dynamically as files are created or deleted.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { glob } from 'glob'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getZenoGitDir } from '../../utils/config.js'
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
  try {
    // Check for zeno/ directory or .zeno/ directory
    return (
      statSync(join(dirPath, 'zeno')).isDirectory() ||
      statSync(join(dirPath, '.zeno')).isDirectory()
    )
  } catch {
    return false
  }
}
const RESOURCE_TYPES = {
  prd: {
    pattern: '**/overview/PROJECT_PRD.md',
    mimeType: 'text/markdown',
    description: 'Project Requirements Document',
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
            uri: `file://${fullPath}`,
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
      const filePath = res.uri.replace('file://', '')
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
 * Register MCP resources on the server
 */
export async function registerResources(
  server: McpServer,
  workspacePath?: string,
  options?: { watch?: boolean }
): Promise<number | { count: number; watcher?: { close: () => void } }> {
  const basePath = workspacePath ?? process.cwd()
  const resources = await discoverResources(basePath)

  // Ensure server supports resource registration
  if (
    typeof (server as unknown as { registerResource?: unknown }).registerResource !== 'function'
  ) {
    logger.warn(
      'MCP server does not support resource registration; skipping resource registration.'
    )
    logger.info(`Discovered ${String(resources.length)} resources but did not register them`)
    return 0
  }

  // Track registered resources so the watcher can remove stale ones.
  // Maps URI → the handle returned by server.registerResource (which has .remove())
  const registeredHandles = new Map<string, { remove: () => void }>()

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
      registeredHandles.set(resource.uri, handle as unknown as { remove: () => void })
    } catch {
      // registerResource throws on duplicate URI — skip silently
      logger.debug(`Skipped duplicate resource: ${resource.uri}`)
    }
  }

  logger.info(
    `Registered ${String(registeredHandles.size)} MCP resources from workspace: ${basePath}`
  )

  // If watcher requested, start a filesystem watcher to detect new/removed resources
  if (options?.watch) {
    const { watch } = await import('node:fs')
    // Use the configured zenoDir (via module cache) so standalone repos
    // (zenoDir = '.') are watched at the correct path instead of '<root>/zeno'.
    const watchDir = getZenoGitDir(basePath)
    if (!existsSync(watchDir)) {
      logger.warn(`Resource watcher skipped: watch directory does not exist: ${watchDir}`)
      return { count: registeredHandles.size }
    }
    let debounce: NodeJS.Timeout | null = null
    let refreshInFlight = false

    // Rate-limit: suppress refreshes during bursts (e.g., git operations,
    // bulk file writes). Allow at most 1 refresh per 10-second window.
    let lastRefreshTime = 0
    const MIN_REFRESH_INTERVAL_MS = 10_000

    const watcher = watch(watchDir, { recursive: true }, (_evt, filename) => {
      if (!filename) return
      // Only react to .md file changes to avoid spurious refreshes
      if (!filename.endsWith('.md')) return

      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        if (refreshInFlight) return

        // Rate-limit: skip if we refreshed too recently
        const now = Date.now()
        if (now - lastRefreshTime < MIN_REFRESH_INTERVAL_MS) {
          return
        }
        lastRefreshTime = now
        refreshInFlight = true

        void (async () => {
          try {
            const updated = await discoverResources(basePath)
            const updatedUris = new Set(updated.map((r) => r.uri))

            // Remove resources that no longer exist on disk
            for (const [uri, handle] of registeredHandles) {
              if (!updatedUris.has(uri)) {
                try {
                  handle.remove()
                } catch {
                  // ignore — may already be removed
                }
                registeredHandles.delete(uri)
                logger.info(`Resource removed: ${uri}`)
              }
            }

            // Add resources that are new
            for (const res of updated) {
              if (!registeredHandles.has(res.uri)) {
                try {
                  const handle = server.registerResource(
                    res.name,
                    res.uri,
                    { description: res.description, mimeType: res.mimeType },
                    makeReadCallback(res)
                  )
                  registeredHandles.set(res.uri, handle as unknown as { remove: () => void })
                  logger.info(`New resource discovered: ${res.name}`)
                } catch {
                  // duplicate or registration error — skip
                }
              }
            }
          } catch (err) {
            logger.warn('Resource watcher failed to refresh resources', err)
          } finally {
            refreshInFlight = false
          }
        })()
      }, 2000) // 2s debounce — long enough to batch rapid file changes
    })

    // Handle watcher errors gracefully (e.g., watched directory deleted)
    watcher.on('error', (err) => {
      logger.warn('Resource watcher error:', err)
    })

    logger.info(`Resource watcher started on ${watchDir}`)
    return {
      count: registeredHandles.size,
      watcher: {
        close: () => {
          if (debounce) clearTimeout(debounce)
          try {
            watcher.close()
          } catch {
            // ignore
          }
        },
      },
    }
  }

  return registeredHandles.size
}
