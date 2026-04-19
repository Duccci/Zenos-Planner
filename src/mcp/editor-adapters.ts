/**
 * Lightweight Editor Adapter Helpers
 *
 * Provides small utilities to produce activation commands and adapter helpers
 * for editors that don't natively support workspace-level `mcp.json`.
 */

import { basename, dirname, join, resolve } from 'node:path'
import { existsSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs'
import { modify, applyEdits, parse as jsoncParse } from 'jsonc-parser'
import { logger } from '../utils/logger.js'
import { isSubmoduleLayout, getZenoToolDir, loadConfig, toSlug } from '../utils/config.js'
import { normalizePath } from '../utils/file.js'

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
 * Auto-detects the binary location: if `zeno/` is a git submodule, binaries
 * are at `<projectRoot>/zeno/bin/`; otherwise at `<projectRoot>/bin/`.
 *
 * Checks for:
 * 1. bin/zeno.js exists
 * 2. bin/mcp-server.js exists
 * 3. src directory exists
 */
export function isZenoInstalled(
  projectRoot = process.cwd()
): { valid: boolean; reason?: string } {
  const binaryBase = getZenoToolDir(projectRoot)
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
 * Build a single MCP server entry object.
 *
 * @param binaryPath - Path to `mcp-server.js` (relative or absolute for `.vscode/mcp.json`).
 * @param workspace  - When provided, injected as `ZENO_WORKSPACE` in the `env` block.
 */
export function buildMcpServerEntry(
  binaryPath: string,
  workspace?: string
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    type: 'stdio',
    command: 'node',
    args: [binaryPath],
    description: 'Zeno Planner MCP server for AI-powered project management',
  }
  if (workspace !== undefined) {
    entry['env'] = { ZENO_WORKSPACE: workspace }
  }
  return entry
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
 * @param serverName    - MCP server key (default: `'zeno-planner'`).
 */
export function ensureWorkspaceMcp(
  projectRoot = process.cwd(),
  zenoDir = '.',
  zenoWorkspace?: string,
  serverName = 'zeno-planner'
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

      const serverEntry = buildMcpServerEntry(binaryPath, workspace)

      const content = JSON.stringify({ servers: { [serverName]: serverEntry } }, null, 2)
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

/**
 * Read-merge-write a single MCP server entry into a `.code-workspace` JSONC file.
 *
 * Paths use VS Code `${workspaceFolder:name}` variable substitution so the
 * file can be committed without embedding machine-specific absolute paths.
 *
 * @param workspaceFilePath - Absolute path to the `.code-workspace` file.
 * @param entry.serverName        - MCP server key (e.g. `'zeno-my-project'`).
 * @param entry.zenoFolderName    - Workspace folder display name for the Zeno install.
 * @param entry.consumerFolderName - Workspace folder display name for the consumer project.
 * @param entry.submodulePath     - Relative path to the Zeno submodule inside the consumer
 *                                   folder (e.g. `'zeno'`). When omitted, the binary is
 *                                   assumed to be under the Zeno workspace folder directly.
 * @returns `true` when the file was modified; `false` when the entry was already identical.
 */
export function ensureCodeWorkspaceMcp(
  workspaceFilePath: string,
  entry: {
    serverName: string
    zenoFolderName: string
    consumerFolderName: string
    submodulePath?: string
  }
): boolean {
  const { serverName, zenoFolderName, consumerFolderName, submodulePath } = entry

  // Build the binary path using VS Code variable substitution for portability.
  const binaryPath = submodulePath
    ? `\${workspaceFolder:${consumerFolderName}}/${submodulePath}/bin/mcp-server.js`
    : `\${workspaceFolder:${zenoFolderName}}/bin/mcp-server.js`

  const workspace = `\${workspaceFolder:${consumerFolderName}}`

  const serverEntry = buildMcpServerEntry(binaryPath, workspace)

  // Read the existing file or start with a minimal skeleton.
  const existingContent = existsSync(workspaceFilePath)
    ? readFileSync(workspaceFilePath, 'utf-8')
    : JSON.stringify({ folders: [], settings: {} }, null, 2)

  // Check if the entry already exists and is identical — idempotency guard.
  try {
    const existing = jsoncParse(existingContent) as Record<string, unknown>
    const existingServers = (
      (existing['settings'] as Record<string, unknown> | undefined)?.
      ['mcp'] as Record<string, unknown> | undefined
    )?.['servers'] as Record<string, unknown> | undefined

    if (existingServers?.[serverName] !== undefined) {
      const existingEntry = existingServers[serverName]
      if (JSON.stringify(existingEntry) === JSON.stringify(serverEntry)) {
        return false // already identical — no modification needed
      }
    }
  } catch {
    // parse error — proceed with write
  }

  // Build the JSON path for jsonc-parser's modify() helper.
  // The path segments drill into settings → mcp → servers → <serverName>.
  const jsonPath = ['settings', 'mcp', 'servers', serverName]
  const formattingOptions = { tabSize: 2, insertSpaces: true, eol: '\n' }

  const edits = modify(existingContent, jsonPath, serverEntry, { formattingOptions })
  const updatedContent = applyEdits(existingContent, edits)

  // Ensure the parent directory exists.
  const parentDir = join(workspaceFilePath, '..')
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true })
  }

  writeFileSync(workspaceFilePath, updatedContent, { encoding: 'utf-8' })
  logger.info(`Wrote MCP entry '${serverName}' to ${workspaceFilePath}`)
  return true
}

// ── Auto-detection helpers ────────────────────────────────────────────────────

/**
 * Search for a `.code-workspace` file near the project root.
 *
 * Looks in `projectRoot` first, then its immediate parent directory.
 * Returns the first match found, or `undefined` if none exist.
 */
export function findCodeWorkspaceFile(projectRoot: string): string | undefined {
  try {
    const entries = readdirSync(projectRoot).filter(f => f.endsWith('.code-workspace'))
    const first = entries[0]
    if (first) return join(projectRoot, first)
  } catch { /* directory unreadable */ }

  try {
    const parent = dirname(projectRoot)
    if (normalizePath(parent) !== normalizePath(projectRoot)) {
      const parentEntries = readdirSync(parent).filter(f => f.endsWith('.code-workspace'))
      const firstParent = parentEntries[0]
      if (firstParent) return join(parent, firstParent)
    }
  } catch { /* directory unreadable */ }

  return undefined
}

/**
 * Parse a `.code-workspace` file and identify the Zeno tool folder and the
 * consumer project folder by inspecting each folder entry.
 *
 * A folder is considered the "Zeno tool" if it contains `bin/mcp-server.js`.
 * A folder is the "consumer project" if its absolute path matches `projectRoot`.
 */
export function extractWorkspaceFolders(
  wsFilePath: string,
  projectRoot: string
): { zeno: string; consumer: string } | undefined {
  try {
    const content = readFileSync(wsFilePath, 'utf-8')
    const parsed = jsoncParse(content) as { folders?: { path: string; name?: string }[] }
    if (!parsed.folders) return undefined

    const wsDir = dirname(wsFilePath)
    let zenoName: string | undefined
    let consumerName: string | undefined

    for (const folder of parsed.folders) {
      const absPath = normalizePath(resolve(wsDir, folder.path))
      const name = folder.name ?? basename(folder.path)

      if (existsSync(join(absPath, 'bin', 'mcp-server.js'))) {
        zenoName = name
      }
      if (normalizePath(absPath) === normalizePath(projectRoot)) {
        consumerName = name
      }
    }

    if (zenoName && consumerName) return { zeno: zenoName, consumer: consumerName }
    return undefined
  } catch {
    return undefined
  }
}

// ── Unified MCP installation ──────────────────────────────────────────────────

export interface McpInstallResult {
  target: 'mcp-json' | 'code-workspace'
  targetPath: string
  serverName: string
  written: boolean
}

/**
 * Unified MCP configuration installer.
 *
 * Auto-detects the workspace topology and writes the correct MCP config:
 *
 * 1. Detects if `zeno/` is a git submodule → binary at `./zeno/bin/`, else at `./bin/`.
 * 2. Searches for a `.code-workspace` file → if found, writes to it using
 *    `${workspaceFolder:name}` variable substitution.
 * 3. Falls back to `.vscode/mcp.json` for single-folder projects.
 *
 * The only user-configurable option is `serverName` (defaults to config value
 * or `'zeno-' + projectSlug`).
 *
 * @param projectRoot - Project root directory.
 * @param options.serverName - Override MCP server key.
 * @param options.dryRun     - When true, returns the result without writing files.
 * @returns What was written and where.
 */
export async function installMcpConfig(
  projectRoot: string,
  options?: { serverName?: string; dryRun?: boolean }
): Promise<McpInstallResult> {
  const isSubmod = isSubmoduleLayout(projectRoot)

  // Resolve server name: CLI override → config → auto-generated
  let serverName = options?.serverName
  if (!serverName) {
    try {
      const cfg = await loadConfig(projectRoot)
      serverName = cfg.zenoServerName
    } catch { /* config may not exist yet */ }
  }
  serverName ??= 'zeno-' + toSlug(basename(projectRoot))

  // Check if Zeno binaries are present
  const installCheck = isZenoInstalled(projectRoot)
  if (!installCheck.valid) {
    throw new Error(`Zeno is not properly installed: ${installCheck.reason ?? 'unknown'}`)
  }

  // Attempt .code-workspace mode
  const wsFile = findCodeWorkspaceFile(projectRoot)
  if (wsFile) {
    const folders = extractWorkspaceFolders(wsFile, projectRoot)
    if (folders) {
      const submodulePath = isSubmod ? 'zeno' : undefined
      const targetPath = wsFile

      if (options?.dryRun) {
        const binaryRef = submodulePath
          ? `\${workspaceFolder:${folders.consumer}}/${submodulePath}/bin/mcp-server.js`
          : `\${workspaceFolder:${folders.zeno}}/bin/mcp-server.js`
        logger.info(`Dry run: would write MCP entry '${serverName}' to ${targetPath}`)
        logger.info(`  Binary: ${binaryRef}`)
        logger.info(`  ZENO_WORKSPACE: \${workspaceFolder:${folders.consumer}}`)
        return { target: 'code-workspace', targetPath, serverName, written: false }
      }

      const written = ensureCodeWorkspaceMcp(wsFile, {
        serverName,
        zenoFolderName: folders.zeno,
        consumerFolderName: folders.consumer,
        submodulePath,
      })
      return { target: 'code-workspace', targetPath, serverName, written }
    }
  }

  // Fall back to .vscode/mcp.json
  const toolDir = isSubmod ? 'zeno' : '.'
  const targetPath = join(projectRoot, '.vscode', 'mcp.json')

  if (options?.dryRun) {
    const binaryPath = toolDir === '.' ? './bin/mcp-server.js' : `./${toolDir}/bin/mcp-server.js`
    logger.info(`Dry run: would write .vscode/mcp.json`)
    logger.info(`  Binary: ${binaryPath}`)
    if (isSubmod) logger.info(`  ZENO_WORKSPACE: ${projectRoot}`)
    return { target: 'mcp-json', targetPath, serverName, written: false }
  }

  const workspace = isSubmod ? projectRoot : undefined
  const written = ensureWorkspaceMcp(projectRoot, toolDir, workspace, serverName)
  return { target: 'mcp-json', targetPath, serverName, written }
}
