import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const mockGetDefaultVsCodeUserMcpPath = vi.fn()

vi.mock('../../src/mcp/editor-adapters.js', () => ({
  getDefaultVsCodeUserMcpPath: (...args: unknown[]) => mockGetDefaultVsCodeUserMcpPath(...args),
}))

import { McpDiagnostics } from '../../src/mcp/diagnostics.js'
import { FunctionRegistry } from '../../src/integration/function-registry.js'

vi.mock('../../src/utils/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({}),
}))

vi.mock('../../src/storage/database.js', () => ({
  getDatabasePath: vi.fn().mockReturnValue('/tmp/test.db'),
}))

describe('MCP Diagnostics', () => {
  let diagnostics: McpDiagnostics
  let mockRegistry: FunctionRegistry
  let cwd: string
  let tmpDir: string
  let userMcpPath: string

  beforeEach(() => {
    vi.clearAllMocks()
    diagnostics = new McpDiagnostics()
    mockRegistry = {
      list: vi.fn().mockReturnValue([
        {
          name: 'test_tool',
          description: 'A test tool',
          parameters: [{ name: 'param1' }, { name: 'param2' }],
        },
      ]),
      invoke: vi.fn(),
    } as any
    cwd = process.cwd()
    tmpDir = mkdtempSync(join(tmpdir(), 'zeno-diag-test-'))
    userMcpPath = join(tmpDir, 'User', 'mcp.json')
    mockGetDefaultVsCodeUserMcpPath.mockReturnValue(userMcpPath)
    process.chdir(tmpDir)
  })

  afterEach(() => {
    process.chdir(cwd)
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reports healthy status with registered tools', async () => {
    const health = diagnostics.getHealth(5)
    expect(health.status).toBe('healthy')
    expect(health.toolsRegistered).toBe(5)
    expect(health.uptime).toBeGreaterThanOrEqual(0)
  })

  it('reports degraded status with recent errors', async () => {
    diagnostics.recordError('test_tool', 'Test error')
    const health = diagnostics.getHealth(5)
    expect(health.status).toBe('degraded')
    expect(health.lastError?.error).toBe('Test error')
  })

  it('reports unhealthy status with no tools', async () => {
    const health = diagnostics.getHealth(0)
    expect(health.status).toBe('unhealthy')
  })

  it('tracks error history with limit', () => {
    for (let i = 0; i < 15; i++) {
      diagnostics.recordError('tool', `Error ${i}`)
    }
    const errors = diagnostics.getRecentErrors()
    expect(errors.length).toBe(10) // maxErrors = 10
    expect(errors[0].error).toBe('Error 14') // most recent first
  })

  it('generates tool info from registry', () => {
    const tools = diagnostics.getToolInfo(mockRegistry)
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('test_tool')
    expect(tools[0].parameters).toEqual(['param1', 'param2'])
    expect(tools[0].hasSchema).toBe(true)
  })

  it('generates complete diagnostic report', async () => {
    const report = await diagnostics.generateReport(mockRegistry)
    expect(report.health).toBeDefined()
    expect(report.tools).toHaveLength(1)
    expect(report.config).toBeDefined()
    expect(report.recentErrors).toEqual([])
  })

  it('formats report as readable text', async () => {
    const formatted = await diagnostics.formatReport(mockRegistry)
    expect(formatted).toContain('MCP Server Diagnostics')
    expect(formatted).toContain('Status:')
    expect(formatted).toContain('test_tool')
  })

  it('detects duplicate MCP server names across workspace and user scope', async () => {
    mkdirSync(join(tmpDir, '.vscode'), { recursive: true })
    writeFileSync(
      join(tmpDir, '.vscode', 'mcp.json'),
      JSON.stringify({
        servers: {
          'zeno-planner': {
            type: 'stdio',
            command: 'node',
            args: ['./bin/mcp-server.js'],
          },
        },
      }),
      'utf-8'
    )

    mkdirSync(join(tmpDir, 'User'), { recursive: true })
    writeFileSync(
      userMcpPath,
      JSON.stringify({
        servers: {
          'zeno-planner': {
            type: 'stdio',
            command: 'zeno-mcp',
            args: [],
          },
        },
      }),
      'utf-8'
    )

    const config = await diagnostics.getConfigStatus()

    expect(config.workspaceMcpConfigExists).toBe(true)
    expect(config.userMcpConfigExists).toBe(true)
    expect(config.duplicateServerNames).toContain('zeno-planner')
    expect(config.warnings).toContain(
      'Server name configured in both workspace and user MCP config: zeno-planner'
    )
  })
})