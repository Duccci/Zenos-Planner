/**
 * MCP Server Diagnostics
 *
 * Provides health checks and diagnostic reporting for the MCP server.
 * Reports server status, tool availability, configuration, and error history.
 */

import { FunctionRegistry } from '../integration/function-registry.js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as jsoncParse } from 'jsonc-parser'
import { logger } from '../utils/logger.js'
import { loadConfig } from '../utils/config.js'
import { getDatabasePath } from '../storage/database.js'
import { getDefaultVsCodeUserMcpPath } from './editor-adapters.js'

/**
 * Server health status
 */
export interface ServerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  toolsRegistered: number
  lastError?: {
    timestamp: Date
    error: string
    function?: string
  }
}

/**
 * Tool availability information
 */
export interface ToolInfo {
  name: string
  description: string
  parameters: string[]
  hasSchema: boolean
}

/**
 * Configuration status
 */
export interface ConfigStatus {
  projectRoot: string
  configLoaded: boolean
  databasePath?: string
  hasGit: boolean
  mcpConfigExists: boolean
  workspaceMcpConfigExists: boolean
  userMcpConfigExists: boolean
  mcpExecutableExists: boolean
  workspaceServerNames: string[]
  userServerNames: string[]
  duplicateServerNames: string[]
  warnings: string[]
  vscodeVersion?: string
}

function readMcpServers(configPath: string): Record<string, Record<string, unknown>> {
  if (!existsSync(configPath)) {
    return {}
  }

  try {
    const parsed = jsoncParse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
    const servers = parsed['servers']
    return servers && typeof servers === 'object'
      ? (servers as Record<string, Record<string, unknown>>)
      : {}
  } catch {
    return {}
  }
}

function usesBareWindowsZenoCommand(entry: Record<string, unknown>): boolean {
  if (process.platform !== 'win32') {
    return false
  }

  const command = typeof entry['command'] === 'string' ? entry['command'].trim().toLowerCase() : ''
  return command === 'zeno-mcp'
}

/**
 * Diagnostic report
 */
export interface DiagnosticReport {
  health: ServerHealth
  tools: ToolInfo[]
  config: ConfigStatus
  recentErrors: {
    timestamp: Date
    function: string
    error: string
  }[]
}

/**
 * Diagnostics manager for MCP server
 */
export class McpDiagnostics {
  private startTime: Date
  private recentErrors: {
    timestamp: Date
    function: string
    error: string
  }[] = []
  private maxErrors = 10

  constructor() {
    this.startTime = new Date()
  }

  /**
   * Record an error for diagnostics
   */
  recordError(functionName: string, error: string): void {
    this.recentErrors.unshift({
      timestamp: new Date(),
      function: functionName,
      error,
    })

    // Keep only the most recent errors
    if (this.recentErrors.length > this.maxErrors) {
      this.recentErrors = this.recentErrors.slice(0, this.maxErrors)
    }

    logger.debug(`Recorded error for diagnostics: ${functionName}`)
  }

  /**
   * Get server health status
   */
  getHealth(toolsRegistered: number): ServerHealth {
    const uptime = Date.now() - this.startTime.getTime()
    const hasRecentErrors = this.recentErrors.length > 0

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (hasRecentErrors) {
      status = 'degraded'
    }

    if (toolsRegistered === 0) {
      status = 'unhealthy'
    }

    return {
      status,
      uptime,
      toolsRegistered,
      lastError: this.recentErrors[0],
    }
  }

  /**
   * Get tool information
   */
  getToolInfo(registry: FunctionRegistry): ToolInfo[] {
    return registry.list().map((func) => ({
      name: func.name,
      description: func.description,
      parameters: func.parameters.map((p) => p.name),
      hasSchema: true, // All registered functions have schemas
    }))
  }

  /**
   * Get configuration status
   */
  async getConfigStatus(): Promise<ConfigStatus> {
    try {
      await loadConfig()
      const configStatus: ConfigStatus = {
        projectRoot: process.cwd(),
        configLoaded: true,
        databasePath: getDatabasePath(),
        hasGit: true, // Assume git is available for now
        mcpConfigExists: false,
        workspaceMcpConfigExists: false,
        userMcpConfigExists: false,
        mcpExecutableExists: false,
        workspaceServerNames: [],
        userServerNames: [],
        duplicateServerNames: [],
        warnings: [],
      }

      const workspaceMcpConfigPath = join(process.cwd(), '.vscode', 'mcp.json')
      const userMcpConfigPath = getDefaultVsCodeUserMcpPath()
      const workspaceServers = readMcpServers(workspaceMcpConfigPath)
      const userServers = readMcpServers(userMcpConfigPath)

      configStatus.workspaceMcpConfigExists = existsSync(workspaceMcpConfigPath)
      configStatus.userMcpConfigExists = existsSync(userMcpConfigPath)
      configStatus.mcpConfigExists =
        configStatus.workspaceMcpConfigExists || configStatus.userMcpConfigExists
      configStatus.workspaceServerNames = Object.keys(workspaceServers)
      configStatus.userServerNames = Object.keys(userServers)
      configStatus.duplicateServerNames = configStatus.workspaceServerNames.filter((name) =>
        configStatus.userServerNames.includes(name)
      )

      if (configStatus.duplicateServerNames.length > 0) {
        configStatus.warnings.push(
          `Server name configured in both workspace and user MCP config: ${configStatus.duplicateServerNames.join(', ')}`
        )
      }

      const riskyWindowsServers = [
        ...Object.entries(workspaceServers).map(([name, entry]) => ({ scope: 'workspace', name, entry })),
        ...Object.entries(userServers).map(([name, entry]) => ({ scope: 'user', name, entry })),
      ].filter(({ entry }) => usesBareWindowsZenoCommand(entry))

      if (riskyWindowsServers.length > 0) {
        configStatus.warnings.push(
          `Windows Zeno MCP launch uses bare 'zeno-mcp' in ${riskyWindowsServers
            .map(({ scope, name }) => `${scope}:${name}`)
            .join(', ')}. Prefer an explicit zeno-mcp.cmd path.`
        )
      }

      // Check for MCP executable
      try {
        const execPath = join(process.cwd(), 'bin', 'mcp-server.js')
        configStatus.mcpExecutableExists = existsSync(execPath)
      } catch {
        // Ignore
      }

      return configStatus
    } catch {
      return {
        projectRoot: process.cwd(),
        configLoaded: false,
        hasGit: false,
        mcpConfigExists: false,
        workspaceMcpConfigExists: false,
        userMcpConfigExists: false,
        mcpExecutableExists: false,
        workspaceServerNames: [],
        userServerNames: [],
        duplicateServerNames: [],
        warnings: [],
      }
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(): {
    timestamp: Date
    function: string
    error: string
  }[] {
    return [...this.recentErrors]
  }

  /**
   * Generate complete diagnostic report
   */
  async generateReport(registry: FunctionRegistry): Promise<DiagnosticReport> {
    const toolsRegistered = registry.list().length

    return {
      health: this.getHealth(toolsRegistered),
      tools: this.getToolInfo(registry),
      config: await this.getConfigStatus(),
      recentErrors: this.recentErrors,
    }
  }

  /**
   * Format diagnostic report as readable text
   */
  async formatReport(registry: FunctionRegistry): Promise<string> {
    const report = await this.generateReport(registry)
    const lines: string[] = []

    lines.push('=== MCP Server Diagnostics ===')
    lines.push('')

    // Health
    lines.push('Health Status:')
    lines.push(`  Status: ${report.health.status.toUpperCase()}`)
    lines.push(`  Uptime: ${String(Math.round(report.health.uptime / 1000))}s`)
    lines.push(`  Tools Registered: ${String(report.health.toolsRegistered)}`)
    if (report.health.lastError) {
      lines.push(
        `  Last Error: ${report.health.lastError.error} (${report.health.lastError.function ?? 'unknown'})`
      )
    }
    lines.push('')

    // Configuration
    lines.push('Configuration:')
    lines.push(`  Project Root: ${report.config.projectRoot}`)
    lines.push(`  Config Loaded: ${report.config.configLoaded ? 'Yes' : 'No'}`)
    if (report.config.databasePath) {
      lines.push(`  Database: ${report.config.databasePath}`)
    }
    lines.push(`  Git Available: ${report.config.hasGit ? 'Yes' : 'No'}`)
    lines.push(
      `  Workspace MCP Config: ${report.config.workspaceMcpConfigExists ? 'Found (.vscode/mcp.json)' : 'Missing (.vscode/mcp.json)'}`
    )
    lines.push(
      `  User MCP Config: ${report.config.userMcpConfigExists ? `Found (${getDefaultVsCodeUserMcpPath()})` : `Missing (${getDefaultVsCodeUserMcpPath()})`}`
    )
    lines.push(
      `  MCP Executable: ${report.config.mcpExecutableExists ? 'Found (bin/mcp-server.js)' : 'Missing (bin/mcp-server.js)'}`
    )
    if (report.config.workspaceServerNames.length > 0) {
      lines.push(`  Workspace Servers: ${report.config.workspaceServerNames.join(', ')}`)
    }
    if (report.config.userServerNames.length > 0) {
      lines.push(`  User Servers: ${report.config.userServerNames.join(', ')}`)
    }
    if (report.config.duplicateServerNames.length > 0) {
      lines.push(`  Duplicate Server Names: ${report.config.duplicateServerNames.join(', ')}`)
    }
    lines.push('')

    // VSCode Troubleshooting
    if (
      !report.config.mcpConfigExists ||
      (report.config.workspaceMcpConfigExists && !report.config.mcpExecutableExists) ||
      report.config.warnings.length > 0
    ) {
      lines.push('VSCode MCP Troubleshooting:')
      if (!report.config.workspaceMcpConfigExists) {
        lines.push('  - Run: zeno mcp install')
        lines.push('  - Creates .vscode/mcp.json configuration')
      }
      if (!report.config.userMcpConfigExists) {
        lines.push('  - Run: zeno mcp install --global')
        lines.push('  - Creates the VS Code user-profile mcp.json configuration')
      }
      if (report.config.workspaceMcpConfigExists && !report.config.mcpExecutableExists) {
        lines.push('  - Run: npm run build')
        lines.push('  - Compiles TypeScript to bin/mcp-server.js')
      }
      if (report.config.duplicateServerNames.length > 0) {
        lines.push('  - Remove the duplicate server name from either workspace or user scope, or rename one of them')
      }
      for (const warning of report.config.warnings) {
        lines.push(`  - ${warning}`)
      }
      lines.push('  - Restart VSCode MCP server from command palette')
      lines.push('')
    }

    // Tools
    lines.push('Registered Tools:')
    for (const tool of report.tools) {
      lines.push(`  ${tool.name}: ${tool.description}`)
      lines.push(`    Parameters: ${tool.parameters.join(', ')}`)
    }
    lines.push('')

    // Recent Errors
    if (report.recentErrors.length > 0) {
      lines.push('Recent Errors:')
      for (const error of report.recentErrors) {
        lines.push(`  ${error.timestamp.toISOString()}: ${error.function} - ${error.error}`)
      }
    } else {
      lines.push('No recent errors')
    }

    return lines.join('\n')
  }
}

// Global diagnostics instance
export const diagnostics = new McpDiagnostics()
