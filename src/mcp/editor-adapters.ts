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

/**
 * Validate that Zeno is properly installed.
 *
 * When `zenoDir` is `'.'` (default / standalone install), binaries are
 * expected directly under `projectRoot/bin`.  When Zeno is a git submodule
 * mounted at `zenoDir` inside the consumer project, the binaries live at
 * `projectRoot/<zenoDir>/bin`.
 *
 * Checks for:
 * 1. bin/zeno.js exists
 * 2. bin/mcp-server.js exists
 * 3. src directory exists
 */
export function isZenoInstalled(
  projectRoot = process.cwd(),
  zenoDir = '.'
): { valid: boolean; reason?: string } {
  const binaryBase = zenoDir === '.' ? projectRoot : join(projectRoot, zenoDir)
  const zenoCliPath = join(binaryBase, 'bin', 'zeno.js')
  const mcpServerPath = join(binaryBase, 'bin', 'mcp-server.js')
  const srcPath = join(binaryBase, 'src')

  if (!existsSync(zenoCliPath)) {
    return { valid: false, reason: `Zeno CLI not found at ${zenoCliPath}` }
  }

  if (!existsSync(mcpServerPath)) {
    return { valid: false, reason: `MCP server not found at ${mcpServerPath}` }
  }

  if (!existsSync(srcPath)) {
    return { valid: false, reason: `Source directory not found at ${srcPath}` }
  }

  return { valid: true }
}

/**
 * Generate and write `.vscode/mcp.json` for the given project root.
 *
 * When Zeno is embedded as a git submodule at `zenoDir` (e.g. `'zeno'`), the
 * MCP server binary lives at `<projectRoot>/<zenoDir>/bin/mcp-server.js`.
 * Additionally, `ZENO_WORKSPACE` is injected into the server environment so
 * the MCP server always resolves project files relative to the consumer's
 * project root rather than the submodule's own root.
 *
 * @param projectRoot   - Consumer project root (where `.vscode/` will be created).
 * @param zenoDir       - Planning directory name relative to projectRoot.
 *                        `'.'` means standalone (binary at `./bin/mcp-server.js`).
 *                        Any other value (e.g. `'zeno'`) means submodule mode.
 * @param zenoWorkspace - Absolute path to set as `ZENO_WORKSPACE`.  Defaults to
 *                        `projectRoot` when `zenoDir !== '.'` (submodule mode).
 */
export function ensureWorkspaceMcp(
  projectRoot = process.cwd(),
  zenoDir = '.',
  zenoWorkspace?: string
): boolean {
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
      // When zenoDir is not '.' the binary lives inside the submodule directory.
      const binaryPath =
        zenoDir === '.' ? './bin/mcp-server.js' : `./${zenoDir}/bin/mcp-server.js`

      // Inject ZENO_WORKSPACE so the MCP server targets the consumer project
      // root regardless of the working directory it is started in.
      const workspace = zenoWorkspace ?? (zenoDir !== '.' ? projectRoot : undefined)

      const serverEntry: Record<string, unknown> = {
        type: 'stdio',
        command: 'node',
        args: [binaryPath],
        description: 'Zeno Planner MCP server for AI-powered project management',
      }
      if (workspace) {
        serverEntry['env'] = { ZENO_WORKSPACE: workspace }
      }

      const content = JSON.stringify({ servers: { 'zeno-planner': serverEntry } }, null, 2)
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
