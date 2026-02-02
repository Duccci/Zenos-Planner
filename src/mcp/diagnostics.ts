/**
 * MCP Server Diagnostics
 *
 * Provides health checks and diagnostic reporting for the MCP server.
 * Reports server status, tool availability, configuration, and error history.
 */

import { FunctionRegistry } from '../integration/function-registry.js'
import { logger } from '../utils/logger.js'
import { loadConfig } from '../utils/config.js'
import { getDatabasePath } from '../storage/database.js'

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
}

/**
 * Diagnostic report
 */
export interface DiagnosticReport {
  health: ServerHealth
  tools: ToolInfo[]
  config: ConfigStatus
  recentErrors: Array<{
    timestamp: Date
    function: string
    error: string
  }>
}

/**
 * Diagnostics manager for MCP server
 */
export class McpDiagnostics {
  private startTime: Date
  private recentErrors: Array<{
    timestamp: Date
    function: string
    error: string
  }> = []
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
      error
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
      lastError: this.recentErrors[0]
    }
  }

  /**
   * Get tool information
   */
  getToolInfo(registry: FunctionRegistry): ToolInfo[] {
    return registry.list().map(func => ({
      name: func.name,
      description: func.description,
      parameters: func.parameters.map(p => p.name),
      hasSchema: true // All registered functions have schemas
    }))
  }

  /**
   * Get configuration status
   */
  async getConfigStatus(): Promise<ConfigStatus> {
    try {
      await loadConfig()
      return {
        projectRoot: process.cwd(),
        configLoaded: true,
        databasePath: getDatabasePath(),
        hasGit: true // Assume git is available for now
      }
    } catch (error) {
      return {
        projectRoot: process.cwd(),
        configLoaded: false,
        hasGit: false
      }
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(): Array<{
    timestamp: Date
    function: string
    error: string
  }> {
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
      recentErrors: this.recentErrors
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
    lines.push(`  Uptime: ${Math.round(report.health.uptime / 1000)}s`)
    lines.push(`  Tools Registered: ${report.health.toolsRegistered}`)
    if (report.health.lastError) {
      lines.push(`  Last Error: ${report.health.lastError.error} (${report.health.lastError.function})`)
    }
    lines.push('')

    // Configuration
    lines.push('Configuration:')
    lines.push(`  Project Root: ${report.config.projectRoot}`)
    lines.push(`  Config Loaded: ${report.config.configLoaded}`)
    if (report.config.databasePath) {
      lines.push(`  Database: ${report.config.databasePath}`)
    }
    lines.push(`  Git Available: ${report.config.hasGit}`)
    lines.push('')

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