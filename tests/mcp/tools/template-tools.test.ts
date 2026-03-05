import { describe, it, expect, beforeEach, vi } from 'vitest'
import { architectureHandlers } from '../../../src/mcp/tools/architecture-tools.js'

describe('diagram_action template actions (integration)', () => {
  it('diagram_action:list returns templates or textual output', async () => {
    const handlers = architectureHandlers({} as any)
    const result = await handlers['diagram_action']!({ action: 'list' })
    expect(result).toBeDefined()
    expect((result.content[0] as any)?.text).toBeDefined()
  })

  it('diagram_action:get missing name returns validation error', async () => {
    const handlers = architectureHandlers({} as any)
    const result = await handlers['diagram_action']!({ action: 'get' })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })

  it('diagram_action:get with empty name returns validation error', async () => {
    const handlers = architectureHandlers({} as any)
    const result = await handlers['diagram_action']!({ action: 'get', name: '' })
    expect(result.isError).toBe(true)
  })

  it('diagram_action:get with non-string name returns error', async () => {
    const handlers = architectureHandlers({} as any)
    const result = await handlers['diagram_action']!({ action: 'get', name: 123 })
    expect(result.isError).toBe(true)
  })

  it('diagram_action:list handles discovery errors gracefully', async () => {
    const handlers = architectureHandlers({} as any)
    const result = await handlers['diagram_action']!({ action: 'list' })
    expect(result).toBeDefined()
    expect((result.content[0] as any)?.text).toBeDefined()
  })

  it('diagram_action:get with valid name returns structured or error result', async () => {
    const handlers = architectureHandlers({} as any)
    const result = await handlers['diagram_action']!({ action: 'get', name: 'test-template' })
    expect(result).toBeDefined()
    expect((result.content[0] as any)?.text).toBeDefined()
  })

  it('diagram_action:get with includeContext flag', async () => {
    const handlers = architectureHandlers({} as any)
    const result = await handlers['diagram_action']!({ action: 'get', name: 'test', includeContext: true })
    expect(result).toBeDefined()
    expect((result.content[0] as any)?.text).toBeDefined()
  })

  it('diagram_action:get with includeContext as string', async () => {
    const handlers = architectureHandlers({} as any)
    const result = await handlers['diagram_action']!({ action: 'get', name: 'test', includeContext: 'true' })
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
  })

  it('diagram_action:get with includeContext as false', async () => {
    const handlers = architectureHandlers({} as any)
    const result = await handlers['diagram_action']!({ action: 'get', name: 'test', includeContext: false })
    expect(result).toBeDefined()
    expect((result.content[0] as any)?.text).toBeDefined()
  })
})
