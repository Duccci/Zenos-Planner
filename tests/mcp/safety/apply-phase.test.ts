import { describe, it, expect, afterEach } from 'vitest'
import { executeCommand } from '../../../src/integration/command-invoker.js'

describe('apply-phase guard', () => {
  afterEach(() => {
    delete (globalThis as any).__ZENOPROPOSAL_APPLY_PHASE
  })

  it('blocks git commit when apply-phase flag is set', async () => {
    ;(globalThis as any).__ZENOPROPOSAL_APPLY_PHASE = true
    const res = await executeCommand('git commit -m "test-block"')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/GIT_VIOLATION|git operations are not allowed/i)
  })

  it('blocks git add when apply-phase flag is set', async () => {
    ;(globalThis as any).__ZENOPROPOSAL_APPLY_PHASE = true
    const res = await executeCommand('git add .')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/GIT_VIOLATION/i)
  })

  it('blocks git push when apply-phase flag is set', async () => {
    ;(globalThis as any).__ZENOPROPOSAL_APPLY_PHASE = true
    const res = await executeCommand('git push origin main')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/GIT_VIOLATION/i)
  })

  it('blocks git tag when apply-phase flag is set', async () => {
    ;(globalThis as any).__ZENOPROPOSAL_APPLY_PHASE = true
    const res = await executeCommand('git tag v1.0.0')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/GIT_VIOLATION/i)
  })

  it('includes error code in response payload', async () => {
    ;(globalThis as any).__ZENOPROPOSAL_APPLY_PHASE = true
    const res = await executeCommand('git commit -m "blocked"')
    expect(res.success).toBe(false)
    const parsed = JSON.parse(res.error ?? '{}')
    expect(parsed.code).toBe('GIT_VIOLATION')
    expect(parsed.timestamp).toBeTruthy()
  })

  it('allows non-git commands during apply phase', async () => {
    ;(globalThis as any).__ZENOPROPOSAL_APPLY_PHASE = true
    // echo should succeed even with apply-phase flag set
    const res = await executeCommand('echo hello')
    // echo might fail for other reasons (no shell) but should NOT fail with GIT_VIOLATION
    if (!res.success && res.error) {
      expect(res.error).not.toMatch(/GIT_VIOLATION/i)
    }
  })

  it('allows git commands when apply-phase flag is not set', async () => {
    // Flag is not set — the command will fail because `git commit` has nothing to commit,
    // but it should NOT fail with GIT_VIOLATION
    const res = await executeCommand('git status')
    if (!res.success && res.error) {
      expect(res.error).not.toMatch(/GIT_VIOLATION/i)
    }
  })
})
