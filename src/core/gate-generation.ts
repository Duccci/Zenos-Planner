/**
 * Gate Generation Workflow
 *
 * Handles generation and regeneration of gates from project requirements.
 * Responsible for: creating new gates, rebaselining existing gates,
 * generating single gates, and managing gate PRD files and diagrams.
 */

import { readFile } from '../utils/file.js'
import { logger } from '../utils/logger.js'
import { ZenoError } from '../utils/errors.js'
import { readProjectOverview, getGatesFromOverview, getZenoGitDir, getWorkspaceRoot } from '../utils/config.js'
import {
  getProjectRequirements,
  generateNewGates,
  rebaselineGates,
  generateSingleGate,
} from './gate-planner.js'
import path from 'path'

export interface ArchReviewNotification {
  triggered: boolean
  reason: string
  changeEvents: {
    type: string
    gateHash: string
    gateName: string
    details: string
  }[]
}

export interface GateGenerateInput {
  mode: 'new' | 'rebaseline' | 'single'
  anchorGateId?: string
  requirementsPerGate?: number
}

export interface GateGenerateOutput {
  success: boolean
  mode: string
  gatesGenerated: number
  gates: {
    id: string
    name: string
    status: string
    requirementsCount: number
    dependencies: string[]
  }[]
  requirementsAttributed: number
  diagramsUpdated: string[]
  message: string
  archReviewNotification?: ArchReviewNotification
}

/**
 * Generate or regenerate gates from project requirements
 */
export async function generateGates(input: GateGenerateInput): Promise<GateGenerateOutput> {
  try {
    const projectRoot = getWorkspaceRoot()
    const {
      mode,
      anchorGateId,
      requirementsPerGate = 5,
    } = input

    // Read project PRD and requirements
    const prdPath = path.join(getZenoGitDir(projectRoot), 'overview', 'PROJECT_PRD.md')
    const prdContent = await readFile(prdPath)

    // Get existing requirements
    const requirements = await getProjectRequirements(projectRoot)

    // Store previous gate state for change detection
    let previousGatesFromOverview: {
      id: string
      sequence: number
      name: string
      hash: string
      status: 'completed' | 'in_progress' | 'validated' | 'pending' | 'cancelled' | 'backlog'
    }[] = []

    try {
      const projectOverview = await readProjectOverview(projectRoot)
      previousGatesFromOverview = getGatesFromOverview(projectOverview)
    } catch {
      // Project overview might not exist yet (e.g., on first generation)
      logger.info('No previous project overview found - skipping change detection')
    }

    // Determine generation strategy based on mode
    let gates: {
      id: string
      name: string
      type: string
      status: string
      requirementsCount: number
      dependencies: string[]
    }[] = []

    switch (mode) {
      case 'new':
        gates = await generateNewGates(prdContent, requirements, requirementsPerGate)
        break
      case 'rebaseline':
        gates = await rebaselineGates(prdContent, requirements, anchorGateId)
        break
      case 'single':
        gates = await generateSingleGate(prdContent, requirements, anchorGateId)
        break
    }

    const diagramsUpdated: string[] = []

    // Detect structural changes and notify if arch review needed
    const archReviewNotification = await detectGateChangesAndNotify(
      previousGatesFromOverview,
      gates
    )

    return {
      success: true,
      mode,
      gatesGenerated: gates.length,
      gates,
      requirementsAttributed: requirements.length,
      diagramsUpdated,
      message: `Generated ${String(gates.length)} gates in ${mode} mode`,
      archReviewNotification,
    }
  } catch (error) {
    logger.error('Failed to generate gates', { error, input })
    throw new ZenoError(
      `Gate generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'GATE_GENERATION_FAILED'
    )
  }
}

/**
 * Detect gate structural changes and trigger arch review notification if needed
 */
async function detectGateChangesAndNotify(
  previousGates: {
    id: string
    sequence: number
    name: string
    hash: string
    status: 'completed' | 'in_progress' | 'validated' | 'pending' | 'cancelled' | 'backlog'
  }[],
  currentGates: {
    id: string
    name: string
    status: string
    requirementsCount: number
    dependencies: string[]
  }[]
): Promise<ArchReviewNotification> {
  const { GateChangeDetector } = await import(
    '../generation/gate-change-detector.js'
  )

  const detector = new GateChangeDetector()

  // Convert gates to the format expected by the detector
  const previousGatesMetadata = previousGates.map((g) => ({
    id: g.id,
    hash: g.hash,
    name: g.name,
    sequence: g.sequence,
    status: g.status as 'pending' | 'in_progress' | 'completed' | 'rejected',
  }))

  // Build a lookup so existing gates keep their real hash. Only genuinely new
  // gates (no matching previous entry) fall back to a derived placeholder.
  const prevHashById = new Map(previousGates.map((g) => [g.id, g.hash]))

  const currentGatesMetadata = currentGates.map((g, index) => ({
    id: g.id,
    hash: prevHashById.get(g.id) ?? `hash-${g.id}`,
    name: g.name,
    sequence: index + 1,
    status: g.status as 'pending' | 'in_progress' | 'completed' | 'rejected',
  }))

  const changeEvents = detector.detectChanges(previousGatesMetadata, currentGatesMetadata)
  const shouldTrigger = detector.shouldTriggerArchReview(changeEvents)

  if (shouldTrigger) {
    logger.info('Architecture review notification: Gate structure changed', {
      eventCount: changeEvents.length,
      events: changeEvents,
    })
  }

  return {
    triggered: shouldTrigger,
    reason: shouldTrigger ? 'Gate structure changed - architecture diagrams may need updates' : '',
    changeEvents: changeEvents.map((e) => ({
      type: e.type,
      gateHash: e.gateHash,
      gateName: e.gateName,
      details: e.details,
    })),
  }
}
