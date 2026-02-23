/**
 * Test Suite: MCP Documentation Coverage Verification
 *
 * Verifies that the documentation coverage script correctly identifies
 * missing tool and action documentation.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('verify-mcp-docs-coverage', () => {
  const registryPath = path.join(process.cwd(), 'src/mcp/schemas/registry.ts')
  const docPath = path.join(process.cwd(), 'docs/MCP-TOOLS.md')

  it('should find the MCP documentation file', () => {
    expect(fs.existsSync(docPath)).toBe(true)
  })

  it('should find the ToolRegistry file', () => {
    expect(fs.existsSync(registryPath)).toBe(true)
  })

  it('should have documentation for gates_action tool', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('## gates_action')
  })

  it('should have documentation for proposal_action tool', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('## proposal_action')
  })

  it('should have documentation for req_action tool', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('## req_action')
  })

  it('should have documentation for archive_action tool', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('## archive_action')
  })

  it('should have documentation for config_get tool', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    expect(docContent).toContain('## config_get')
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

  it('should have action sections for req_action', () => {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    const actions = ['list', 'show', 'deps']
    for (const action of actions) {
      expect(docContent).toContain(`#### req_action: ${action}`)
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
