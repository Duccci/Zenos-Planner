import { describe, it, expect } from 'vitest'
import { calculateNextGateId, getCurrentTimestamp, createTagName } from '../../src/core/archive-execution.js'

describe('Archive Execution helpers', () => {
  it('calculates next gate id', () => {
    expect(calculateNextGateId('gate-01')).toBe('gate-02')
    expect(calculateNextGateId('gate-09')).toBe('gate-10')
  })

  it('generates tag names safely', () => {
    expect(createTagName('gate-01', 'Core Infrastructure')).toBe('gate-01-core-infrastructure')
  })

  it('returns ISO timestamp', () => {
    const ts = getCurrentTimestamp()
    expect(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(ts)).toBe(true)
  })
})
