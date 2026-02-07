import { describe, it, expect } from 'vitest'
import trackGitOperations from '../../../src/mcp/audit/git-operation-tracker.js'

describe('git-operation-tracker', () => {
  it('detects common git subcommands', () => {
    const res = trackGitOperations('git', ['add', '.'], true)
    expect(res.hasGitOps).toBe(true)
    expect(res.operations.some(op => /git\s*add/.test(op))).toBe(true)
  })

  it('throws when git operations are not allowed', () => {
    expect(() => trackGitOperations('git', ['commit', '-m', 'msg'], false)).toThrow(/GIT_VIOLATION/)
  })

  it('ignores non-git commands', () => {
    const res = trackGitOperations('npm', ['run', 'build'], true)
    expect(res.hasGitOps).toBe(false)
  })
})
