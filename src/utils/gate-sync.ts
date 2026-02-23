/**
 * Gate Database Sync
 *
 * Synchronizes project-overview.json with the gates database.
 * Ensures the human-readable JSON file stays in sync with the authoritative database.
 */

import { getDatabase } from '../storage/database.js'
import { readProjectOverview, saveProjectOverview } from '../utils/config.js'
import { logger } from '../utils/logger.js'

interface GateRow {
  id: string
  name: string
  sequence: number
  status: string
  hash: string | null
  created_at: string | null
  completed_at: string | null
}

/**
 * Sync all gates from database to project-overview.json
 * Called after gate operations or when project-overview.json is stale
 */
export async function syncGatesToProjectOverview(
  projectRoot: string = process.cwd()
): Promise<void> {
  try {
    const db = getDatabase(projectRoot)
    const overview = await readProjectOverview(projectRoot)

    // Fetch all gates from database
    const dbGates = db
      .prepare('SELECT id, name, sequence, status, hash, created_at, completed_at FROM gates ORDER BY sequence')
      .all() as GateRow[]

    if (dbGates.length === 0) {
      logger.debug('No gates in database, skipping sync')
      return
    }

    // Rebuild project-overview.json based on database gates
    const completedGates = []
    let currentGateInfo = null
    let upcomingGates = []

    for (const gate of dbGates) {
      const completedAt = gate.completed_at
        ? new Date(gate.completed_at).toISOString().split('T')[0]
        : null

      if (gate.status === 'completed' && completedAt) {
        completedGates.push({
          sequence: gate.sequence,
          name: gate.name,
          hash: gate.hash ?? `#gate${gate.sequence.toString().padStart(2, '0')}`,
          completedAt,
          status: 'completed',
        })
      } else if (gate.status === 'in_progress') {
        currentGateInfo = {
          sequence: gate.sequence,
          name: gate.name,
          hash: gate.hash ?? `#gate${gate.sequence.toString().padStart(2, '0')}`,
          status: 'in_progress',
          estimatedComplexity: 'high',
        }
      } else if (gate.status === 'pending') {
        upcomingGates.push({
          sequence: gate.sequence,
          name: gate.name,
          estimatedComplexity: 'high',
        })
      }
    }

    // Update overview with synced data
    overview.completedGates = completedGates
    
    // If no in_progress gate, set first pending gate as currentGateInfo (status: pending)
    if (!currentGateInfo && upcomingGates.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const firstPending = upcomingGates[0]!
      currentGateInfo = {
        sequence: firstPending.sequence,
        name: firstPending.name,
        hash: `#gate${firstPending.sequence.toString().padStart(2, '0')}`,
        status: 'pending',
        estimatedComplexity: 'high',
      }
      // Remove from upcomingGates to avoid duplication
      upcomingGates = upcomingGates.slice(1)
    }
    
    overview.currentGateInfo = currentGateInfo ?? {
      sequence: completedGates.length + 1,
      name: 'Next Gate',
      hash: `#gate${(completedGates.length + 1).toString().padStart(2, '0')}`,
      status: 'pending',
      estimatedComplexity: 'high',
    }
    overview.upcomingGates = upcomingGates
    // Only set currentGate if a gate is actually in_progress (being worked on)
    overview.currentGate = currentGateInfo?.status === 'in_progress' ? `gate-${currentGateInfo.sequence.toString().padStart(2, '0')}` : null
    overview.totalGatesPlanned = dbGates.length

    // Save back to JSON
    await saveProjectOverview(overview, projectRoot)
    logger.debug(`Synced ${dbGates.length} gates to project-overview.json`)
  } catch (error) {
    logger.warn(
      `Failed to sync gates to project-overview.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
