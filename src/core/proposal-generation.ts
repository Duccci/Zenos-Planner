/**
 * Proposal Generation Workflow
 *
 * Handles generation of proposal documents from a gate PRD.
 * Responsible for: reading gate objectives, parsing requirements,
 * decomposing into proposals with tasks, and calculating dependencies.
 */

import { readFile } from '../utils/file.js'
import { logger } from '../utils/logger.js'
import { ZenoError } from '../utils/errors.js'
import path from 'path'

export interface ProposalGenerateInput {
  gateId: string
  templateName?: string
  outputDir?: string
}

export interface ProposalGenerateOutput {
  success: boolean
  gateId: string
  proposalsGenerated: number
  proposals: {
    hash: string
    filename: string
    path: string
    type: 'gate-tied' | 'solitary'
    status: string
    summary: string
  }[]
  dependencies?: {
    from: string
    to: string
    type: string
  }[]
  message: string
}

/**
 * Generate proposal documents from a gate PRD
 */
export async function generateProposals(
  input: ProposalGenerateInput
): Promise<ProposalGenerateOutput> {
  try {
    const projectRoot = process.cwd()
    const { gateId, templateName = 'proposal-template', outputDir } = input

    // Read gate PRD
    const [, gnum = '', ...rest] = gateId.split('-')
    const gateNumberStr: string = gnum
    const gateSlugStr: string = rest.join('-')
    const gatePrdPath = path.join(
      projectRoot,
      'zeno',
      'gates',
      `gate-${gateNumberStr}-${gateSlugStr}.md`
    )
    const gateContent = await readFile(gatePrdPath)

    // Parse gate objectives and requirements
    const objectives = extractObjectives(gateContent)
    const requirements = extractRequirements(gateContent)

    // Load proposal template
    const templatePath = path.join(projectRoot, 'templates', 'md-templates', `${templateName}.md`)
    const templateContent = await readFile(templatePath)

    // Generate proposals by decomposing objectives into tasks
    const proposals = await decomposeToProposals(
      gateId,
      objectives,
      requirements,
      templateContent,
      outputDir ?? `zeno/proposals/gate-${gateNumberStr}`
    )

    // Calculate dependencies
    const dependencies = calculateProposalDependencies(proposals)

    return {
      success: true,
      gateId,
      proposalsGenerated: proposals.length,
      proposals,
      dependencies,
      message: `Generated ${String(proposals.length)} proposals for gate ${gateId}`,
    }
  } catch (error) {
    logger.error('Failed to generate proposals', { error, input })
    throw new ZenoError(
      `Proposal generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PROPOSAL_GENERATION_FAILED'
    )
  }
}

// Helper functions moved to `proposal-parser.ts` and `proposal-writer.ts`
import { extractObjectives, extractRequirements } from './proposal-parser.js'
import { decomposeToProposals, calculateProposalDependencies } from './proposal-writer.js'
