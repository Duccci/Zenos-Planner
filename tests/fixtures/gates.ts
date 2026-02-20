import type { GateSummary } from '../../src/utils/config.js'

/**
 * Factory for `GateSummary` objects returned by `getGatesFromOverview()`.
 * Eliminates the repeated `completedAt: null as any` cast and inline literals.
 */
export function makeGateSummary(overrides: Partial<GateSummary> = {}): GateSummary {
  return {
    id: 'gate-01',
    name: 'Test Gate',
    hash: 'abc12345',
    status: 'pending',
    sequence: 1,
    completedAt: null,
    ...overrides,
  }
}

/**
 * Shape returned by `db.prepare('SELECT … FROM gates …').get()` in test mocks.
 * Represents the minimal DB row that production code reads from the gates table.
 */
export interface GateDbRow {
  id: string
  name: string
  status: string
  description?: string | null
  sequence?: number
  hash?: string
  completedAt?: string | null
}

export function makeGateDbRow(overrides: Partial<GateDbRow> = {}): GateDbRow {
  return {
    id: 'gate-01',
    name: 'Setup',
    status: 'in_progress',
    ...overrides,
  }
}
