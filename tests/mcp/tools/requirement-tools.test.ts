import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { unlinkSync } from 'node:fs'

describe('MCP Requirement tools (integration)', () => {
  let tempDb: Database.Database
  let tempDbPath: string

  beforeEach(() => {
    // Create temporary database for testing
    tempDbPath = join(tmpdir(), `test-req-tools-${randomUUID()}.db`)
    tempDb = new Database(tempDbPath)

    // Initialize schema
    tempDb.exec(`
      CREATE TABLE requirements (
        id TEXT PRIMARY KEY,
        project_id TEXT DEFAULT 'default-project',
        gate_id TEXT,
        parent_id TEXT,
        type TEXT NOT NULL CHECK (type IN ('functional', 'non_functional', 'constraint')),
        priority TEXT NOT NULL CHECK (priority IN ('must', 'should', 'could', 'wont')),
        description TEXT NOT NULL,
        acceptance_criteria TEXT,
        hash TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        level TEXT NOT NULL DEFAULT 'gate',
        source_gate_id TEXT,
        FOREIGN KEY (parent_id) REFERENCES requirements(id),
        FOREIGN KEY (gate_id) REFERENCES gates(id)
      )
    `)

    tempDb.exec(`
      CREATE TABLE requirement_gate_links (
        requirement_id TEXT NOT NULL,
        gate_id TEXT NOT NULL,
        linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (requirement_id, gate_id)
      )
    `)

    tempDb.exec(`
      CREATE TABLE IF NOT EXISTS gates (
        id TEXT PRIMARY KEY,
        name TEXT,
        sequence INTEGER,
        status TEXT
      )
    `)
  })

  afterEach(() => {
    if (tempDb) {
      tempDb.close()
    }
    try {
      unlinkSync(tempDbPath)
    } catch {
      // Ignore cleanup errors
    }
  })

  it('req_list returns structured result', async () => {
    // Mock getDatabase to return our test database
    vi.doMock('../../../src/storage/database.js', () => ({
      getDatabase: () => tempDb,
      getDatabasePath: () => tempDbPath,
    }))

    try {
      const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
      const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
      const registry = createFunctionRegistry()
      const handler = createToolHandler(registry, 'req_action')
      const result = await handler({ action: 'list', payload: {} })
      expect(result).toBeDefined()
      expect(result.isError).toBeUndefined()
      expect(result.structuredContent).toBeDefined()
    } finally {
      vi.doUnmock('../../../src/storage/database.js')
    }
  })

  it('req_show missing param returns validation error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'req_action')
    const result = await handler({ action: 'show', payload: {} })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('invalid')
  })


})