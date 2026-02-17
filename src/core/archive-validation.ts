/**
 * Archive Validation Module
 *
 * Pre-flight validation for archive operations.
 * Ensures gates and proposals are ready to be archived
 * before proceeding with consolidation and archival.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { getZenoDir } from '../utils/config.js'
import { ZenoError } from '../utils/errors.js'

/**
 * Validate gate is ready for archive
 */
export async function validateGateReady(gateId: string): Promise<void> {
  const gatePath = join(getZenoDir(), '..', 'gates', `${gateId}.md`)
  if (!existsSync(gatePath)) {
    throw new ZenoError(`Gate ${gateId} not found`, 'ARCHIVE_VALIDATION_FAILED', {
      gateId,
      gatePath,
    })
  }

  const content = await readFile(gatePath, 'utf-8')
  if (!content.includes('**Status**: completed')) {
    throw new ZenoError(`Gate ${gateId} is not completed`, 'ARCHIVE_NOT_READY', {
      gateId,
      reason: 'Gate status is not completed',
    })
  }

  // Run artifact format validation for the gate (fast pre-archive check)
  try {
    const { ArtifactValidationService } = await import('../analysis/artifact-validation-service.js')
    const svc = new ArtifactValidationService()
    const v = await svc.validate({
      artifactPath: gatePath,
      artifactType: 'gate',
      validationMode: 'format',
    })
    if (!v.passed) {
      throw new ZenoError(`Gate ${gateId} failed format validation`, 'ARCHIVE_VALIDATION_FAILED', {
        gateId,
        errors: v.errors ?? [],
        warnings: v.warnings ?? [],
      })
    }
  } catch (err) {
    // If validation service cannot be executed, surface as archive validation failure
    const msg = err instanceof Error ? err.message : String(err)
    throw new ZenoError(`Gate ${gateId} validation error: ${msg}`, 'ARCHIVE_VALIDATION_FAILED', {
      gateId,
    })
  }

  // Check if all proposals are completed/integrated
  const proposalsDir = join(getZenoDir(), '..', 'proposals', gateId)
  if (existsSync(proposalsDir)) {
    // This is a simplified check - in practice, we'd need to check each proposal
    // For now, assume if gate is completed, proposals are integration-ready
  }

  // Check if all requirements are tested
  // This would require database access - simplified for now
}

/**
 * Validate proposal is ready for archive
 */
export async function validateProposalReady(
  hash: string
): Promise<{ type: 'gate-tied' | 'solitary'; gateId?: string; title: string }> {
  // Find proposal file
  let proposalPath: string | null = null
  let proposalType: 'gate-tied' | 'solitary' = 'solitary'
  let gateId: string | undefined

  // Check gate-tied proposals first
  const gatesDir = join(getZenoDir(), '..', 'gates')
  if (existsSync(gatesDir)) {
    const gateDirs = (await import('node:fs/promises'))
      .readdir(gatesDir)
      .then((files) => files.filter((f) => f.startsWith('gate-') && !f.includes('.')))

    for (const gateDir of await gateDirs) {
      const proposalFile = join(getZenoDir(), '..', 'proposals', gateDir, `${hash}.md`)
      if (existsSync(proposalFile)) {
        proposalPath = proposalFile
        proposalType = 'gate-tied'
        gateId = gateDir
        break
      }
    }
  }

  // Check solitary proposals
  if (!proposalPath) {
    const solitaryPath = join(getZenoDir(), '..', 'proposals', 'solitary', `${hash}.md`)
    if (existsSync(solitaryPath)) {
      proposalPath = solitaryPath
      proposalType = 'solitary'
    }
  }

  if (!proposalPath) {
    throw new ZenoError(`Proposal ${hash} not found`, 'ARCHIVE_VALIDATION_FAILED', { hash })
  }

  const content = await readFile(proposalPath, 'utf-8')
  if (!content.includes('**Status**: completed')) {
    throw new ZenoError(`Proposal ${hash} is not completed`, 'ARCHIVE_NOT_READY', {
      hash,
      reason: 'Proposal status is not completed',
    })
  }

  // Run full artifact validation for proposals before archive
  try {
    const { ArtifactValidationService } = await import('../analysis/artifact-validation-service.js')
    const svc = new ArtifactValidationService()
    const v = await svc.validate({
      artifactPath: proposalPath,
      artifactType: 'proposal',
      validationMode: 'all',
    })
    if (!v.passed) {
      throw new ZenoError(`Proposal ${hash} failed validation`, 'ARCHIVE_VALIDATION_FAILED', {
        hash,
        errors: v.errors ?? [],
        warnings: v.warnings ?? [],
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new ZenoError(`Proposal ${hash} validation error: ${msg}`, 'ARCHIVE_VALIDATION_FAILED', {
      hash,
    })
  }

  // Extract title
  const titleMatch = /\*\*Title\*\*:\s*(.+)/.exec(content)
  const title = titleMatch?.[1]?.trim() ?? `Proposal ${hash}`

  return { type: proposalType, gateId, title }
}
