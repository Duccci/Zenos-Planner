/**
 * Test Suite: MCP Documentation Coverage Verification
 *
 * Verifies that the documentation coverage script correctly identifies
 * missing tool and action documentation.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { getMcpToolDefinitionInfo } from '../../src/mcp/tools/index.js'

describe('verify-mcp-docs-coverage', () => {
  const toolDefinitionsPath = path.join(process.cwd(), 'src/mcp/tools/index.ts')
  const docPath = path.join(process.cwd(), 'docs/MCP-TOOLS.md')

  it('should find the MCP documentation file', () => {
    expect(fs.existsSync(docPath)).toBe(true)
  })

  it('should find the MCP handler definitions file', () => {
    expect(fs.existsSync(toolDefinitionsPath)).toBe(true)
  })

  it('should derive canonical tools from handler definitions', () => {
    const tools = getMcpToolDefinitionInfo().map((tool) => tool.name)
    expect(tools).toContain('proposal_action')
    expect(tools).not.toContain('proposal_actions')
    expect(tools).not.toContain('proposal_list')
  })

  it('should have documentation for gates_action tool', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('## gates_action')
  })

  it('should have documentation for proposal_action tool', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('## proposal_action')
  })

  it('should have documentation for reg_action tool', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('## reg_action')
  })

  it('should have documentation for config_get tool', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('## config_get')
  })

  it('should include every live handler tool in the canonical surface', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    for (const tool of getMcpToolDefinitionInfo()) {
      const toolLine = docContent
        .split('\n')
        .find((line) => line.includes(`\`${tool.name}\``))
      expect(toolLine).toBeDefined()
      for (const action of tool.actions) {
        expect(toolLine).toContain(`\`${action}\``)
      }
    }
  })

  it('should have action sections for gates_action', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    const actions = ['list', 'show', 'start', 'complete']
    for (const action of actions) {
      expect(docContent).toContain(`#### gates_action: ${action}`)
    }
  })

  it('should have action sections for proposal_action', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    const actions = ['list', 'show', 'start', 'validate', 'approve', 'reject']
    for (const action of actions) {
      expect(docContent).toContain(`#### proposal_action: ${action}`)
    }
  })

  it('should have action sections for reg_action', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    const actions = ['list', 'show', 'deps']
    for (const action of actions) {
      expect(docContent).toContain(`#### reg_action: ${action}`)
    }
  })

  it('should document input schemas', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('Input Schema:')
  })

  it('should document validators executed', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('Validators Executed')
  })

  it('should document preconditions', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('Preconditions:')
  })

  it('should document output schemas', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('Output Schema:')
  })

  it('should document error codes', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('Error Codes:')
  })

  it('should include example requests and responses', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('Example Request:')
    expect(docContent).toContain('Example Response:')
  })

  it('should include error code taxonomy table', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('Error Code Taxonomy')
    expect(docContent).toContain('| Code | HTTP | Meaning |')
  })

  it('should reference mcp-workflows.md for state machines', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('zeno/architecture/mcp-workflows.md')
  })

  it('should have a completion marker showing document is authoritative', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('Authoritative Reference')
  })
})
