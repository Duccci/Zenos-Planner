import { describe, it, expect } from 'vitest'
import { ToolRegistry, getToolActions, getToolSchema } from '../../../src/mcp/schemas/index.js'

describe('MCP ToolRegistry', () => {
  it('exports a ToolRegistry with expected entries', () => {
    expect(ToolRegistry).toBeDefined()
    expect(Object.keys(ToolRegistry).length).toBeGreaterThan(0)
    expect(ToolRegistry).toHaveProperty('gates')
    expect(ToolRegistry).toHaveProperty('requirements')
  })

  it('getToolActions returns allowed actions for an entity', () => {
    const actions = getToolActions('requirements')
    expect(Array.isArray(actions)).toBe(true)
    expect(actions).toContain('list')
    expect(actions).toContain('transfer')
  })

  it('getToolSchema returns schema metadata object', () => {
    const schema = getToolSchema('gates')
    expect(schema).toBeDefined()
    expect(schema.toolName).toBe('gates_action')
    expect(schema.actions).toContain('start')
  })
})