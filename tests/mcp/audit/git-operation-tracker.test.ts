import { describe, it, expect, beforeEach } from 'vitest'
import trackGitOperations, { getGitAuditLog, clearGitAuditLog } from '../../../src/mcp/audit/git-operation-tracker.js'

describe('git-operation-tracker', () => {
  beforeEach(() => {
    clearGitAuditLog()
  })

  // --- Detection ---
  it('detects git add', () => {
    const res = trackGitOperations('git', ['add', '.'], true)
    expect(res.hasGitOps).toBe(true)
    expect(res.operations.some(op => /git\s*add/.test(op))).toBe(true)
  })

  it('detects git commit', () => {
    const res = trackGitOperations('git', ['commit', '-m', 'msg'], true)
    expect(res.hasGitOps).toBe(true)
    expect(res.operations).toContain('git commit')
  })

  it('detects git tag', () => {
    const res = trackGitOperations('git', ['tag', 'v1.0'], true)
    expect(res.hasGitOps).toBe(true)
    expect(res.operations).toContain('git tag')
  })

  it('detects git push', () => {
    const res = trackGitOperations('git', ['push', 'origin', 'main'], true)
    expect(res.hasGitOps).toBe(true)
    expect(res.operations).toContain('git push')
  })

  it('detects git pull', () => {
    const res = trackGitOperations('git', ['pull'], true)
    expect(res.hasGitOps).toBe(true)
    expect(res.operations).toContain('git pull')
  })

  it('detects git fetch', () => {
    const res = trackGitOperations('git', ['fetch', '--all'], true)
    expect(res.hasGitOps).toBe(true)
    expect(res.operations).toContain('git fetch')
  })

  it('detects git merge', () => {
    const res = trackGitOperations('git', ['merge', 'feature'], true)
    expect(res.hasGitOps).toBe(true)
    expect(res.operations).toContain('git merge')
  })

  // --- Non-git commands ---
  it('ignores npm commands', () => {
    const res = trackGitOperations('npm', ['run', 'build'], true)
    expect(res.hasGitOps).toBe(false)
    expect(res.operations).toHaveLength(0)
  })

  it('ignores node commands', () => {
    const res = trackGitOperations('node', ['bin/zeno.js', 'gates', 'list'], true)
    expect(res.hasGitOps).toBe(false)
  })

  it('ignores tsc commands', () => {
    const res = trackGitOperations('npx', ['tsc', '--noEmit'], true)
    expect(res.hasGitOps).toBe(false)
  })

  // --- Edge cases ---
  it('detects git in concatenated command string', () => {
    const res = trackGitOperations('git add', ['.'], true)
    expect(res.hasGitOps).toBe(true)
  })

  it('handles empty args gracefully', () => {
    const res = trackGitOperations('git', [], true)
    expect(res.hasGitOps).toBe(true)
    expect(res.operations).toContain('git')
  })

  // --- Blocking ---
  it('throws when git operations are not allowed', () => {
    expect(() => trackGitOperations('git', ['commit', '-m', 'msg'], false)).toThrow(/GIT_VIOLATION/)
  })

  it('thrown error has code property', () => {
    try {
      trackGitOperations('git', ['push', 'origin'], false)
    } catch (err: any) {
      expect(err.code).toBe('GIT_VIOLATION')
      expect(err.operations).toContain('git push')
    }
  })

  it('does not throw for non-git commands even when not allowed', () => {
    expect(() => trackGitOperations('npm', ['install'], false)).not.toThrow()
  })

  // --- Audit log ---
  it('records audit entries for detected git operations', () => {
    trackGitOperations('git', ['add', '.'], true)
    const log = getGitAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.operations).toContain('git add')
    expect(log[0]!.allowed).toBe(true)
    expect(log[0]!.timestamp).toBeTruthy()
  })

  it('records audit entry before throwing on blocked operation', () => {
    try {
      trackGitOperations('git', ['commit', '-m', 'x'], false)
    } catch {
      // expected
    }
    const log = getGitAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.allowed).toBe(false)
    expect(log[0]!.phase).toBe('normal')
  })

  it('does not record entries for non-git commands', () => {
    trackGitOperations('npm', ['test'], true)
    expect(getGitAuditLog()).toHaveLength(0)
  })

  it('clearGitAuditLog empties the log', () => {
    trackGitOperations('git', ['tag', 'v1'], true)
    expect(getGitAuditLog()).toHaveLength(1)
    clearGitAuditLog()
    expect(getGitAuditLog()).toHaveLength(0)
  })
})
