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
        // Use glob to find files matching the pattern
        const pattern = join(projectPath, config.pattern)
        const files = await glob(pattern, { cwd: basePath })
        
        for (const file of files) {
          const fullPath = join(basePath, file)
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
  }

  return resources
}

/**
 * Register MCP resources on the server
 */
/**
 * Register MCP resources on the server
 */
export async function registerResources(server: McpServer, workspacePath?: string): Promise<number> {
  const basePath = workspacePath || process.cwd()
  const resources = await discoverResources(basePath)

  for (const resource of resources) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        description: resource.description,
        mimeType: resource.mimeType
      },
      async () => {
        try {
          const content = readFileSync(resource.uri.replace('file://', ''), 'utf8')
          return {
            contents: [{
              uri: resource.uri,
              text: content,
              mimeType: resource.mimeType
            }]
          }
        } catch (err) {
          logger.error(`Failed to read resource ${resource.uri}:`, err)
          throw new Error(`Resource not available: ${resource.name}`)
        }
      }
    )
  }

  logger.info(`Registered ${resources.length} MCP resources from workspace: ${basePath}`)
  return resources.length
}