/**
 * Archive Validation Module
 *
 * Pre-flight validation for archive operations.
 * Ensures gates and proposals are ready to be archived
 * before proceeding with consolidation and archival.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { getZenoDir } from '../utils/config.js'
import { ZenoError } from '../utils/errors.js'
import { parseProposalMetadata } from './proposal-parser.js'
import { findProposalByHash, resolveProposalGateInfo, findGateByGateId } from '../utils/artifact-locator.js'

/**
 * Scan tests/ for any remaining `it.skip` calls marked `// @red`.
 * Returns an array of "relative/path:line" strings, one per pending RED test.
 */
function collectRedTests(projectRoot: string): string[] {
  const testsDir = join(projectRoot, 'tests')
  if (!existsSync(testsDir)) return []

  const results: string[] = []

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.test.ts')) {
        const lines = readFileSync(full, 'utf-8').split('\n')
        lines.forEach((line, idx) => {
          if (line.includes('it.skip(') && line.includes('// @red')) {
            const rel = full.slice(projectRoot.length + 1).replace(/\\/g, '/')
            results.push(`${rel}:${String(idx + 1)}`)
          }
        })
      }
    }
  }

  walk(testsDir)
  return results
}

/**
 * Validate gate is ready for archive
 * @returns The resolved gate file path so callers can reuse it without a second lookup.
 */
export async function validateGateReady(gateId: string): Promise<{ filePath: string }> {
  // Gate files are named gate-NN-full-name.md; resolve via prefix scan.
  const gatePath = await findGateByGateId(gateId)
  if (!gatePath || !existsSync(gatePath)) {
    throw new ZenoError(`Gate ${gateId} not found`, 'ARCHIVE_VALIDATION_FAILED', {
      gateId,
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

  // Ensure no RED-phase tests remain unimplemented (`it.skip // @red`).
  // GREEN work must fully replace stubs before a gate can be archived.
  const projectRoot = join(getZenoDir(), '..', '..')
  const redTests = collectRedTests(projectRoot)
  if (redTests.length > 0) {
    throw new ZenoError(
      `Gate ${gateId} cannot be archived: ${String(redTests.length)} RED test(s) are still pending GREEN implementation`,
      'ARCHIVE_VALIDATION_FAILED',
      {
        gateId,
        reason: 'Pending RED tests must be implemented before archiving',
        pendingRedTests: redTests,
      }
    )
  }

  return { filePath: gatePath }
}

/**
 * Validate proposal is ready for archive
 */
export async function validateProposalReady(
  hash: string
): Promise<{ type: 'gate-tied' | 'solitary'; gateId?: string; title: string; filePath: string }> {
  // Find proposal file via content-based scan (files are date-named, not hash-named).
  // Delegates to the canonical findProposalByHash in artifact-locator.ts.
  const projectRoot = join(getZenoDir(), '..', '..')
  const proposalPath = await findProposalByHash(hash, projectRoot)

  if (!proposalPath) {
    throw new ZenoError(`Proposal ${hash} not found`, 'ARCHIVE_VALIDATION_FAILED', { hash })
  }

  const { type: proposalType, gateId } = resolveProposalGateInfo(proposalPath)

  const content = await readFile(proposalPath, 'utf-8')
  const metadata = parseProposalMetadata(content)
  if (metadata.status !== 'completed') {
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

  return { type: proposalType, gateId, title, filePath: proposalPath }
}
