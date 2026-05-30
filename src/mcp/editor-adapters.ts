/**
 * Lightweight Editor Adapter Helpers
 *
 * Provides small utilities to produce activation commands and adapter helpers
 * for editors that don't natively support workspace-level `mcp.json`.
 */

import { basename, dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs'
import { modify, applyEdits, parse as jsoncParse } from 'jsonc-parser'
import { logger } from '../utils/logger.js'
import { isSubmoduleLayout, getZenoToolDir, loadConfig, toSlug } from '../utils/config.js'
import { normalizePath } from '../utils/file.js'

export type McpInstallScope = 'workspace' | 'user'

export interface GlobalMcpLaunch {
  command: string
  args: string[]
  isExplicitPath: boolean
}

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

function splitPathEntries(pathValue: string, platform: NodeJS.Platform): string[] {
  const separator = platform === 'win32' ? ';' : ':'
  return pathValue.split(separator).filter(Boolean)
}

function findCommandOnPath(
  executableNames: string[],
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv
): string | undefined {
  const pathValue = env['Path'] ?? env['PATH'] ?? ''

  for (const pathEntry of splitPathEntries(pathValue, platform)) {
    for (const executableName of executableNames) {
      const candidate = join(pathEntry, executableName)
      if (existsSync(candidate)) {
        return candidate
      }
    }
  }

  return undefined
}

export function getDefaultVsCodeUserMcpPath(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (platform === 'win32') {
    const appData = env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming')
    return join(appData, 'Code', 'User', 'mcp.json')
  }

  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json')
  }

  const xdgConfigHome = env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config')
  return join(xdgConfigHome, 'Code', 'User', 'mcp.json')
}

export function resolveGlobalZenoMcpLaunch(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): GlobalMcpLaunch {
  if (platform === 'win32') {
    const explicitCommand =
      findCommandOnPath(['zeno-mcp.cmd'], platform, env) ??
      (() => {
        const appData = env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming')
        const candidate = join(appData, 'npm', 'zeno-mcp.cmd')
        return existsSync(candidate) ? candidate : undefined
      })()

    if (explicitCommand) {
      return {
        command: explicitCommand,
        args: [],
        isExplicitPath: true,
      }
    }
  }

  return {
    command: 'zeno-mcp',
    args: [],
    isExplicitPath: false,
  }
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
export function buildMcpCommandEntry(
  command: string,
  args: string[] = [],
  workspace?: string
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    type: 'stdio',
    command,
    args,
    description: 'Zeno Planner MCP server for AI-powered project management',
  }
  if (workspace !== undefined) {
    entry['env'] = { ZENO_WORKSPACE: workspace }
  }
  return entry
}

export function buildMcpServerEntry(
  binaryPath: string,
  workspace?: string
): Record<string, unknown> {
  return buildMcpCommandEntry('node', [binaryPath], workspace)
}

function upsertMcpConfigEntry(
  target: string,
  serverName: string,
  serverEntry: Record<string, unknown>
): boolean {
  const parentDir = dirname(target)

  try {
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true })
    }

    const existingContent = existsSync(target)
      ? readFileSync(target, 'utf-8')
      : JSON.stringify({ servers: {} }, null, 2)

    try {
      const existing = jsoncParse(existingContent) as Record<string, unknown>
      const existingServers = existing['servers'] as Record<string, unknown> | undefined
      const existingEntry = existingServers?.[serverName]
      if (existingEntry !== undefined && JSON.stringify(existingEntry) === JSON.stringify(serverEntry)) {
        return false
      }
    } catch {
      // Parse errors fall through to a full rewrite.
    }

    const edits = modify(existingContent, ['servers', serverName], serverEntry, {
      formattingOptions: { tabSize: 2, insertSpaces: true, eol: '\n' },
    })
    const updatedContent = applyEdits(existingContent, edits)
    writeFileSync(target, updatedContent, { encoding: 'utf-8' })
    logger.info(`Wrote workspace mcp.json to ${target}`)
    return true
  } catch (err) {
    logger.warn('Failed to ensure workspace MCP configuration', err)
    return false
  }
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
 * @param zenoWorkspace - Optional explicit workspace path to set as `ZENO_WORKSPACE`.
 *                        When omitted, defaults to the VS Code variable
 *                        `${workspaceFolder}` so the same `mcp.json` works
 *                        regardless of where the project lives on disk and
 *                        for any window opening the folder.
 * @param serverName    - MCP server key (default: `'zeno-planner'`).
 */
export function ensureWorkspaceMcp(
  projectRoot = process.cwd(),
  zenoDir = '.',
  zenoWorkspace?: string,
  serverName = 'zeno-planner'
): boolean {
  const binaryPath = zenoDir === '.' ? './bin/mcp-server.js' : `./${zenoDir}/bin/mcp-server.js`

  // Inject ZENO_WORKSPACE so the MCP server targets the consumer project
  // root regardless of the working directory it is started in. Default to
  // the VS Code `${workspaceFolder}` variable so the file is portable.
  const workspace = zenoWorkspace ?? '${workspaceFolder}'
  const target = join(projectRoot, '.vscode', 'mcp.json')

  return upsertMcpConfigEntry(target, serverName, buildMcpServerEntry(binaryPath, workspace))
}

export interface EnsureUserMcpOptions {
  userMcpPath?: string
  serverName?: string
  workspace?: string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
}

export function ensureUserMcp(options: EnsureUserMcpOptions = {}): boolean {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const target = options.userMcpPath ?? getDefaultVsCodeUserMcpPath(platform, env)
  const workspace = options.workspace ?? '${workspaceFolder}'
  const serverName = options.serverName ?? 'zeno-planner'
  const launch = resolveGlobalZenoMcpLaunch(platform, env)

  return upsertMcpConfigEntry(
    target,
    serverName,
    buildMcpCommandEntry(launch.command, launch.args, workspace)
  )
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
  target: 'mcp-json' | 'user-mcp-json' | 'code-workspace'
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
 * 2. Searches for a `.code-workspace` file → if found, uses it only to derive
 *    `${workspaceFolder:name}` variables for sibling roots.
 * 3. Writes either workspace `.vscode/mcp.json` or the VS Code user-profile
 *    `mcp.json`, depending on the requested scope.
 *
 * The only user-configurable option is `serverName` (defaults to config value
 * or `'zeno-' + projectSlug`).
 *
 * @param projectRoot - Project root directory.
 * @param options.serverName - Override MCP server key.
 * @param options.dryRun     - When true, returns the result without writing files.
 * @param options.scope      - Install into the workspace or VS Code user profile.
 * @returns What was written and where.
 */
export async function installMcpConfig(
  projectRoot: string,
  options?: {
    serverName?: string
    dryRun?: boolean
    scope?: McpInstallScope
    userMcpPath?: string
    platform?: NodeJS.Platform
    env?: NodeJS.ProcessEnv
  }
): Promise<McpInstallResult> {
  const scope = options?.scope ?? 'workspace'
  const platform = options?.platform ?? process.platform
  const env = options?.env ?? process.env
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

  if (scope === 'user') {
    const targetPath = options?.userMcpPath ?? getDefaultVsCodeUserMcpPath(platform, env)
    const launch = resolveGlobalZenoMcpLaunch(platform, env)
    const workspace = '${workspaceFolder}'

    if (platform === 'win32' && !launch.isExplicitPath) {
      throw new Error(
        'Could not resolve an explicit zeno-mcp.cmd on PATH for a global MCP install. Install Zeno globally first or use workspace-scoped `zeno mcp install`.'
      )
    }

    if (options?.dryRun) {
      logger.info(`Dry run: would write user mcp.json to ${targetPath}`)
      logger.info(`  Command: ${launch.command}`)
      logger.info(`  Args: ${launch.args.join(' ') || '(none)'}`)
      logger.info(`  ZENO_WORKSPACE: ${workspace}`)
      return { target: 'user-mcp-json', targetPath, serverName, written: false }
    }

    const written = ensureUserMcp({
      userMcpPath: targetPath,
      serverName,
      workspace,
      platform,
      env,
    })
    return { target: 'user-mcp-json', targetPath, serverName, written }
  }

  // Check if Zeno binaries are present for workspace-scoped installs.
  const installCheck = isZenoInstalled(projectRoot)
  if (!installCheck.valid) {
    throw new Error(`Zeno is not properly installed: ${installCheck.reason ?? 'unknown'}`)
  }

  const targetPath = join(projectRoot, '.vscode', 'mcp.json')

  // If a multi-root workspace is present, use it only to derive named
  // `${workspaceFolder:<name>}` variables. Current VS Code MCP discovery is
  // documented around `mcp.json`, not `.code-workspace` settings.
  const wsFile = findCodeWorkspaceFile(projectRoot)
  if (wsFile) {
    const folders = extractWorkspaceFolders(wsFile, projectRoot)
    if (folders) {
      const submodulePath = isSubmod ? 'zeno' : undefined
      const binaryPath = submodulePath
        ? `\${workspaceFolder:${folders.consumer}}/${submodulePath}/bin/mcp-server.js`
        : `\${workspaceFolder:${folders.zeno}}/bin/mcp-server.js`
      const workspace = `\${workspaceFolder:${folders.consumer}}`
      const serverEntry = buildMcpServerEntry(binaryPath, workspace)

      if (options?.dryRun) {
        logger.info(`Dry run: would write MCP entry '${serverName}' to ${targetPath}`)
        logger.info(`  Binary: ${binaryPath}`)
        logger.info(`  ZENO_WORKSPACE: ${workspace}`)
        return { target: 'mcp-json', targetPath, serverName, written: false }
      }

      const written = upsertMcpConfigEntry(targetPath, serverName, serverEntry)
      return { target: 'mcp-json', targetPath, serverName, written }
    }
  }

  // Fall back to .vscode/mcp.json
  const toolDir = isSubmod ? 'zeno' : '.'
  const binaryPath = toolDir === '.' ? './bin/mcp-server.js' : `./${toolDir}/bin/mcp-server.js`
  const workspace = '${workspaceFolder}'

  if (options?.dryRun) {
    logger.info(`Dry run: would write .vscode/mcp.json`)
    logger.info(`  Binary: ${binaryPath}`)
    logger.info(`  ZENO_WORKSPACE: ${workspace}`)
    return { target: 'mcp-json', targetPath, serverName, written: false }
  }

  const written = upsertMcpConfigEntry(targetPath, serverName, buildMcpServerEntry(binaryPath, workspace))
  return { target: 'mcp-json', targetPath, serverName, written }
}
