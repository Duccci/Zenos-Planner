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
import path from 'path'

export interface GateGenerateInput {
  mode: 'new' | 'rebaseline' | 'single'
  anchorGateId?: string
  templateName?: string
  requirementsPerGate?: number
}

export interface GateGenerateOutput {
  success: boolean
  mode: string
  gatesGenerated: number
  gates: {
    id: string
    name: string
    type: string
    status: string
    requirementsCount: number
    dependencies: string[]
  }[]
  requirementsAttributed: number
  diagramsUpdated: string[]
  message: string
}

/**
 * Generate or regenerate gates from project requirements
 */
export async function generateGates(input: GateGenerateInput): Promise<GateGenerateOutput> {
  try {
    const projectRoot = process.cwd()
    const {
      mode,
      anchorGateId,
      templateName = 'gate-prd-template',
      requirementsPerGate = 5,
    } = input

    // Read project PRD and requirements
    const prdPath = path.join(projectRoot, 'zeno', 'PROJECT_PRD.md')
    const prdContent = await readFile(prdPath)

    // Get existing requirements
    const requirements = await getProjectRequirements(projectRoot)

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

    // Create gate PRD files
    const createdGates = await createGatePrdFiles(gates, templateName, projectRoot)

    // Update diagrams
    const diagramsUpdated = await updateGateDiagrams(gates, projectRoot)

    return {
      success: true,
      mode,
      gatesGenerated: createdGates.length,
      gates: createdGates,
      requirementsAttributed: requirements.length,
      diagramsUpdated,
      message: `Generated ${String(createdGates.length)} gates in ${mode} mode`,
    }
  } catch (error) {
    logger.error('Failed to generate gates', { error, input })
    throw new ZenoError(
      `Gate generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'GATE_GENERATION_FAILED'
    )
  }
}

// Implementations moved to `gate-planner.ts` and `gate-writer.ts`
import {
  getProjectRequirements,
  generateNewGates,
  rebaselineGates,
  generateSingleGate,
} from './gate-planner.js'
import { createGatePrdFiles, updateGateDiagrams } from './gate-writer.js'
