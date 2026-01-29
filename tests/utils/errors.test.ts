import { describe, it, expect } from 'vitest'
import {
  ZenoError,
  FileSystemError,
  DatabaseError,
  ConfigError,
  GitError,
  ValidationError,
  HashError,
  isZenoError,
  formatError,
  wrapError,
} from '../../src/utils/errors.js'

describe('ZenoError', () => {
  it('creates error with message, code, and context', () => {
    const error = new ZenoError('Test error', 'TEST_CODE', { key: 'value' })

    expect(error.message).toBe('Test error')
    expect(error.code).toBe('TEST_CODE')
    expect(error.context).toEqual({ key: 'value' })
    expect(error.name).toBe('ZenoError')
  })

  it('preserves cause error', () => {
    const cause = new Error('Original error')
    const error = new ZenoError('Wrapped error', 'WRAP_CODE', {}, cause)

    expect(error.cause).toBe(cause)
  })

  it('has stack trace', () => {
    const error = new ZenoError('Test', 'CODE')
    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('ZenoError')
  })

  it('serializes to JSON correctly', () => {
    const cause = new ZenoError('Cause', 'CAUSE_CODE')
    const error = new ZenoError('Main', 'MAIN_CODE', { foo: 'bar' }, cause)

    const json = error.toJSON()

    expect(json.name).toBe('ZenoError')
    expect(json.code).toBe('MAIN_CODE')
    expect(json.message).toBe('Main')
    expect(json.context).toEqual({ foo: 'bar' })
    expect(json.cause?.code).toBe('CAUSE_CODE')
    expect(json.stack).toBeDefined()
  })
})

describe('Specialized Error Classes', () => {
  it('FileSystemError prefixes code with FS_', () => {
    const error = new FileSystemError('Read failed', 'READ_FAILED')
    expect(error.code).toBe('FS_READ_FAILED')
    expect(error.name).toBe('FileSystemError')
  })

  it('FileSystemError preserves FS_ prefix if already present', () => {
    const error = new FileSystemError('Write failed', 'FS_WRITE_FAILED')
    expect(error.code).toBe('FS_WRITE_FAILED')
  })

  it('DatabaseError prefixes code with DB_', () => {
    const error = new DatabaseError('Query failed', 'QUERY_FAILED')
    expect(error.code).toBe('DB_QUERY_FAILED')
    expect(error.name).toBe('DatabaseError')
  })

  it('ConfigError prefixes code with CONFIG_', () => {
    const error = new ConfigError('Parse failed', 'PARSE_FAILED')
    expect(error.code).toBe('CONFIG_PARSE_FAILED')
    expect(error.name).toBe('ConfigError')
  })

  it('GitError prefixes code with GIT_', () => {
    const error = new GitError('Commit failed', 'COMMIT_FAILED')
    expect(error.code).toBe('GIT_COMMIT_FAILED')
    expect(error.name).toBe('GitError')
  })

  it('ValidationError prefixes code with VALIDATION_', () => {
    const error = new ValidationError('Invalid input', 'INVALID_INPUT')
    expect(error.code).toBe('VALIDATION_INVALID_INPUT')
    expect(error.name).toBe('ValidationError')
  })

  it('HashError prefixes code with HASH_', () => {
    const error = new HashError('Hash mismatch', 'MISMATCH')
    expect(error.code).toBe('HASH_MISMATCH')
    expect(error.name).toBe('HashError')
  })

  it('all specialized errors extend ZenoError', () => {
    expect(new FileSystemError('test', 'TEST')).toBeInstanceOf(ZenoError)
    expect(new DatabaseError('test', 'TEST')).toBeInstanceOf(ZenoError)
    expect(new ConfigError('test', 'TEST')).toBeInstanceOf(ZenoError)
    expect(new GitError('test', 'TEST')).toBeInstanceOf(ZenoError)
    expect(new ValidationError('test', 'TEST')).toBeInstanceOf(ZenoError)
    expect(new HashError('test', 'TEST')).toBeInstanceOf(ZenoError)
  })

  it('DatabaseError preserves DB_ prefix if already present', () => {
    const error = new DatabaseError('Query failed', 'DB_QUERY_FAILED')
    expect(error.code).toBe('DB_QUERY_FAILED')
  })

  it('ConfigError preserves CONFIG_ prefix if already present', () => {
    const error = new ConfigError('Parse failed', 'CONFIG_PARSE_FAILED')
    expect(error.code).toBe('CONFIG_PARSE_FAILED')
  })

  it('GitError preserves GIT_ prefix if already present', () => {
    const error = new GitError('Commit failed', 'GIT_COMMIT_FAILED')
    expect(error.code).toBe('GIT_COMMIT_FAILED')
  })

  it('ValidationError preserves VALIDATION_ prefix if already present', () => {
    const error = new ValidationError('Invalid', 'VALIDATION_INVALID')
    expect(error.code).toBe('VALIDATION_INVALID')
  })

  it('HashError preserves HASH_ prefix if already present', () => {
    const error = new HashError('Mismatch', 'HASH_MISMATCH')
    expect(error.code).toBe('HASH_MISMATCH')
  })
})

describe('isZenoError', () => {
  it('returns true for ZenoError', () => {
    expect(isZenoError(new ZenoError('test', 'CODE'))).toBe(true)
  })

  it('returns true for specialized errors', () => {
    expect(isZenoError(new FileSystemError('test', 'CODE'))).toBe(true)
    expect(isZenoError(new DatabaseError('test', 'CODE'))).toBe(true)
  })

  it('returns false for native Error', () => {
    expect(isZenoError(new Error('test'))).toBe(false)
  })

  it('returns false for non-errors', () => {
    expect(isZenoError('string')).toBe(false)
    expect(isZenoError(null)).toBe(false)
    expect(isZenoError(undefined)).toBe(false)
    expect(isZenoError({})).toBe(false)
  })
})

describe('formatError', () => {
  it('formats ZenoError with code and message', () => {
    const error = new ZenoError('Something went wrong', 'SOMETHING_WRONG')
    const formatted = formatError(error)
    expect(formatted).toContain('Error [SOMETHING_WRONG]')
    expect(formatted).toContain('Something went wrong')
  })

  it('includes context in formatted output', () => {
    const error = new ZenoError('Failed', 'FAILED', { path: '/foo/bar' })
    const formatted = formatError(error)
    expect(formatted).toContain('Context:')
    expect(formatted).toContain('/foo/bar')
  })

  it('includes cause in formatted output', () => {
    const cause = new ZenoError('Root cause', 'ROOT')
    const error = new ZenoError('Wrapper', 'WRAPPER', {}, cause)
    const formatted = formatError(error)
    expect(formatted).toContain('Caused by:')
    expect(formatted).toContain('ROOT')
  })

  it('formats native Error', () => {
    const error = new Error('Native error')
    const formatted = formatError(error)
    expect(formatted).toBe('Error: Native error')
  })

  it('formats string error', () => {
    const formatted = formatError('string error')
    expect(formatted).toBe('Error: string error')
  })

  it('formats unknown error', () => {
    const formatted = formatError({ custom: 'object' })
    expect(formatted).toContain('Error:')
  })
})

describe('wrapError', () => {
  it('wraps Error with cause preserved', () => {
    const original = new Error('Original')
    const wrapped = wrapError(original, 'Wrapped message', 'WRAP_CODE')

    expect(wrapped.message).toBe('Wrapped message')
    expect(wrapped.code).toBe('WRAP_CODE')
    expect(wrapped.cause).toBe(original)
  })

  it('wraps string error', () => {
    const wrapped = wrapError('string error', 'Wrapper', 'CODE')
    expect(wrapped.message).toBe('Wrapper: string error')
    expect(wrapped.cause).toBeUndefined()
  })

  it('wraps unknown error', () => {
    const wrapped = wrapError(42, 'Unknown', 'CODE')
    expect(wrapped.message).toBe('Unknown: 42')
  })

  it('includes context in wrapped error', () => {
    const wrapped = wrapError(new Error('test'), 'Msg', 'CODE', { key: 'val' })
    expect(wrapped.context).toEqual({ key: 'val' })
  })

  it('uses default code if not provided', () => {
    const wrapped = wrapError(new Error('test'), 'Msg')
    expect(wrapped.code).toBe('UNKNOWN_ERROR')
  })
})

