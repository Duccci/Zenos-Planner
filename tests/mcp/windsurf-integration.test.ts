import { describe, it, expect } from 'vitest'
import { getAdapterCommand } from '../../src/mcp/editor-adapters.js'
import { join } from 'node:path'

describe('Windsurf integration', () => {
  it('provides correct adapter command for Windsurf', () => {
    const command = getAdapterCommand('windsurf')
    const base = `node ${join(process.cwd(), 'bin', 'mcp-server.js')}`
    expect(command).toBe(`${base} --adapter windsurf`)
  })
})