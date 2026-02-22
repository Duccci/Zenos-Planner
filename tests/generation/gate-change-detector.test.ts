import { describe, it, expect, beforeEach } from 'vitest'
import { GateChangeDetector, type GateMetadata, type GateChangeEvent } from '../../src/generation/gate-change-detector.js'

// ---------------------------------------------------------------------------
// Gate Change Detector - Refined Tests
// ---------------------------------------------------------------------------
describe('GateChangeDetector', () => {
  let detector: GateChangeDetector

  beforeEach(() => {
    detector = new GateChangeDetector()
  })

  describe('detectChanges', () => {
    it('returns empty changes for identical gate lists', () => {
      const before: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const after: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const changes = detector.detectChanges(before, after)
      expect(changes).toHaveLength(0)
    })

    it('detects gate addition', () => {
      const before: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const after: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
        { id: 'gate-03', hash: 'h3', name: 'Frontend', sequence: 3, status: 'pending', type: 'feature' },
      ]
      const changes = detector.detectChanges(before, after)
      const additions = changes.filter((c) => c.type === 'gate_added')
      expect(additions).toHaveLength(1)
      expect(additions[0].gateHash).toBe('h3')
    })

    it('detects gate removal', () => {
      const before: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
        { id: 'gate-03', hash: 'h3', name: 'Frontend', sequence: 3, status: 'pending', type: 'feature' },
      ]
      const after: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const changes = detector.detectChanges(before, after)
      const removals = changes.filter((c) => c.type === 'gate_removed')
      expect(removals).toHaveLength(1)
      expect(removals[0].gateHash).toBe('h3')
    })

    it('detects gate reordering', () => {
      const before: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
        { id: 'gate-03', hash: 'h3', name: 'Frontend', sequence: 3, status: 'pending', type: 'feature' },
      ]
      const after: GateMetadata[] = [
        { id: 'gate-03', hash: 'h3', name: 'Frontend', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 2, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 3, status: 'pending', type: 'feature' },
      ]
      const changes = detector.detectChanges(before, after)
      const reordered = changes.filter((c) => c.type === 'gate_reordered')
      expect(reordered.length).toBeGreaterThan(0)
    })

    it('detects gate rescoping (type change)', () => {
      const before: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
      ]
      const after: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'rescope' },
      ]
      const changes = detector.detectChanges(before, after)
      const rescoped = changes.filter((c) => c.type === 'gate_rescoped')
      expect(rescoped).toHaveLength(1)
    })

    it('handles empty before list', () => {
      const before: GateMetadata[] = []
      const after: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
      ]
      const changes = detector.detectChanges(before, after)
      expect(changes.length).toBeGreaterThan(0)
    })

    it('handles empty after list', () => {
      const before: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
      ]
      const after: GateMetadata[] = []
      const changes = detector.detectChanges(before, after)
      expect(changes.length).toBeGreaterThan(0)
    })

    it('handles multiple changes', () => {
      const before: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const after: GateMetadata[] = [
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-03', hash: 'h3', name: 'Frontend', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const changes = detector.detectChanges(before, after)
      expect(changes.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('shouldTriggerArchReview', () => {
    it('returns false for empty changes', () => {
      const changes: GateChangeEvent[] = []
      const shouldReview = detector.shouldTriggerArchReview(changes)
      expect(shouldReview).toBe(false)
    })

    it('returns true for gate additions', () => {
      const before: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
      ]
      const after: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const changes = detector.detectChanges(before, after)
      const shouldReview = detector.shouldTriggerArchReview(changes)
      expect(shouldReview).toBe(true)
    })

    it('returns true for gate removals', () => {
      const before: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const after: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
      ]
      const changes = detector.detectChanges(before, after)
      const shouldReview = detector.shouldTriggerArchReview(changes)
      expect(shouldReview).toBe(true)
    })

    it('returns true for gate reordering', () => {
      const before: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const after: GateMetadata[] = [
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const changes = detector.detectChanges(before, after)
      const shouldReview = detector.shouldTriggerArchReview(changes)
      expect(shouldReview).toBe(true)
    })

    it('returns false for no structural changes', () => {
      const before: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const after: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const changes = detector.detectChanges(before, after)
      const shouldReview = detector.shouldTriggerArchReview(changes)
      expect(shouldReview).toBe(false)
    })

    it('all change types trigger review', () => {
      const events: GateChangeEvent[] = [
        {
          type: 'gate_added',
          gateHash: 'h1',
          gateName: 'New Gate',
          details: 'Test',
        },
      ]
      const shouldReview = detector.shouldTriggerArchReview(events)
      expect(shouldReview).toBe(true)
    })
  })

  describe('change event details', () => {
    it('provides descriptive details for each change', () => {
      const before: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
      ]
      const after: GateMetadata[] = [
        { id: 'gate-01', hash: 'h1', name: 'Foundation', sequence: 1, status: 'pending', type: 'feature' },
        { id: 'gate-02', hash: 'h2', name: 'Core API', sequence: 2, status: 'pending', type: 'feature' },
      ]
      const changes = detector.detectChanges(before, after)
      expect(changes[0].details).toBeTruthy()
      expect(changes[0].details.length).toBeGreaterThan(0)
    })

    it('includes gate name and id in details', () => {
      const before: GateMetadata[] = []
      const after: GateMetadata[] = [
        { id: 'gate-05', hash: 'h5', name: 'TestGate', sequence: 1, status: 'pending', type: 'feature' },
      ]
      const changes = detector.detectChanges(before, after)
      expect(changes[0].gateName).toBe('TestGate')
      expect(changes[0].details).toContain('TestGate')
      expect(changes[0].details).toContain('gate-05')
    })
  })
})
