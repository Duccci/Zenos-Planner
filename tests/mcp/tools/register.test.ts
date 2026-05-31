import { describe, it, expect, vi } from 'vitest'
import { createFunctionRegistry } from '../../../src/integration/function-implementations.js'
import { getMcpToolDefinitionInfo, registerTools } from '../../../src/mcp/tools/index.js'

describe('MCP Tools Registration', () => {
  it('registers configured handler tools on server', () => {
    const registry = createFunctionRegistry()

    const registered: string[] = []

    const fakeServer: any = {
      registerTool: vi.fn((name: string) => {
        registered.push(name)
      })
    }

    const result = registerTools(fakeServer, registry)
    const definitionNames = getMcpToolDefinitionInfo().map((tool) => tool.name)

    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual(definitionNames)
    expect(result.length).toBeGreaterThan(0)
    // Ensure at least one known handler-provided tool is registered
    expect(result).toContain('config_get')
    expect(result).toContain('git_trace')
    expect(result).toContain('diagram_action')
    expect(result).toContain('proposal_action')
    expect(result).not.toContain('template_action')
    expect(result).not.toContain('template_list')
    expect(result).not.toContain('template_get')
    expect(result).not.toContain('arch_action')
    expect(result).not.toContain('show_entity')
    // 11+ handler tools: repos_action, gates_action, reg_action,
    // proposal_action, config_get, artifact_validate,
    // diagram_action (covers templates), project_action, context_action, git_trace
    // (template_action merged under diagram_action)
    expect(result.length).toBeGreaterThanOrEqual(11)
  })
})
