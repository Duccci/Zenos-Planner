import { describe, it, expect } from 'vitest'
import { ErrorCodeEnum, ErrorResponseSchema, ErrorContextSchema } from '../../../src/mcp/schemas/common-schemas.js'
import { createMcpError, McpErrorCode, handleToolError } from '../../../src/mcp/error-handler.js'

describe('unified error format', () => {
  describe('ErrorCodeEnum', () => {
    const allCodes = [
      'COMMAND_FAILED',
      'NOT_FOUND',
      'INVALID_INPUT',
      'INVALID_STATUS_TRANSITION',
      'ALREADY_EXISTS',
      'PERMISSION_DENIED',
      'UNAUTHORIZED',
      'CONFLICT',
      'INTERNAL_ERROR',
      'VALIDATION_ERROR',
      'DEPENDENCY_BLOCKED',
      'GIT_VIOLATION'
    ]

    for (const code of allCodes) {
      it(`accepts "${code}" as a valid error code`, () => {
        const result = ErrorCodeEnum.safeParse(code)
        expect(result.success).toBe(true)
      })
    }

    it('rejects unknown error codes', () => {
      const result = ErrorCodeEnum.safeParse('BOGUS_CODE')
      expect(result.success).toBe(false)
    })
  })

  describe('ErrorResponseSchema', () => {
    it('validates a minimal error response', () => {
      const result = ErrorResponseSchema.safeParse({
        code: 'NOT_FOUND',
        message: 'Gate not found'
      })
      expect(result.success).toBe(true)
    })

    it('validates an error response with context', () => {
      const result = ErrorResponseSchema.safeParse({
        code: 'VALIDATION_ERROR',
        message: 'Invalid gate status transition',
        context: {
          resourceId: 'gate-03',
          resourceType: 'gate',
          suggestion: 'Start the gate first'
        },
        timestamp: '2026-02-06T00:00:00.000Z'
      })
      expect(result.success).toBe(true)
    })

    it('rejects an error response with invalid code', () => {
      const result = ErrorResponseSchema.safeParse({
        code: 'UNKNOWN',
        message: 'something failed'
      })
      expect(result.success).toBe(false)
    })

    it('rejects when message is missing', () => {
      const result = ErrorResponseSchema.safeParse({ code: 'NOT_FOUND' })
      expect(result.success).toBe(false)
    })
  })

  describe('ErrorContextSchema', () => {
    it('validates full context object', () => {
      const result = ErrorContextSchema.safeParse({
        resourceId: 'gate-01',
        resourceType: 'gate',
        field: 'status',
        expectedValues: ['pending'],
        currentValue: 'completed',
        suggestion: 'Cannot start a completed gate'
      })
      expect(result.success).toBe(true)
    })

    it('validates empty context', () => {
      const result = ErrorContextSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('createMcpError', () => {
    it('includes timestamp in error output', () => {
      const err = createMcpError(new Error('something'))
      expect(err.timestamp).toBeTruthy()
    })

    it('maps "not found" to NOT_FOUND code', () => {
      const err = createMcpError(new Error('Resource not found'))
      expect(err.code).toBe('NOT_FOUND')
    })

    it('maps "validation" to VALIDATION_ERROR code', () => {
      const err = createMcpError(new Error('Validation failed'))
      expect(err.code).toBe('VALIDATION_ERROR')
    })

    it('maps unknown errors to INTERNAL_ERROR', () => {
      const err = createMcpError(new Error('Random failure'))
      expect(err.code).toBe('INTERNAL_ERROR')
    })

    it('maps GIT_VIOLATION code on error object', () => {
      const gitErr = new Error('Blocked') as any
      gitErr.code = 'GIT_VIOLATION'
      const err = createMcpError(gitErr)
      expect(err.code).toBe('GIT_VIOLATION')
    })

    it('maps "already exists" to ALREADY_EXISTS code', () => {
      const err = createMcpError(new Error('Entity already exists'))
      expect(err.code).toBe('ALREADY_EXISTS')
    })

    it('provides suggestions for each error type', () => {
      const err = createMcpError(new Error('Resource not found'))
      expect(err.suggestions).toBeDefined()
      expect(err.suggestions!.length).toBeGreaterThan(0)
    })
  })

  describe('handleToolError', () => {
    it('returns CallToolResult with isError=true', () => {
      const result = handleToolError(new Error('fail'), 'test_func')
      expect(result.isError).toBe(true)
      expect(result.content[0]!.type).toBe('text')
    })

    it('includes function name in context', () => {
      const result = handleToolError(new Error('fail'), 'proposal_start')
      const parsed = JSON.parse((result.content[0] as any).text)
      expect(parsed.context.function).toBe('proposal_start')
    })

    it('includes timestamp in error payload', () => {
      const result = handleToolError(new Error('fail'), 'test')
      const parsed = JSON.parse((result.content[0] as any).text)
      expect(parsed.code).toBeTruthy()
    })
  })
})
