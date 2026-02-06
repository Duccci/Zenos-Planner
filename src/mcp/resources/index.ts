/**
 * MCP Resources Implementation
 *
 * Registers MCP resources for project artifacts (PRDs, proposals, architecture diagrams)
 * discovered from the current working directory.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
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
  
  // Scan subdirectories for Zeno projects
  try {
    const items = readdirSync(workspacePath)
    for (const item of items) {
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
    return statSync(join(dirPath, 'zeno')).isDirectory() || 
           statSync(join(dirPath, '.zeno')).isDirectory()
  } catch {
    return false
  }
}
const RESOURCE_TYPES = {
  prd: {
    pattern: '**/PROJECT_PRD.md',
    mimeType: 'text/markdown',
    description: 'Project Requirements Document'
  },
  proposal: {
    pattern: '**/proposals/**/*.md',
    mimeType: 'text/markdown',
    description: 'Project Proposal'
  },
  architecture: {
    pattern: '**/architecture/*.md',
    mimeType: 'text/markdown',
    description: 'Architecture Diagram/Document'
  }
} as const

/**
 * Discover resources from working directory
 */
async function discoverResources(basePath: string): Promise<Array<{ uri: string; name: string; description: string; mimeType: string }>> {
  const resources: Array<{ uri: string; name: string; description: string; mimeType: string }> = []

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
            mimeType: config.mimeType
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
      mimeType: 'text/markdown'
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
  const basePath = workspacePath || process.cwd()
  const resources = await discoverResources(basePath)

  // Ensure server supports resource registration
  if (typeof (server as any).registerResource !== 'function') {
    logger.warn('MCP server does not support resource registration; skipping resource registration.')
    logger.info(`Discovered ${resources.length} resources but did not register them`)
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
        mimeType: resource.mimeType
      },
      async () => {
        // Handle file-backed resources
        try {
          if (resource.uri.startsWith('file://')) {
            const content = readFileSync(resource.uri.replace('file://', ''), 'utf8')
            return {
              contents: [{
                uri: resource.uri,
                text: content,
                mimeType: resource.mimeType
              }]
            }
          }

          // Template resources return a template description as content
          if (resource.uri.startsWith('template://')) {
            const templateText = `Template: ${resource.description}\n\nUse the pattern in the name to build a concrete resource URI (e.g., replace {id}).`;
            return {
              contents: [{
                uri: resource.uri,
                text: templateText,
                mimeType: resource.mimeType
              }]
            }
          }

          // Fallback
          throw new Error('Unsupported resource type')
        } catch (err) {
          logger.error(`Failed to read resource ${resource.uri}:`, err)
          throw new Error(`Resource not available: ${resource.name}`)
        }
      }
    )

    registeredUris.add(resource.uri)
  }

  logger.info(`Registered ${resources.length} MCP resources from workspace: ${basePath}`)

  // If watcher requested, start a filesystem watcher to detect new resources
  if (options?.watch) {
    const { watch } = await import('node:fs')
    const watchDir = join(basePath, 'zeno')
    let debounce: NodeJS.Timeout | null = null

    const watcher = watch(watchDir, { recursive: true }, async (_evt, filename) => {
      if (!filename) return
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(async () => {
        try {
          const updated = await discoverResources(basePath)
          for (const res of updated) {
            if (!registeredUris.has(res.uri)) {
              logger.info(`New resource discovered: ${res.name}`)
              server.registerResource(
                res.name,
                res.uri,
                { description: res.description, mimeType: res.mimeType },
                async () => {
                  if (res.uri.startsWith('file://')) {
                    const content = readFileSync(res.uri.replace('file://', ''), 'utf8')
                    return { contents: [{ uri: res.uri, text: content, mimeType: res.mimeType }] }
                  }
                  if (res.uri.startsWith('template://')) {
                    return { contents: [{ uri: res.uri, text: `Template: ${res.description}`, mimeType: res.mimeType }] }
                  }
                  throw new Error('Unsupported resource type')
                }
              )
              registeredUris.add(res.uri)
            }
          }
        } catch (err) {
          logger.warn('Resource watcher failed to refresh resources', err)
        }
      }, 250)
    })

    logger.info(`Resource watcher started on ${watchDir}`)
    return { count: resources.length, watcher: { close: () => watcher.close() } }
  }

  return resources.length
}