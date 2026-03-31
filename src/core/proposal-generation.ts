/**
 * Proposal Generation Workflow
 *
 * Handles generation of proposal documents from a gate PRD.
 * Responsible for: reading gate objectives, parsing requirements,
 * decomposing into proposals with tasks, and calculating dependencies.
 */

import { readFile, writeFile } from '../utils/file.js'
import { logger } from '../utils/logger.js'
import { ZenoError } from '../utils/errors.js'
import { findGateByGateId } from '../utils/artifact-locator.js'
import { getZenoGitDir } from '../utils/config.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __installDir = fileURLToPath(new URL('../..', import.meta.url))

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
    phase?: 'RED' | 'GREEN'
    coverageTarget?: number
  }[]
  dependencies?: {
    from: string
    to: string
    type: string
  }[]
  message: string
  scaffoldNotice?: string
  nextSteps?: string[]
  /** Top-level objectives extracted from the gate PRD used for proposal decomposition. */
  objectives?: string[]
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

    // Read gate PRD — resolve short gate IDs (e.g. "gate-06") to full filenames
    const [, gnum = ''] = gateId.split('-')
    const gateNumberStr: string = gnum
    const gatePrdPath = await findGateByGateId(gateId, projectRoot)
    if (!gatePrdPath) {
      throw new ZenoError(
        `Gate PRD not found for "${gateId}" in zeno/gates/`,
        'GATE_NOT_FOUND'
      )
    }
    const gateContent = await readFile(gatePrdPath)

    // Parse gate objectives, type, and requirements
    const objectives = extractObjectives(gateContent)
    const gateType = extractGateType(gateContent)
    const requirements = extractRequirements(gateContent)

    // Load proposal template
    const templatePath = path.join(__installDir, 'templates', 'md-templates', `${templateName}.md`)
    const templateContent = await readFile(templatePath)

    // Generate proposals by decomposing objectives into tasks
    const proposals = await decomposeToProposals(
      gateId,
      objectives,
      requirements,
      templateContent,
      outputDir ?? path.join(getZenoGitDir(projectRoot), 'proposals', `gate-${gateNumberStr}`),
      gateType
    )

    // Calculate dependencies and parallel execution sets
    const { edges: dependencies, parallelSets } = calculateProposalDependencies(proposals)

    // Annotate each proposal with its parallel set index
    parallelSets.forEach((set, idx) => {
      set.forEach((hash) => {
        const proposal = proposals.find((p) => p.hash === hash)
        if (proposal) {
          proposal.parallelSetIndex = idx
        }
      })
    })

    // Update frontmatter files to write the computed parallelSetIndex values
    for (const proposal of proposals) {
      if (proposal.parallelSetIndex !== undefined) {
        const content = await readFile(proposal.path, 'utf-8')
        const updatedContent = content.replace(/parallel_set_index: null/, `parallel_set_index: ${String(proposal.parallelSetIndex)}`)
        await writeFile(proposal.path, updatedContent)
      }
    }

    // NOTE: Artifact validation is intentionally NOT run here. Generated scaffold
    // files contain unfilled bracket placeholders and LLM instruction comments by
    // design — an AI is expected to replace those before validation. Run
    // `proposal_action:validate { hash }` after the proposals are filled in.

    // Sync newly written proposal files into the DB so that subsequent
    // proposal_show / proposal_list calls see them immediately.
    // Validate RED/GREEN guardrails (skip for documentation gates — no tests expected)
    if (gateType !== 'documentation') {
      const guardrailErrors = validateRedGreenGuardrails(proposals)
      if (guardrailErrors.length > 0) {
        logger.warn('RED/GREEN guardrail validation warnings', { guardrailErrors })
      }
    }

    try {
      const { syncProposalsFromDisk } = await import('../storage/proposal-sync.js')
      const { getDatabase } = await import('../storage/database.js')
      const db = getDatabase(projectRoot)
      syncProposalsFromDisk(db, projectRoot)
    } catch (syncErr) {
      logger.debug('Non-fatal: proposal sync after generation failed', { syncErr })
    }

    return {
      success: true,
      gateId,
      proposalsGenerated: proposals.length,
      proposals,
      dependencies,
      message: `Generated ${String(proposals.length)} scaffold proposal(s) for ${gateId}. These files are ready to be filled in — see scaffoldNotice and nextSteps.`,
      objectives,
      scaffoldNotice: [
        'IMPORTANT: The scaffold files written to disk are the FINAL proposal files.',
        'Do NOT delete, recreate, or replace them. Do NOT write scripts to modify them.',
        'Edit each file DIRECTLY using your file-editing tools (one proposal at a time).',
        gateType === 'documentation'
          ? 'This is a documentation gate — no RED/GREEN test phases. Each file contains a documentation task skeleton.'
          : 'Each file already contains the correct RED/GREEN structure, requirements, and task skeleton.',
        'Your job is to read the gate PRD, then edit each proposal file in sequence to replace bracketed placeholders ([...]) with concrete, gate-specific content.',
      ].join('\n'),
      nextSteps: [
        `1. VERIFY decomposition: ${String(objectives.length)} objective(s) extracted → ${objectives.map((o, i) => `(${String(i + 1)}) ${o}`).join('; ')}. If this does not match the gate's major deliverables, stop and re-read the gate PRD before editing any proposal.`,
        `2. Read the gate PRD: ${path.relative(projectRoot, gatePrdPath).replace(/\\/g, '/')} — gather requirements, technical decisions, and acceptance criteria`,
        '2. For EACH scaffold proposal file (in order), open the file, read it, and directly edit it to:',
        '   a. Refine the proposal title if needed (scaffold title comes from the gate objective)',
        '   b. Write a concrete Summary (2-3 sentences) referencing the gate objective',
        '   c. Fill in Context / Why This Change with the rationale from the gate PRD',
        '   d. Refine the Tasks section with specific file paths, function names, and acceptance criteria',
        '   e. Populate the Files Affected table with actual source file paths',
        '   f. Set Dependencies using hash references to other proposals in this gate',
        '3. After ALL proposals are filled in, run proposal_action:validate { hash } for each',
        '4. Present a summary table of all proposals to the user for review',
      ],
    }
  } catch (error) {
    logger.error('Failed to generate proposals', { error, input })
    throw new ZenoError(
      `Proposal generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PROPOSAL_GENERATION_FAILED'
    )
  }
}

/**
 * Validate that RED/GREEN design principles are followed.
 *
 * Expected structure:
 *   Proposal 1     — RED (single test suite)
 *   Proposals 2..N — implementation (one per objective, no phase)
 *   Proposal N+1   — GREEN (single test verification, always last)
 */
function validateRedGreenGuardrails(
  proposals: {
    hash: string
    phase?: string
    filename?: string
  }[]
): string[] {
  const errors: string[] = []

  if (proposals.length === 0) return errors

  // RED must be the first proposal
  const redProposals = proposals.filter((p) => p.phase === 'RED')
  const greenProposals = proposals.filter((p) => p.phase === 'GREEN')

  if (redProposals.length > 1) {
    errors.push('Only one RED (test-suite) proposal is allowed per gate')
  }
  if (greenProposals.length > 1) {
    errors.push('Only one GREEN (test-verification) proposal is allowed per gate')
  }

  if (redProposals.length === 1 && proposals[0]?.phase !== 'RED') {
    errors.push('RED (test-suite) proposal must be the first proposal in the gate')
  }

  if (greenProposals.length === 1 && proposals[proposals.length - 1]?.phase !== 'GREEN') {
    errors.push('GREEN (test-verification) proposal must be the last proposal in the gate')
  }

  return errors
}

// Helper functions moved to `proposal-parser.ts` and `proposal-writer.ts`
import { extractObjectives, extractGateType, extractRequirements } from './proposal-parser.js'
import { decomposeToProposals, calculateProposalDependencies } from './proposal-writer.js'
