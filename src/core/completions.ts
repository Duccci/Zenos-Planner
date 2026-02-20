/**
 * Completion Workflows
 *
 * Implements the minimal end-to-end flows needed for:
 * - proposal completion (approve -> completed)
 * - gate completion (complete -> completed)
 *
 * Side effects:
 * - Bumps project version in zeno/.zeno/config.json (semver mapping)
 * - Syncs with git (commit + tag; optional push)
 * - Updates PROJECT_PRD.md to reflect gate status changes
 */

import type Database from 'better-sqlite3'
import { findProjectRoot, loadConfig, saveConfig } from '../utils/config.js'
import { ConfigError, DatabaseError, ValidationError } from '../utils/errors.js'
import { bumpSemver, type VersionBump } from '../utils/version.js'
import { initializeDatabase, getDatabase } from '../storage/database.js'
import { syncWithGit } from '../utils/git.js'
import {
  consolidateGateProposals,
  generateConsolidationMarkdown,
} from '../utils/gate-consolidation.js'
import { readFile, writeFile, ensureDir } from '../utils/file.js'
import { readdir, unlink } from 'node:fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import { stripAnsi } from '../utils/ansi-strip.js'
import { analyzeGateChanges } from './write-time-analyzer.js'
import { regenerateGatesWithAnalysis } from './gate-generator.js'
import { updateProjectPRDGates } from './prd-updater.js'

function normalizeHash(input: string): string {
  const trimmed = input.trim()
  return trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
}

function normalizeGateId(input: string): string {
  const trimmed = input.trim()
  const m = /^gate-(\d+)$/.exec(trimmed)
  if (!m) return trimmed
  const n = m[1] ?? ''
  return `gate-${n.padStart(2, '0')}`
}

function requireProjectRoot(): string {
  const root = findProjectRoot(process.cwd())
  if (!root) {
    throw new ConfigError(
      'Not a Zeno project (missing zeno/.zeno directory)',
      'CONFIG_PROJECT_ROOT_NOT_FOUND',
      { cwd: process.cwd() }
    )
  }
  return root
}

function getGitSettings(config: Awaited<ReturnType<typeof loadConfig>>): {
  autoCommit: boolean
  autoTag: boolean
  autoPush: boolean
  remote: string
} {
  return {
    autoCommit: config.git?.autoCommit ?? true,
    autoTag: config.git?.autoTag ?? true,
    autoPush: config.git?.autoPush ?? false,
    remote: config.git?.remote ?? 'origin',
  }
}

function getVersioningSettings(config: Awaited<ReturnType<typeof loadConfig>>): {
  enabled: boolean
  proposalBump: VersionBump
  gateBump: VersionBump
  lifecycleBump: VersionBump
} {
  const versioning = config.versioning
  return {
    enabled: versioning.enabled,
    proposalBump: versioning.proposalBump as VersionBump,
    gateBump: versioning.gateBump as VersionBump,
    lifecycleBump: versioning.lifecycleBump as VersionBump,
  }
}

function getRequiredRow<T>(
  row: T | undefined,
  message: string,
  context: Record<string, unknown>
): T {
  if (!row) {
    throw new ValidationError(message, 'VALIDATION_NOT_FOUND', context)
  }
  return row
}

function getDb(projectRoot: string): Database.Database {
  try {
    return getDatabase(projectRoot)
  } catch (error) {
    throw new DatabaseError(
      'Failed to open database',
      'DB_CONNECTION_FAILED',
      { projectRoot },
      error as Error
    )
  }
}

/**
 * Update gate document objectives based on completed proposal
 */
async function updateGateObjectivesFromProposal(
  projectRoot: string,
  gateId: string,
  proposalContent: string
): Promise<void> {
  const gatePath = path.join(projectRoot, 'zeno', 'gates', `${gateId}.md`)

  try {
    const gateContent = await readFile(gatePath)

    // Extract proposal summary
    const summaryMatch = /## Summary\s*\n\n([\s\S]*?)\n\n---/.exec(proposalContent)
    const summary = summaryMatch?.[1]?.toLowerCase() ?? ''

    // Extract proposal title
    const titleMatch = /# Proposal: (.+)/.exec(proposalContent)
    const title = titleMatch?.[1]?.toLowerCase() ?? ''

    // Find objectives section
    const objectivesMatch = /## Objectives\s*\n\n([\s\S]*?)\n\n##/.exec(gateContent)
    if (!objectivesMatch?.[1]) return

    const objectivesSection = objectivesMatch[1]

    // Find unchecked objectives that match the proposal
    const updatedObjectives = objectivesSection.replace(
      /- \[ \] ([^\n]+)/g,
      (match, objective: string) => {
        const objLower = objective.toLowerCase()

        // Check if objective keywords appear in proposal summary or title
        const keywords = objLower.split(/\s+/)
        const matches = keywords.filter(
          (keyword: string) =>
            keyword.length > 3 && (summary.includes(keyword) || title.includes(keyword))
        )

        // If significant matches found, mark as completed
        if (matches.length >= 2 || (matches.length >= 1 && objLower.includes('command'))) {
          return `- [x] ${objective}`
        }

        return match
      }
    )

    // Update gate content
    const newGateContent = gateContent.replace(objectivesSection, updatedObjectives)
    await writeFile(gatePath, newGateContent)
  } catch (error) {
    // Gate file might not exist or be readable, skip silently
    logger.debug(`Could not update gate objectives for ${gateId}: ${String(error)}`)
  }
}

export interface ApproveProposalOptions {
  /** Approver identity recorded in DB and proposal file metadata. Defaults to undefined (no approver recorded). */
  approver?: string
}

export async function approveProposal(
  hashInput: string,
  options: ApproveProposalOptions = {}
): Promise<{
  projectRoot: string
  proposalHash: string
  gateId: string
  title: string
  previousVersion: string
  newVersion: string
}> {
  const projectRoot = requireProjectRoot()
  await initializeDatabase(projectRoot, { syncProposals: true })
  const db = getDb(projectRoot)

  // Ensure approved_by column exists (added by this proposal; idempotent)
  try {
    db.prepare('ALTER TABLE proposals ADD COLUMN approved_by TEXT').run()
  } catch {
    // Column already exists — ignore
  }

  const proposalHash = normalizeHash(hashInput)

  const proposal = getRequiredRow(
    db
      .prepare(
        `SELECT id, gate_id as gateId, title, status, requirement_id
         FROM proposals
         WHERE hash = ?`
      )
      .get(proposalHash) as
      | { id: string; gateId: string; title: string; status: string; requirement_id: string | null }
      | undefined,
    'Proposal not found',
    { hash: proposalHash }
  )

  if (proposal.status === 'completed') {
    throw new ValidationError('Proposal is already completed', 'VALIDATION_STATE_CONFLICT', {
      hash: proposalHash,
      status: proposal.status,
    })
  }
  if (proposal.status === 'rejected') {
    throw new ValidationError('Cannot approve a rejected proposal', 'VALIDATION_STATE_CONFLICT', {
      hash: proposalHash,
      status: proposal.status,
    })
  }

  const tx = db.transaction((proposalId: string) => {
    db.prepare(
      `UPDATE proposals
       SET status = 'completed',
           approved_at = CURRENT_TIMESTAMP,
           implemented_at = CURRENT_TIMESTAMP,
           approved_by = ?
       WHERE id = ?`
    ).run(options.approver ?? null, proposalId)
  })
  tx(proposal.id)

  // Update proposal file metadata in place (no proposal archive directory)
  let proposalContent = ''
  try {
    const gateDir = path.join(projectRoot, 'zeno', 'proposals', proposal.gateId)
    const files = await readdir(gateDir)
    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(gateDir, file)
        const content = await readFile(filePath)
        if (content.includes(`**Hash**: #${proposalHash}`)) {
          const completedAt = new Date().toISOString()
          let updatedContent = content

          if (/\*\*Status\*\*:\s*\w+/i.test(updatedContent)) {
            updatedContent = updatedContent.replace(
              /\*\*Status\*\*:\s*\w+/i,
              '**Status**: completed'
            )
          }

          if (!updatedContent.includes('**Implemented**:')) {
            updatedContent = updatedContent.replace(
              '**Status**: completed',
              `**Status**: completed\n**Implemented**: ${completedAt}`
            )
          }

          if (options.approver && !updatedContent.includes('**Approved By**:')) {
            updatedContent = updatedContent.replace(
              '**Status**: completed',
              `**Status**: completed\n**Approved By**: ${options.approver}`
            )
          }

          await writeFile(filePath, updatedContent)
          proposalContent = updatedContent
          break
        }
      }
    }
  } catch (error) {
    logger.warn(`Failed to move proposal file for ${proposalHash}: ${String(error)}`)
  }

  // Update gate document objectives based on proposal completion
  try {
    if (proposalContent) {
      await updateGateObjectivesFromProposal(projectRoot, proposal.gateId, proposalContent)
    }
  } catch (error) {
    logger.warn(`Failed to update gate objectives for ${proposalHash}: ${String(error)}`)
  }

  // Note: Commits deferred to gate completion (archive phase) for human-in-the-loop oversight.
  // Proposal approval changes the database state but does NOT commit to git.
  // Human must explicitly approve gate completion via `zeno gates complete` to trigger commits.

  const config = await loadConfig(projectRoot)

  return {
    projectRoot,
    proposalHash,
    gateId: proposal.gateId,
    title: proposal.title,
    previousVersion: config.version,
    newVersion: config.version,
  }
}

export interface CompleteGateOptions {
  push?: boolean
}

export async function completeGate(
  gateIdInput: string,
  options: CompleteGateOptions = {}
): Promise<{
  projectRoot: string
  gateId: string
  gateName: string
  previousVersion: string
  newVersion: string
  bump: 'minor' | 'major'
}> {
  const projectRoot = requireProjectRoot()
  await initializeDatabase(projectRoot, { syncProposals: true })
  const db = getDb(projectRoot)

  const gateId = normalizeGateId(gateIdInput)

  const gate = getRequiredRow(
    db
      .prepare(
        `SELECT id, name, status
         FROM gates
         WHERE id = ?`
      )
      .get(gateId) as { id: string; name: string; status: string } | undefined,
    'Gate not found',
    { gateId }
  )

  if (gate.status === 'completed') {
    throw new ValidationError('Gate is already completed', 'VALIDATION_STATE_CONFLICT', {
      gateId,
      status: gate.status,
    })
  }
  if (gate.status === 'rejected') {
    throw new ValidationError('Cannot complete a rejected gate', 'VALIDATION_STATE_CONFLICT', {
      gateId,
      status: gate.status,
    })
  }

  const tx = db.transaction((id: string) => {
    db.prepare(
      `UPDATE gates
       SET status = 'completed',
           completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(id)

    // Update all requirements for this gate to tested
  })
  tx(gate.id)

  // Analyze gate changes for incremental metrics
  try {
    const analysisPromise = analyzeGateChanges(gateId)
    if (analysisPromise instanceof Promise) {
      await analysisPromise
    }
    // Regenerate future gates based on analysis (or theoretical if no analysis yet)
    const regeneratePromise = regenerateGatesWithAnalysis(gateId)
    if (regeneratePromise instanceof Promise) {
      await regeneratePromise
    }
  } catch (error) {
    logger.warn(`Failed to analyze and regenerate gates for ${gateId}: ${String(error)}`)
    // Don't fail completion if analysis fails
  }

  // Consolidate proposals into gate archive
  try {
    const proposalsDir = path.join(projectRoot, 'zeno', 'proposals')
    const consolidation = await consolidateGateProposals(gateId, proposalsDir)
    const consolidationMd = generateConsolidationMarkdown(consolidation)

    // Read the gate PRD
    const gatePrdPath = path.join(projectRoot, 'zeno', 'gates', `${gateId}.md`)
    let gateContent = ''
    try {
      gateContent = await readFile(gatePrdPath)
    } catch {
      // If no PRD exists, create basic one
      const dateStr: string = new Date().toISOString().split('T')[0] ?? ''
      gateContent = `# ${gate.name}\n\n**Status**: completed\n**Completed**: ${dateStr}\n\n## Overview\n\n${gate.name} implementation.\n`
    }

    // Append consolidation
    const newGateContent = gateContent + '\n\n' + consolidationMd

    // Ensure archive directory exists
    const archiveDir = path.join(projectRoot, 'zeno', 'gates', 'archive')
    await ensureDir(archiveDir)

    // Write to archive
    const archivePath = path.join(archiveDir, `${gateId}.md`)
    await writeFile(archivePath, newGateContent)

    // Remove the original gate PRD from gates/
    const originalGatePath = path.join(projectRoot, 'zeno', 'gates', `${gateId}.md`)
    try {
      await unlink(originalGatePath)
    } catch (error) {
      logger.warn(`Failed to remove original gate PRD ${originalGatePath}: ${String(error)}`)
    }

    // Delete proposals from database after consolidation
    // First get proposal hashes for cleanup
    const proposalRows = db
      .prepare('SELECT hash FROM proposals WHERE gate_id = ?')
      .all(gate.id) as { hash: string }[]
    const proposalHashes = proposalRows.map((row) => row.hash)

    // Delete dependencies involving these proposals
    if (proposalHashes.length > 0) {
      const placeholders = proposalHashes.map(() => '?').join(',')
      db.prepare(
        `DELETE FROM dependencies WHERE source_entity_type = 'proposal' AND source_hash IN (${placeholders})`
      ).run(...proposalHashes)
      db.prepare(
        `DELETE FROM dependencies WHERE target_entity_type = 'proposal' AND target_hash IN (${placeholders})`
      ).run(...proposalHashes)

      // Delete from hash registry
      db.prepare(
        `DELETE FROM hash_registry WHERE entity_type = 'proposal' AND entity_id IN (${placeholders})`
      ).run(...proposalHashes)

      // Delete from state history
      db.prepare(
        `DELETE FROM state_history WHERE entity_type = 'proposal' AND entity_id IN (${placeholders})`
      ).run(...proposalHashes)
    }

    // Delete the proposals themselves
    db.prepare('DELETE FROM proposals WHERE gate_id = ?').run(gate.id)

    // Clear proposal_hashes from the gate record
    db.prepare('UPDATE gates SET proposal_hashes = NULL WHERE id = ?').run(gate.id)

    // Remove the gate directory if empty
    const gateDir = path.join(proposalsDir, gateId)
    try {
      const remaining = await readdir(gateDir)
      if (remaining.length === 0) {
        // Remove empty dir (using run_in_terminal since fs.rmdirSync might not work)
        // But for now, leave it
      }
    } catch {
      // Dir doesn't exist or can't read
    }
  } catch (error) {
    logger.warn(`Failed to consolidate proposals for ${gateId}: ${String(error)}`)
    // Don't fail the completion if consolidation fails
  }

  // Update PROJECT_PRD.md to reflect gate status changes
  // This ensures the PRD stays accurate whenever gates are archived.
  // PRD updates should also be called:
  //   - When new gates are created (via gate generation/initialization)
  //   - When gates are regenerated/realigned (via rescope workflow)
  // See prd-updater.ts for additional update functions.
  try {
    await updateProjectPRDGates(projectRoot)
  } catch (error) {
    logger.warn(`Failed to update PROJECT_PRD.md: ${String(error)}`)
    // Don't fail the completion if PRD update fails
  }

  // Lifecycle completion detection: after marking this gate completed, if there
  // are no remaining non-completed gates, bump major. Otherwise bump minor.
  const remaining = db
    .prepare(`SELECT COUNT(*) as count FROM gates WHERE status != 'completed'`)
    .get() as { count: number }

  const config = await loadConfig(projectRoot)
  const versioning = getVersioningSettings(config)
  const bump: 'minor' | 'major' = remaining.count === 0 ? 'major' : 'minor'
  const bumpKind: VersionBump =
    remaining.count === 0 ? versioning.lifecycleBump : versioning.gateBump

  const previousVersion = config.version
  const newVersion = versioning.enabled ? bumpSemver(previousVersion, bumpKind) : previousVersion
  if (newVersion !== previousVersion) {
    await saveConfig({ ...config, version: newVersion }, projectRoot)
  }

  const git = getGitSettings(config)
  if (git.autoCommit) {
    const tagName = git.autoTag ? `v${newVersion}-${gateId}` : undefined
    const tagMessage = git.autoTag
      ? stripAnsi(`Gate ${gateId}: ${gate.name} (version ${newVersion})`)
      : undefined

    await syncWithGit({
      commitMessage: stripAnsi(
        `chore(gate): complete ${gateId} - ${gate.name}\n\nVersion: ${newVersion}\n`
      ),
      tagName,
      tagMessage,
      autoPush: options.push ?? git.autoPush,
      remote: git.remote,
      dir: projectRoot,
    })
  }

  return {
    projectRoot,
    gateId,
    gateName: gate.name,
    previousVersion,
    newVersion,
    bump,
  }
}
