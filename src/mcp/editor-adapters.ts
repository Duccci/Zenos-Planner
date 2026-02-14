/**
 * Lightweight Editor Adapter Helpers
 *
 * Provides small utilities to produce activation commands and adapter helpers
 * for editors that don't natively support workspace-level `mcp.json`.
 */

import { join } from 'node:path'
import { existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { logger } from '../utils/logger.js'

export function getAdapterCommand(
  editor: 'vscode' | 'cursor' | 'windsurf',
  projectRoot = process.cwd()
): string {
  const base = `node ${join(projectRoot, 'bin', 'mcp-server.js')}`
  if (editor === 'vscode') return base
  return `${base} --adapter ${editor}`
}

/**
 * Generate VSCode MCP installation URL for one-click setup
 */
export function getVSCodeInstallUrl(): string {
  const config = {
    servers: {
      'zeno-planner': {
        type: 'stdio',
        command: 'node',
        args: ['./bin/mcp-server.js'],
        description: 'Zeno Planner MCP server for AI-powered project management',
      },
    },
  }
  const encodedConfig = encodeURIComponent(JSON.stringify(config))
  return `vscode:mcp/install?${encodedConfig}`
}

export function ensureWorkspaceMcp(projectRoot = process.cwd()): boolean {
  const vscodeDir = join(projectRoot, '.vscode')
  const target = join(vscodeDir, 'mcp.json')

  let configWritten = false

  try {
    // Ensure .vscode directory exists
    if (!existsSync(vscodeDir)) {
      mkdirSync(vscodeDir, { recursive: true })
    }

    // Write mcp.json if it doesn't exist
    if (!existsSync(target)) {
      const content = JSON.stringify(
        {
          servers: {
            'zeno-planner': {
              type: 'stdio',
              command: 'node',
              args: ['./bin/mcp-server.js'],
              description: 'Zeno Planner MCP server for AI-powered project management',
            },
          },
        },
        null,
        2
      )
      writeFileSync(target, content, { encoding: 'utf-8' })
      logger.info(`Wrote workspace mcp.json to ${target}`)
      configWritten = true
    }

    return configWritten
  } catch (err) {
    logger.warn('Failed to ensure workspace MCP configuration', err)
    return false
  }
}
