import { describe, it, expect } from 'vitest'
import { getAdapterCommand } from '../../src/mcp/editor-adapters.js'
import { join } from 'node:path'

describe('Cross-editor integration', () => {
  it('provides correct adapter commands for each editor', () => {
    const base = `node ${join(process.cwd(), 'bin', 'mcp-server.js')}`
    expect(getAdapterCommand('vscode')).toBe(base)
    expect(getAdapterCommand('cursor')).toBe(`${base} --adapter cursor`)
    expect(getAdapterCommand('windsurf')).toBe(`${base} --adapter windsurf`)
  })

  it('handles unknown editors gracefully', () => {
    const base = `node ${join(process.cwd(), 'bin', 'mcp-server.js')}`
    expect(getAdapterCommand('unknown' as any)).toBe(`${base} --adapter unknown`)
  })
})