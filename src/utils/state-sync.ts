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
    status: 'pending' | 'in_progress' | 'completed' | 'rejected'
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
    sequence: number
    name: string
    estimatedComplexity?: string
    description?: string
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
        status: overview.currentGate ? 'gate_in_progress' : 'awaiting_review',
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
      state.status = overview.currentGate ? 'gate_in_progress' : 'awaiting_review'
    }

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
