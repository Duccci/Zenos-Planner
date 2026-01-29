/**
 * Zeno Error Handling System
 *
 * Provides typed error hierarchy for consistent error handling across the application.
 * All Zeno errors extend ZenoError base class with additional context and cause tracking.
 */

/** Error context for additional debugging information */
export type ErrorContext = Record<string, unknown>

/** Serialized error format for logging and transmission */
export interface SerializedError {
  name: string
  code: string
  message: string
  context: ErrorContext
  cause?: SerializedError
  stack?: string
}

/**
 * Base error class for all Zeno errors.
 * Extends native Error with code, context, and cause properties.
 */
export class ZenoError extends Error {
  readonly code: string
  readonly context: ErrorContext
  override readonly cause?: Error

  constructor(message: string, code: string, context: ErrorContext = {}, cause?: Error) {
    super(message)
    this.name = 'ZenoError'
    this.code = code
    this.context = context
    this.cause = cause

    // Preserve stack trace in V8 environments
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /** Serialize error for logging or transmission */
  toJSON(): SerializedError {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause instanceof ZenoError ? this.cause.toJSON() : undefined,
      stack: this.stack,
    }
  }
}

/**
 * File system operation errors.
 * Used for read, write, delete, and directory operations.
 */
export class FileSystemError extends ZenoError {
  constructor(message: string, code = 'FS_ERROR', context: ErrorContext = {}, cause?: Error) {
    super(message, code.startsWith('FS_') ? code : `FS_${code}`, context, cause)
    this.name = 'FileSystemError'
  }
}

/**
 * Database operation errors.
 * Used for SQLite queries, migrations, and connection issues.
 */
export class DatabaseError extends ZenoError {
  constructor(message: string, code = 'DB_ERROR', context: ErrorContext = {}, cause?: Error) {
    super(message, code.startsWith('DB_') ? code : `DB_${code}`, context, cause)
    this.name = 'DatabaseError'
  }
}

/**
 * Configuration errors.
 * Used for config file parsing, validation, and missing required values.
 */
export class ConfigError extends ZenoError {
  constructor(message: string, code = 'CONFIG_ERROR', context: ErrorContext = {}, cause?: Error) {
    super(message, code.startsWith('CONFIG_') ? code : `CONFIG_${code}`, context, cause)
    this.name = 'ConfigError'
  }
}

/**
 * Git operation errors.
 * Used for git status, commit, tag, and repository issues.
 */
export class GitError extends ZenoError {
  constructor(message: string, code = 'GIT_ERROR', context: ErrorContext = {}, cause?: Error) {
    super(message, code.startsWith('GIT_') ? code : `GIT_${code}`, context, cause)
    this.name = 'GitError'
  }
}

/**
 * Validation errors.
 * Used for schema validation, input validation, and constraint violations.
 */
export class ValidationError extends ZenoError {
  constructor(message: string, code = 'VALIDATION_ERROR', context: ErrorContext = {}, cause?: Error) {
    super(message, code.startsWith('VALIDATION_') ? code : `VALIDATION_${code}`, context, cause)
    this.name = 'ValidationError'
  }
}

/**
 * Hash operation errors.
 * Used for hash generation, verification, and registry issues.
 */
export class HashError extends ZenoError {
  constructor(message: string, code = 'HASH_ERROR', context: ErrorContext = {}, cause?: Error) {
    super(message, code.startsWith('HASH_') ? code : `HASH_${code}`, context, cause)
    this.name = 'HashError'
  }
}

/**
 * Type guard to check if an error is a ZenoError.
 */
export function isZenoError(error: unknown): error is ZenoError {
  return error instanceof ZenoError
}

/**
 * Format an error for user-friendly CLI display.
 * Strips stack traces and provides clean, readable output.
 */
export function formatError(error: unknown): string {
  if (isZenoError(error)) {
    const parts: string[] = [`Error [${error.code}]: ${error.message}`]

    if (Object.keys(error.context).length > 0) {
      parts.push(`Context: ${JSON.stringify(error.context)}`)
    }

    if (error.cause) {
      parts.push(`Caused by: ${formatError(error.cause)}`)
    }

    return parts.join('\n')
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`
  }

  if (typeof error === 'string') {
    return `Error: ${error}`
  }

  return `Error: ${String(error)}`
}

/**
 * Wrap an unknown error in a ZenoError.
 * Preserves original error as cause if it's an Error instance.
 */
export function wrapError(
  error: unknown,
  message: string,
  code = 'UNKNOWN_ERROR',
  context: ErrorContext = {}
): ZenoError {
  if (error instanceof Error) {
    return new ZenoError(message, code, context, error)
  }

  if (typeof error === 'string') {
    return new ZenoError(`${message}: ${error}`, code, context)
  }

  return new ZenoError(`${message}: ${String(error)}`, code, context)
}
