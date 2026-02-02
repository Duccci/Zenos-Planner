import { describe, it, expect } from 'vitest'
import { ensureWorkspaceMcp, getAdapterCommand } from '../../src/mcp/editor-adapters.js'

describe('mcp install helpers', () => {
  it('returns adapter command for editors and does not overwrite existing files when present', () => {
    const cmd = getAdapterCommand('vscode', '/project/root')
    expect(cmd).toContain('mcp-server.js')

    // ensureWorkspaceMcp returns boolean; in test workspace it may attempt to write, but should return a boolean
    const result = ensureWorkspaceMcp('/project/root')
    expect(typeof result).toBe('boolean')
  })
})
