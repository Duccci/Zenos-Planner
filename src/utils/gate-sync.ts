/**
 * Gate Sync — no-op module
 *
 * project.json is the single source of truth for gate definitions.
 * The DB is a read-only cache for fast MCP lookups and must never write back
 * to project.json.  All gate-state mutations go through the state-sync
 * utilities in state-sync.ts.
 */

import { logger } from '../utils/logger.js'

/**
 * No-op — project.json is the single source of truth for gate definitions.
 * The DB is a read-only cache for fast MCP lookups and must never write back
 * to project.json.  All gate-state mutations go through the state-sync
 * utilities in state-sync.ts (updateCurrentGateInState, archiveCompletedGateInState,
 * upsertPlannedGateInState, etc.).
 *
 * This function is kept (rather than deleted) so that existing call sites
 * compile without change while the backwards DB→file sync is permanently
 * disabled.
 */
export function syncGatesToProjectOverview(
  _projectRoot: string = process.cwd()
): Promise<void> {
  logger.debug('syncGatesToProjectOverview: no-op — project.json is SSOT, DB does not write back')
  return Promise.resolve()
}
