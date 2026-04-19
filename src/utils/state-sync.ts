/**
 * Project State Operations
 *
 * Direct mutation helpers for project.json (the single source of truth).
 * These replace the old two-file sync (now consolidated into project.json).
 *
 * Each function reads project.json, applies a targeted mutation, and writes back.
 * All functions are best-effort (warn on failure, never throw) to preserve
 * the same non-fatal behaviour callers expect.
 */

import { join } from 'node:path'
import { getZenoDir, readProject, saveProject } from './config.js'
import { fileExists } from './file.js'
import { logger } from './logger.js'
import type { Project, ProjectGate } from './config.js'

// Re-export type so any downstream code importing StateFile can migrate at its own pace.
export type StateFile = Project

// ─────────────────────────────────────────────────────────────────────────────
// Low-level helpers (backwards-compat re-exports)
// ─────────────────────────────────────────────────────────────────────────────

export { readProject as readState, saveProject as writeState }

function projectFileExists(projectRoot: string): boolean {
  return fileExists(join(getZenoDir(projectRoot), 'project.json'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate status mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a gate as in-progress in project.json.
 */
export async function updateCurrentGateInState(
  gateId: string,
  _gateName: string,
  _sequence: number,
  _hash: string,
  projectRoot: string = process.cwd()
): Promise<void> {
  try {
    if (!projectFileExists(projectRoot)) {
      logger.warn('project.json not initialized, skipping gate start update')
      return
    }
    const project = await readProject(projectRoot)
    const gate = project.gates.find((g) => g.id === gateId)
    if (gate) gate.status = 'in_progress'
    project.status = 'gate_in_progress'
    project.lastUpdated = new Date().toISOString().slice(0, 10)
    await saveProject(project, projectRoot)
    logger.debug(`Updated project.json for gate start: ${gateId}`)
  } catch (error) {
    logger.warn(
      `Failed to update current gate in project.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Mark a gate as completed in project.json.
 */
export async function archiveCompletedGateInState(
  gateId: string,
  gateName: string,
  sequence: number,
  hash: string,
  projectRoot: string = process.cwd()
): Promise<void> {
  try {
    if (!projectFileExists(projectRoot)) {
      logger.warn('project.json not initialized, skipping gate completion update')
      return
    }
    const project = await readProject(projectRoot)
    const existingIdx = project.gates.findIndex((g) => g.id === gateId)
    const now = new Date().toISOString()

    if (existingIdx >= 0) {
      project.gates[existingIdx] = {
        ...project.gates[existingIdx],
        status: 'completed',
        completedAt: now,
      } as ProjectGate
    } else {
      project.gates.push({
        id: gateId,
        sequence,
        name: gateName,
        hash,
        status: 'completed',
        createdAt: now,
        completedAt: now,
      })
    }

    project.status = 'gate_completed'
    project.lastUpdated = now.slice(0, 10)
    await saveProject(project, projectRoot)
    logger.debug(`Archived completed gate in project.json: ${gateId}`)
  } catch (error) {
    logger.warn(
      `Failed to archive completed gate in project.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Upsert a planned gate entry (no PRD yet) into project.json.
 *
 * Called by gate_plan.  Stores the gate's name and goal so the intent survives
 * DB re-generation (registry.db is not git-tracked).
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
    if (!projectFileExists(projectRoot)) {
      logger.warn('project.json not found, skipping planned gate upsert')
      return
    }
    const project = await readProject(projectRoot)
    const existingIdx = project.gates.findIndex(
      (g) => g.id === gateId || g.sequence === sequence
    )
    const now = new Date().toISOString()

    if (existingIdx >= 0) {
      project.gates[existingIdx] = {
        ...project.gates[existingIdx],
        id: gateId,
        sequence,
        name,
        goal,
        hash,
      } as ProjectGate
    } else {
      project.gates.push({
        id: gateId,
        sequence,
        name,
        hash,
        goal,
        status: 'pending',
        createdAt: now,
        completedAt: null,
        prdGenerated: false,
        estimatedComplexity: 'high',
      })
    }

    project.gates.sort((a, b) => a.sequence - b.sequence)
    project.lastUpdated = now.slice(0, 10)
    await saveProject(project, projectRoot)
    logger.debug(`Upserted planned gate in project.json: ${gateId}`)
  } catch (error) {
    logger.warn(
      `Failed to upsert planned gate in project.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Sync upcoming gates to project.json from a multi-gate replan result.
 *
 * Completed and in-progress gates are preserved.  New pending gate entries are
 * added; existing pending entries are updated in-place.
 */
export async function syncUpcomingGatesToState(
  suggestedGates: { id: string; sequence?: number; name: string; description?: string }[],
  projectRoot: string = process.cwd()
): Promise<void> {
  try {
    if (!projectFileExists(projectRoot)) {
      logger.warn('project.json not found, skipping upcoming gates sync')
      return
    }
    const project = await readProject(projectRoot)

    const stableIds = new Set(
      project.gates
        .filter((g) => g.status === 'completed' || g.status === 'in_progress' || g.status === 'validated')
        .map((g) => g.id)
    )
    const suggestedIds = new Set(suggestedGates.map((g) => g.id))

    // Drop pending/validated gates not in the new suggestion list
    project.gates = project.gates.filter((g) => stableIds.has(g.id) || suggestedIds.has(g.id))

    const now = new Date().toISOString()
    for (const sg of suggestedGates) {
      if (stableIds.has(sg.id)) continue
      const seq = sg.sequence ?? parseInt(/\d+/.exec(sg.id)?.[0] ?? '0', 10)
      const existingIdx = project.gates.findIndex((g) => g.id === sg.id || g.sequence === seq)

      if (existingIdx >= 0) {
        project.gates[existingIdx] = {
          ...project.gates[existingIdx],
          id: sg.id,
          sequence: seq,
          name: sg.name,
          goal: project.gates[existingIdx]?.goal ?? sg.description ?? '',
        } as ProjectGate
      } else {
        project.gates.push({
          id: sg.id,
          sequence: seq,
          name: sg.name,
          hash: sg.id.replace('gate-', 'g'),
          goal: sg.description ?? '',
          status: 'pending',
          createdAt: now,
          completedAt: null,
          prdGenerated: false,
          estimatedComplexity: 'high',
        })
      }
    }

    project.gates.sort((a, b) => a.sequence - b.sequence)
    project.project.totalGatesPlanned = project.gates.length
    project.lastUpdated = now.slice(0, 10)
    await saveProject(project, projectRoot)
    logger.debug(`Synced ${String(suggestedGates.length)} upcoming gates to project.json`)
  } catch (error) {
    logger.warn(
      `Failed to sync upcoming gates to project.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Set prdGenerated: true on a gate in project.json after its PRD markdown file is written.
 */
export async function markPrdGeneratedInState(
  gateId: string,
  projectRoot: string = process.cwd()
): Promise<void> {
  try {
    if (!projectFileExists(projectRoot)) return
    const project = await readProject(projectRoot)
    const gate = project.gates.find((g) => g.id === gateId)
    if (gate) {
      gate.prdGenerated = true
      project.lastUpdated = new Date().toISOString().slice(0, 10)
      await saveProject(project, projectRoot)
      logger.debug(`Marked prdGenerated=true for ${gateId} in project.json`)
    }
  } catch (error) {
    logger.warn(
      `Failed to mark prdGenerated in project.json: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * @deprecated project.json IS the single source of truth \u2014 no separate sync is needed.
 * Kept as a no-op for call-site compatibility.
 */
export async function syncProjectMetadataToState(
  _project: Project,
  _projectRoot: string = process.cwd()
): Promise<void> {
  // no-op
}
