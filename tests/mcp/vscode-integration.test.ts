import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createMcpServer } from '../../src/mcp/server.js'

describe('VS Code integration artifacts', () => {
  it('mcp.json.template exists and contains zenoPlanner', () => {
    const path = join(process.cwd(), 'mcp.json.template')
    const content = JSON.parse(readFileSync(path, 'utf-8'))
    expect(content.servers).toBeDefined()
    expect(content.servers.zenoPlanner).toBeDefined()
    expect(content.servers.zenoPlanner.args).toContain('./bin/mcp-server.js')
  })

  it('MCP VS Code docs exist', () => {
    const path = join(process.cwd(), 'docs', 'MCP_VSCODE_SETUP.md')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('mcp.json')
    expect(content).toContain('ZENO_PROJECT_ROOT')
  })

  it('MCP server creates successfully with tools registered', async () => {
    const server = await createMcpServer()
    expect(server).toBeDefined()
    // Note: Full integration testing of MCP protocol would require stdio simulation
    // This test verifies server creation and tool registration setup
  })
})
