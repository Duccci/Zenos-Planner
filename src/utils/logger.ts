/**
 * Zeno Logging System
 *
 * Provides leveled logging with colored output for CLI applications.
 * Supports debug, info, warn, and error levels with configurable filtering.
 */

import chalk from 'chalk'

/** Available log levels in order of severity */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Numeric values for log level comparison */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/** Get the current log level from environment or default to 'info' */
function getCurrentLevel(): LogLevel {
  const envLevel = process.env['ZENO_LOG_LEVEL']?.toLowerCase()
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel
  }
  return 'info'
}

/** Format a timestamp for debug output */
function formatTimestamp(): string {
  return new Date().toISOString()
}

/** Check if a log level should be displayed based on current level */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getCurrentLevel()
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

/**
 * Logger singleton for consistent logging across the application.
 */
export const logger = {
  /**
   * Log a debug message. Only shown when ZENO_LOG_LEVEL=debug.
   * Includes timestamp for debugging timing issues.
   */
  debug(message: string, ...args: unknown[]): void {
    if (!shouldLog('debug')) return
    const timestamp = chalk.gray(`[${formatTimestamp()}]`)
    const prefix = chalk.gray('[DEBUG]')
    console.log(timestamp, prefix, chalk.gray(message), ...args)
  },

  /**
   * Log an informational message. Default level.
   */
  info(message: string, ...args: unknown[]): void {
    if (!shouldLog('info')) return
    const prefix = chalk.blue('[INFO]')
    console.log(prefix, message, ...args)
  },

  /**
   * Log a warning message.
   */
  warn(message: string, ...args: unknown[]): void {
    if (!shouldLog('warn')) return
    const prefix = chalk.yellow('[WARN]')
    console.warn(prefix, chalk.yellow(message), ...args)
  },

  /**
   * Log an error message.
   */
  error(message: string, ...args: unknown[]): void {
    if (!shouldLog('error')) return
    const prefix = chalk.red('[ERROR]')
    console.error(prefix, chalk.red(message), ...args)
  },
}

/**
 * Log a visual section header for grouping related output.
 */
export function logSection(title: string): void {
  if (!shouldLog('info')) return
  const line = chalk.dim('-'.repeat(50))
  console.log(line)
  console.log(chalk.bold.cyan(title))
  console.log(line)
}

/**
 * Log tabular data with aligned columns.
 */
export function logTable(
  headers: string[],
  rows: string[][],
  options: { indent?: number } = {}
): void {
  if (!shouldLog('info')) return

  const indent = ' '.repeat(options.indent ?? 0)

  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const maxRowWidth = Math.max(...rows.map((row) => (row[i] ?? '').length))
    return Math.max(h.length, maxRowWidth)
  })

  // Format header
  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i] ?? 0)).join('  ')
  const separator = colWidths.map((w) => '-'.repeat(w)).join('  ')

  console.log(indent + chalk.bold(headerLine))
  console.log(indent + chalk.dim(separator))

  // Format rows
  for (const row of rows) {
    const formattedRow = row
      .map((cell, i) => {
        const width = colWidths[i]
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const cellValue = cell ?? ''
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        return cellValue.padEnd(width !== undefined ? width : 0)
      })
      .join('  ')
    console.log(indent + formattedRow)
  }
}

/**
 * Log a hash reference with consistent styling.
 * Hash references are displayed in cyan with a # prefix.
 */
export function logHash(hash: string): string {
  const normalizedHash = hash.startsWith('#') ? hash : `#${hash}`
  return chalk.cyan(normalizedHash)
}
