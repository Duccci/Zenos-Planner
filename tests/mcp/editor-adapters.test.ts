import { describe, it, expect } from 'vitest'
import { getAdapterCommand } from '../../src/mcp/editor-adapters.js'

describe('editor adapters', () => {
  it('returns a valid activation command for each editor', () => {
    const vscode = getAdapterCommand('vscode')
    expect(vscode).toContain('mcp-server.js')

    const cursor = getAdapterCommand('cursor')
    expect(cursor).toContain('--adapter cursor')

    const windsurf = getAdapterCommand('windsurf')
    expect(windsurf).toContain('--adapter windsurf')
  })
})
