/**
 * MCP Resources Implementation
 *
 * Registers MCP resources for project artifacts (PRDs, proposals, architecture diagrams)
 * discovered from the current working directory.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { glob } from 'glob'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
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
    pattern: '**/PROJECT_PRD.md',
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

/**
 * Discover resources from working directory
 */
async function discoverResources(
  basePath: string
): Promise<{ uri: string; name: string; description: string; mimeType: string }[]> {
  const resources: { uri: string; name: string; description: string; mimeType: string }[] = []

  // Find all Zeno projects in the workspace
  const projectPaths = findZenoProjects(basePath)

  for (const projectPath of projectPaths) {
    const projectName = relative(basePath, projectPath) || 'root'

    for (const [type, config] of Object.entries(RESOURCE_TYPES)) {
      try {
        // Use glob to find files matching the pattern relative to the project path
        const files = await glob(config.pattern, { cwd: projectPath, absolute: true })

        for (const fullPath of files) {
          if (!fullPath || !existsSync(fullPath)) {
            logger.warn(`Skipping resource with unavailable path: ${String(fullPath)} in ${projectPath}`)
            continue
          }
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

/**
 * Register MCP resources on the server
 */
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

  // Track registered URIs to avoid duplicate registrations
  const registeredUris = new Set<string>()

  for (const resource of resources) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        description: resource.description,
        mimeType: resource.mimeType,
      },
      () => {
        // Handle file-backed resources
        logger.debug(`Resource requested: ${resource.uri}`)
        try {
          if (resource.uri.startsWith('file://')) {
            const path = resource.uri.replace('file://', '')
            if (!path) {
              const errMsg = `Invalid file resource URI: ${resource.uri}`
              logger.error(errMsg)
              throw new Error(errMsg)
            }
            if (!existsSync(path)) {
              const errMsg = `File not found for resource ${resource.name}: ${path}`
              logger.error(errMsg)
              throw new Error(errMsg)
            }
            const content = readFileSync(path, 'utf8')
            return {
              contents: [
                {
                  uri: resource.uri,
                  text: content,
                  mimeType: resource.mimeType,
                },
              ],
            }
          }

          // Template resources return a template description as content
          if (resource.uri.startsWith('template://')) {
            const templateText = `Template: ${resource.description}\n\nUse the pattern in the name to build a concrete resource URI (e.g., replace {id}).`
            return {
              contents: [
                {
                  uri: resource.uri,
                  text: templateText,
                  mimeType: resource.mimeType,
                },
              ],
            }
          }

          // Fallback
          throw new Error('Unsupported resource type')
        } catch (err) {
          logger.error(`Failed to read resource ${resource.uri}: ${String(err)}`, err)
          throw new Error(`Resource not available: ${resource.name} (${resource.uri}): ${String(err)}`)
        }
      }
    )

    registeredUris.add(resource.uri)
  }

  logger.info(`Registered ${String(resources.length)} MCP resources from workspace: ${basePath}`)

  // If watcher requested, start a filesystem watcher to detect new resources
  if (options?.watch) {
    const { watch } = await import('node:fs')
    const watchDir = join(basePath, 'zeno')
    let debounce: NodeJS.Timeout | null = null

    const watcher = watch(watchDir, { recursive: true }, (_evt, filename) => {
      if (!filename) return
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        // explicitly ignore returned promise from async refresh
        void (async () => {
          try {
            const updated = await discoverResources(basePath)
            for (const res of updated) {
              if (!registeredUris.has(res.uri)) {
                logger.info(`New resource discovered: ${res.name}`)
                server.registerResource(
                  res.name,
                  res.uri,
                  { description: res.description, mimeType: res.mimeType },
                  () => {
                    logger.debug(`Resource requested: ${res.uri}`)
                    try {
                      if (res.uri.startsWith('file://')) {
                        const path = res.uri.replace('file://', '')
                        if (!path) {
                          const errMsg = `Invalid file resource URI: ${res.uri}`
                          logger.error(errMsg)
                          throw new Error(errMsg)
                        }
                        if (!existsSync(path)) {
                          const errMsg = `File not found for resource ${res.name}: ${path}`
                          logger.error(errMsg)
                          throw new Error(errMsg)
                        }
                        const content = readFileSync(path, 'utf8')
                        return { contents: [{ uri: res.uri, text: content, mimeType: res.mimeType }] }
                      }
                      if (res.uri.startsWith('template://')) {
                        return {
                          contents: [
                            {
                              uri: res.uri,
                              text: `Template: ${res.description}`,
                              mimeType: res.mimeType,
                            },
                          ],
                        }
                      }
                      throw new Error('Unsupported resource type')
                    } catch (err) {
                      logger.error(`Failed to read resource ${res.uri}: ${String(err)}`, err)
                      throw new Error(`Resource not available: ${res.name} (${res.uri}): ${String(err)}`)
                    }
                  }
                )
                registeredUris.add(res.uri)
              }
            }
          } catch (err) {
            logger.warn('Resource watcher failed to refresh resources', err)
          }
        })()
      }, 250)
    })

    logger.info(`Resource watcher started on ${watchDir}`)
    return {
      count: resources.length,
      watcher: {
        close: () => {
          watcher.close()
        },
      },
    }
  }

  return resources.length
}
