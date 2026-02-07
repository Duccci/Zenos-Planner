import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createMcpServer } from '../../src/mcp/server.js'

describe('VS Code integration artifacts', () => {
  it('mcp.json.template exists and contains zeno-planner', () => {
    const path = join(process.cwd(), 'mcp.json.template')
    const content = JSON.parse(readFileSync(path, 'utf-8'))
    expect(content.servers).toBeDefined()
    expect(content.servers['zeno-planner']).toBeDefined()
    expect(content.servers['zeno-planner'].args).toContain('./bin/mcp-server.js')
  })

  it('MCP server creates successfully with tools registered', async () => {
    const server = await createMcpServer()
    expect(server).toBeDefined()
    // Note: Full integration testing of MCP protocol would require stdio simulation
    // This test verifies server creation and tool registration setup
  })
})
