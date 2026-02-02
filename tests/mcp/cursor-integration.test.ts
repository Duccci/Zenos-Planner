import { describe, it, expect } from 'vitest'
import { getAdapterCommand } from '../../src/mcp/editor-adapters.js'
import { join } from 'node:path'

describe('Cursor integration', () => {
  it('provides correct adapter command for Cursor', () => {
    const command = getAdapterCommand('cursor')
    const base = `node ${join(process.cwd(), 'bin', 'mcp-server.js')}`
    expect(command).toBe(`${base} --adapter cursor`)
  })
})