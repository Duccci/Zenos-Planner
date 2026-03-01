/**
 * CLI Tool Invoker Tests
 *
 * Tests for the CLI tool invocation system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  invokeCliTool,
  invokeProposalAction,
  invokeGatesAction,
  invokeRequirementAction,
} from '../../src/cli/cli-tool-invoker.js'
import { logger } from '../../src/utils/logger.js'

// Mock the registry
const mockRegistry = {
  invoke: vi.fn(),
}

vi.mock('../../src/integration/function-implementations.js', () => ({
  getGlobalRegistry: vi.fn(() => mockRegistry),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('CLI Tool Invoker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('invokeCliTool', () => {
    it('should invoke a tool successfully', async () => {
      const expectedData = { id: 'test-123', data: 'test-data' }
      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: expectedData,
      })

      const result = await invokeCliTool('test_tool', { key: 'value' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(expectedData)
      expect(mockRegistry.invoke).toHaveBeenCalledWith('test_tool', { key: 'value' })
    })

    it('should handle missing payload parameter', async () => {
      const expectedData = { status: 'ok' }
      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: expectedData,
      })

      const result = await invokeCliTool('test_tool')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(expectedData)
      expect(mockRegistry.invoke).toHaveBeenCalledWith('test_tool', {})
    })

    it('should handle null payload', async () => {
      const expectedData = { status: 'ok' }
      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: expectedData,
      })

      const result = await invokeCliTool('test_tool', null as any)

      expect(result.success).toBe(true)
      expect(mockRegistry.invoke).toHaveBeenCalledWith('test_tool', {})
    })

    it('should return error when result.success is false', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: false,
        error: { message: 'Operation failed' },
      })

      const result = await invokeCliTool('test_tool', { key: 'value' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Operation failed')
      expect(result.data).toBeUndefined()
    })

    it('should handle error without message property', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: false,
        error: {},
      })

      const result = await invokeCliTool('test_tool', { key: 'value' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })

    it('should handle thrown error from registry', async () => {
      const testError = new Error('Registry error occurred')
      mockRegistry.invoke.mockRejectedValue(testError)

      const result = await invokeCliTool('test_tool', { key: 'value' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Registry error occurred')
      expect(logger.error).toHaveBeenCalled()
    })

    it('should handle thrown non-Error object', async () => {
      mockRegistry.invoke.mockRejectedValue('Some error string')

      const result = await invokeCliTool('test_tool')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Some error string')
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('invokeProposalAction', () => {
    it('should invoke proposal action', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: { proposal: 'data' },
      })

      const result = await invokeProposalAction('list', { gateId: 'gate-01' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ proposal: 'data' })
      expect(mockRegistry.invoke).toHaveBeenCalledWith('proposal_list', {
        gateId: 'gate-01',
      })
    })

    it('should invoke proposal action without payload', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: { proposals: [] },
      })

      const result = await invokeProposalAction('list')

      expect(result.success).toBe(true)
      expect(mockRegistry.invoke).toHaveBeenCalledWith('proposal_list', {})
    })

    it('should handle proposal action failure', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: false,
        error: { message: 'Proposal not found' },
      })

      const result = await invokeProposalAction('show', { hash: 'abc123' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Proposal not found')
    })
  })

  describe('invokeGatesAction', () => {
    it('should invoke gates action', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: { gates: [] },
      })

      const result = await invokeGatesAction('list')

      expect(result.success).toBe(true)
      expect(mockRegistry.invoke).toHaveBeenCalledWith('gates_action', {
        action: 'list',
      })
    })

    it('should invoke gates action with additional payload', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: { id: 'gate-01' },
      })

      const result = await invokeGatesAction('show', { gateId: 'gate-01' })

      expect(result.success).toBe(true)
      expect(mockRegistry.invoke).toHaveBeenCalledWith('gates_action', {
        action: 'show',
        gateId: 'gate-01',
      })
    })

    it('should handle gates action failure', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: false,
        error: { message: 'Gate not found' },
      })

      const result = await invokeGatesAction('show', { gateId: 'invalid' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Gate not found')
    })

    it('should handle gates action with empty action', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: {},
      })

      const result = await invokeGatesAction('', { param: 'value' })

      expect(mockRegistry.invoke).toHaveBeenCalledWith('gates_action', {
        action: '',
        param: 'value',
      })
    })
  })

  describe('invokeRequirementAction', () => {
    it('should invoke requirement action', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: { requirements: [] },
      })

      const result = await invokeRequirementAction('list')

      expect(result.success).toBe(true)
      expect(mockRegistry.invoke).toHaveBeenCalledWith('requirement_action', {
        action: 'list',
      })
    })

    it('should invoke requirement action with additional payload', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: { requirement: { hash: 'req123' } },
      })

      const result = await invokeRequirementAction('show', { hash: 'req123' })

      expect(result.success).toBe(true)
      expect(mockRegistry.invoke).toHaveBeenCalledWith('requirement_action', {
        action: 'show',
        hash: 'req123',
      })
    })

    it('should handle requirement action failure', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: false,
        error: { message: 'Requirement not found' },
      })

      const result = await invokeRequirementAction('show', { hash: 'invalid' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Requirement not found')
    })

    it('should invoke requirement action with multiple options', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: { requirements: [{ hash: '1' }, { hash: '2' }] },
      })

      const result = await invokeRequirementAction('list', {
        gate: 'gate-01',
        status: 'pending',
      })

      expect(result.success).toBe(true)
      expect(mockRegistry.invoke).toHaveBeenCalledWith('requirement_action', {
        action: 'list',
        gate: 'gate-01',
        status: 'pending',
      })
    })
  })

  describe('Error handling edge cases', () => {
    it('should invoke tool with complex payload', async () => {
      const complexPayload = {
        nested: {
          deep: {
            value: 'test',
          },
        },
        array: [1, 2, 3],
        boolean: true,
        null: null,
      }

      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: { result: 'processed' },
      })

      const result = await invokeCliTool('complex_tool', complexPayload)

      expect(result.success).toBe(true)
      expect(mockRegistry.invoke).toHaveBeenCalledWith('complex_tool', complexPayload)
    })

    it('should handle error with null message property', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: false,
        error: { message: null },
      })

      const result = await invokeCliTool('test_tool')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })

    it('should handle error with empty string message', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: false,
        error: { message: '' },
      })

      const result = await invokeCliTool('test_tool')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })

    it('should handle error with falsy but non-string message', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: false,
        error: { message: false },
      })

      const result = await invokeCliTool('test_tool')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })

    it('should log payload for successful invocation', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: true,
        data: { result: 'ok' },
      })

      const result = await invokeCliTool('test_tool', { test: 'value' })

      expect(result.success).toBe(true)
      expect(mockRegistry.invoke).toHaveBeenCalledWith('test_tool', { test: 'value' })
    })

    it('should handle error object with getters', async () => {
      mockRegistry.invoke.mockResolvedValue({
        success: false,
        error: {
          message: 'Custom error message',
          code: 'INTERNAL_ERROR',
        },
      })

      const result = await invokeCliTool('test_tool')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Custom error message')
    })
  })
})
