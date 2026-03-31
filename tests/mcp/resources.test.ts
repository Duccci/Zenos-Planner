import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { registerResources } from '../../src/mcp/resources/index.js'

const tmpDir = join(process.cwd(), '.local', 'test-workspace-resources')

describe('MCP resources discovery and registration', () => {
  beforeEach(() => {
    // ensure clean temp workspace
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    mkdirSync(join(tmpDir, 'zeno'), { recursive: true })
    mkdirSync(join(tmpDir, '.zeno'), { recursive: true })
    // Create a PROJECT_PRD.md
    writeFileSync(join(tmpDir, 'zeno', 'PROJECT_PRD.md'), '# Project PRD\n')
    // Create proposals/solitary file
    mkdirSync(join(tmpDir, 'zeno', 'proposals', 'solitary'), { recursive: true })
    writeFileSync(join(tmpDir, 'zeno', 'proposals', 'solitary', '2026-01-01-sample.md'), '# Proposal\n')
  })

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  })

  it('discovers and registers resources', async () => {
    const registered: any[] = []
    const fakeServer = {
      registerResource: (name: string, uri: string, meta: any, reader: any) => {
        registered.push({ name, uri, meta })
      }
    } as any

    const count = await registerResources(fakeServer as any, tmpDir)
    expect(count).toBeGreaterThanOrEqual(2)
    expect(registered.length).toBe(count)

    const names = registered.map(r => r.name)
    expect(names.some(n => n.includes('prd'))).toBe(true)
    expect(names.some(n => n.includes('proposal'))).toBe(true)
    // Parameterized template should be discoverable
    expect(names.some(n => n.includes('gate/{id}/prd'))).toBe(true)
  })
})
