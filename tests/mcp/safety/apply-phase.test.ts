import { describe, it, expect } from 'vitest'
import { executeCommand } from '../../../src/integration/command-invoker.js'

describe('apply-phase guard', () => {
  it('blocks git commands when apply-phase flag is set', async () => {
    ;(globalThis as any).__ZENOPROPOSAL_APPLY_PHASE = true
    const res = await executeCommand('git commit -m "test-block"')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/GIT_VIOLATION|git operations are not allowed/i)
    delete (globalThis as any).__ZENOPROPOSAL_APPLY_PHASE
  })
})
