/**
 * State Synchronization
 *
 * Keeps state.json in sync with project-overview.json changes during gate workflows.
 * state.json serves as:
 * - Backup of project state
 * - Historical snapshot for traceability
 * - Single point of reference for external tools
 *
 * Sync triggers:
 * - Gate start: updateCurrentGateInState
 * - Gate complete: archiveCompletedGateInState
 * - Project level: syncProjectMetadataToState
 */

import { join } from 'node:path'
import { getZenoDir } from './config.js'
import { readJsonFile, writeJsonFile, fileExists } from './file.js'
import { logger } from './logger.js'
import type { ProjectOverview } from './config.js'

/**
 * State.json schema (mirrors ProjectOverview structure with archival metadata)
 */
export interface StateFile {
  project: {
    name: string
    version: string
    endState: string
    startState: string | null
    totalGatesPlanned: number
    gitHistory: {
      repository: string
      remote: string
      branch: string
    }
  }
  currentGate: string | null
  gates: {
    id: string
    sequence: number
    name: string
    hash: string
    status: 'pending' | 'validated' | 'in_progress' | 'completed' | 'rejected'
    type: string
    createdAt: string
    completedAt: string | null
    summary?: string
    objectives?: string[]
    deliverables?: string[]
    qualityMetrics?: {
      coverage: number
      securityVulnerabilities: number
      lintErrorRate: number
    }
    filesCreated?: string[]
    filesModified?: string[]
    requirements?: {
      fulfilled: number
      hashes: string[]
    }
    dependencies?: {
      blockedBy: string[]
      blocks: string[]
    }
    proposalsArchived?: string[]
  }[]
  upcomingGates: {
    /** Normalized gate ID, e.g. "gate-09". Present once gate_plan has been called. */
    id?: string
    sequence: number
    name: string
    estimatedComplexity?: string
    /**
     * Short project statement (1–3 sentences) defining the main goal of the gate.
     * Stored here so the intent survives DB regeneration (registry.db is gitignored).
     * Set by gate_plan; read back by registry rebuild to seed the DB.
     */
    goal?: string
    /** Content-addressable hash reference for the gate. */
    hash?: string
    /**
     * True once gate_create has written the PRD markdown file.
     * Allows differentiating "planned but not yet documented" from "fully specified".
     */
    prdGenerated?: boolean
  }[]
  architecture: {
    layers: string[]
    keyDependencies: Record<string, string>
  }
  lastUpdated: string
  status: 'gate_in_progress' | 'gate_completed' | 'awaiting_review'
}

/**
 * Read state.json from zeno/.zeno/state.json
 */
export async function readState(projectRoot: string = process.cwd()): Promise<StateFile | null> {
  try {
    const statePath = join(getZenoDir(projectRoot), 'state.json')
    if (!fileExists(statePath)) {
      return null
    }
    return (await readJsonFile(statePath))
  } catch (error) {
    logger.warn(
      `Failed to read state.json: ${error instanceof Error ? error.message : String(error)}`
    )
    return null
  }
}

/**
 * Write state.json to zeno/.zeno/state.json
 */
export async function writeState(
  state: StateFile,
  projectRoot: string = process.cwd()
): Promise<void> {
  try {
    const statePath = join(getZenoDir(projectRoot), 'state.json')
    await writeJsonFile(statePath, state)
  } catch (error) {
    logger.warn(
      `Failed to write state.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Sync project metadata from project-overview.json to state.json
 * Called whenever project-level metadata changes
 */
export async function syncProjectMetadataToState(
  overview: ProjectOverview,
  projectRoot: string = process.cwd()
): Promise<void> {
  try {
    let state = await readState(projectRoot)
    if (!state) {
      // Initialize new state from overview
      state = {
        project: {
          name: overview.projectName,
          version: overview.projectVersion,
          endState: overview.endState,
          startState: overview.startState,
          totalGatesPlanned: overview.totalGatesPlanned,
          gitHistory: {
            repository: 'https://github.com/owner/Zenos-Planner',
            remote: 'origin',
            branch: 'main',
          },
        },
        currentGate: overview.currentGate ?? null,
        gates: [],
        upcomingGates: overview.upcomingGates,
        architecture: overview.architecture,
        lastUpdated: new Date().toISOString(),
        // Keep gate_completed if that was the triggering reason; otherwise awaiting_review
        status: overview.currentGate ? 'gate_in_progress' : 'gate_completed',
      }
    } else {
      // Update existing state
      state.project.name = overview.projectName
      state.project.version = overview.projectVersion
      state.project.endState = overview.endState
      state.project.startState = overview.startState
      state.project.totalGatesPlanned = overview.totalGatesPlanned
      state.currentGate = overview.currentGate ?? null
      state.upcomingGates = overview.upcomingGates
      state.architecture = overview.architecture
      state.lastUpdated = new Date().toISOString()
      // Preserve gate_completed (set by archiveCompletedGateInState) so a full sync
      // called right after gate completion doesn't revert it to awaiting_review.
      state.status = overview.currentGate
        ? 'gate_in_progress'
        : state.status === 'gate_completed'
          ? 'gate_completed'
          : 'awaiting_review'
    }

    // Upsert completed gates from project-overview into state.gates.
    // This fills retroactive gaps (gates completed before state-sync existed)
    // and corrects stale sequence/hash values from previous name-lookup failures.
    for (const g of overview.completedGates) {
      const gateId = `gate-${g.sequence.toString().padStart(2, '0')}`
      const existingIdx = state.gates.findIndex((sg) => sg.id === gateId || sg.name === g.name)
      const existingGate = existingIdx >= 0 ? state.gates[existingIdx] : undefined
      const entry: StateFile['gates'][0] = {
        id: gateId,
        sequence: g.sequence,
        name: g.name,
        hash: g.hash,
        status: 'completed',
        type: 'feature',
        createdAt: existingGate !== undefined
          ? existingGate.createdAt
          : g.completedAt,
        completedAt: g.completedAt,
      }
      if (existingIdx >= 0) {
        state.gates[existingIdx] = { ...state.gates[existingIdx], ...entry }
      } else {
        state.gates.push(entry)
      }
    }
    // Keep gates sorted by sequence for deterministic output
    state.gates.sort((a, b) => a.sequence - b.sequence)

    await writeState(state, projectRoot)
  } catch (error) {
    logger.warn(
      `Failed to sync project metadata to state.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Update current gate in state.json when a gate is started
 */
export async function updateCurrentGateInState(
  gateId: string,
  gateName: string,
  _sequence: number,
  _hash: string,
  projectRoot: string = process.cwd()
): Promise<void> {
  try {
    const state = await readState(projectRoot)
    if (!state) {
      logger.warn('State.json not initialized, skipping gate start update')
      return
    }

    state.currentGate = gateId
    state.status = 'gate_in_progress'
    state.lastUpdated = new Date().toISOString()

    // Move gate from upcomingGates to indicate it's now in progress
    state.upcomingGates = state.upcomingGates.filter((g) => g.name !== gateName)

    await writeState(state, projectRoot)
    logger.debug(`Updated state.json for gate start: ${gateId}`)
  } catch (error) {
    logger.warn(
      `Failed to update current gate in state.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Archive completed gate in state.json
 * Called when a gate is marked as completed
 */
export async function archiveCompletedGateInState(
  gateId: string,
  gateName: string,
  sequence: number,
  hash: string,
  projectRoot: string = process.cwd()
): Promise<void> {
  try {
    const state = await readState(projectRoot)
    if (!state) {
      logger.warn('State.json not initialized, skipping gate completion update')
      return
    }

    // Find if gate already exists in state
    const existingGateIndex = state.gates.findIndex((g) => g.id === gateId)

    const gate = {
      id: gateId,
      sequence,
      name: gateName,
      hash,
      status: 'completed' as const,
      type: 'feature',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }

    if (existingGateIndex >= 0) {
      // Update existing gate
      state.gates[existingGateIndex] = {
        ...state.gates[existingGateIndex],
        status: 'completed',
        completedAt: new Date().toISOString(),
      } as typeof state.gates[0]
    } else {
      // Add new gate
      state.gates.push(gate)
    }

    // Clear current gate and update status
    state.currentGate = null
    state.status = 'gate_completed'
    state.lastUpdated = new Date().toISOString()

    await writeState(state, projectRoot)
    logger.debug(`Archived completed gate in state.json: ${gateId}`)
  } catch (error) {
    logger.warn(
      `Failed to archive completed gate in state.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Upsert a planned gate entry in state.json upcomingGates.
 *
 * Called by gate_plan before any PRD markdown file exists.  Stores the gate's
 * name and goal so the intent survives DB re-generation (registry.db is not
 * git-tracked).  If an entry for the gate already exists it is updated in-place.
 */
export async function upsertPlannedGateInState(
  gateId: string,
  name: string,
  goal: string,
  sequence: number,
  hash: string,
  projectRoot: string = process.cwd()
): Promise<void> {
  try {
    const state = await readState(projectRoot)
    if (!state) {
      logger.warn('state.json not found, skipping planned gate upsert')
      return
    }

    const existingIdx = state.upcomingGates.findIndex(
      (g) => g.id === gateId || g.sequence === sequence
    )

    const entry = {
      id: gateId,
      sequence,
      name,
      goal,
      hash,
      prdGenerated: false,
      estimatedComplexity: existingIdx >= 0
        ? (state.upcomingGates[existingIdx]?.estimatedComplexity ?? 'high')
        : 'high',
    }

    if (existingIdx >= 0) {
      state.upcomingGates[existingIdx] = { ...state.upcomingGates[existingIdx], ...entry }
    } else {
      state.upcomingGates.push(entry)
    }

    state.upcomingGates.sort((a, b) => a.sequence - b.sequence)
    state.lastUpdated = new Date().toISOString()

    await writeState(state, projectRoot)
    logger.debug(`Upserted planned gate in state.json: ${gateId}`)
  } catch (error) {
    logger.warn(
      `Failed to upsert planned gate in state.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Sync upcoming gates to state.json from a multi-gate replan result.
 *
 * Replaces upcomingGates with the suggested gate list (excluding already-completed
 * sequences) and updates totalGatesPlanned.  Preserves existing hash/metadata for
 * gates that already have an entry so we don't lose data on repeated replans.
 *
 * Called after `replanGates` (multi-gate mode) is applied.
 */
export async function syncUpcomingGatesToState(
  suggestedGates: { id: string; sequence?: number; name: string; description?: string }[],
  projectRoot: string = process.cwd()
): Promise<void> {
  try {
    const state = await readState(projectRoot)
    if (!state) {
      logger.warn('state.json not found, skipping upcoming gates sync')
      return
    }

    const completedSequences = new Set(state.gates.map((g) => g.sequence))

    state.upcomingGates = suggestedGates
      .map((g) => ({
        ...g,
        sequence: g.sequence ?? (parseInt(/\d+/.exec(g.id)?.[0] ?? '0', 10)),
      }))
      .filter((g) => !completedSequences.has(g.sequence))
      .map((g) => {
        const existing = state.upcomingGates.find(
          (e) => e.id === g.id || e.sequence === g.sequence
        )
        return {
          id: g.id,
          sequence: g.sequence,
          name: g.name,
          goal: existing?.goal ?? g.description ?? '',
          hash: existing?.hash ?? g.id.replace('gate-', 'g'),
          prdGenerated: existing?.prdGenerated ?? false,
          estimatedComplexity: existing?.estimatedComplexity ?? 'high',
        }
      })

    state.project.totalGatesPlanned = state.gates.length + state.upcomingGates.length
    state.lastUpdated = new Date().toISOString()

    await writeState(state, projectRoot)
    logger.debug(`Synced ${String(state.upcomingGates.length)} upcoming gates to state.json`)
  } catch (error) {
    logger.warn(
      `Failed to sync upcoming gates to state.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Mark a planned gate's PRD as generated in state.json.
 *
 * Called by gate_create after the PRD markdown file has been written.
 * Sets prdGenerated: true on the matching upcomingGates entry.
 */
export async function markPrdGeneratedInState(
  gateId: string,
  projectRoot: string = process.cwd()
): Promise<void> {
  try {
    const state = await readState(projectRoot)
    if (!state) return

    const entry = state.upcomingGates.find((g) => g.id === gateId)
    if (entry) {
      entry.prdGenerated = true
      state.lastUpdated = new Date().toISOString()
      await writeState(state, projectRoot)
      logger.debug(`Marked prdGenerated=true for ${gateId} in state.json`)
    }
  } catch (error) {
    logger.warn(
      `Failed to mark prdGenerated in state.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
