import { describe, it, expect } from 'vitest'
import { ArchiveActionInputSchema } from '../../../src/mcp/schemas/archive-schemas.js'

describe('archive safety contracts', () => {
  it('accepts gate archive action', () => {
    const parsed = ArchiveActionInputSchema.safeParse({
      action: 'gate',
      payload: { gateId: 'gate-01' },
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects proposal archive action', () => {
    const parsed = ArchiveActionInputSchema.safeParse({
      action: 'proposal',
      payload: { hash: 'abc12345' },
    })
    expect(parsed.success).toBe(false)
  })
})
