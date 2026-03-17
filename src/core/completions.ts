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
import {
  consolidateGateProposals,
  generateConsolidationMarkdown,
} from '../utils/gate-consolidation.js'
import { readFile, writeFile, ensureDir } from '../utils/file.js'
import { readdir, unlink, rmdir } from 'node:fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import { stripAnsi } from '../utils/ansi-strip.js'
import { normalizeGateId, normalizeHash } from '../utils/normalize.js'
import { analyzeGateChanges } from './write-time-analyzer.js'
import { regenerateGatesWithAnalysis, regenerateGatesTheoreticalFromProject } from './gate-generator.js'
import { updateProjectPRDGates } from './prd-updater.js'
import { archiveCompletedGateInState, updateCurrentGateInState } from '../utils/state-sync.js'
import { readProjectOverview, getCompletedGates } from '../utils/config.js'
import { syncMemoryFromProjectOverview } from '../utils/memory-sync.js'
import { syncGatesToProjectOverview } from '../utils/gate-sync.js'
import { findGateByGateId, findProposalByHash } from '../utils/artifact-locator.js'
import { ApprovalAuditTrail } from '../storage/approval-audit-trail.js'
import { WorktreeManager } from './worktree-manager.js'



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
  autoTag: boolean
  autoPush: boolean
  remote: string
} {
  return {
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
  // Gate files are named gate-NN-full-name.md; resolve via prefix scan.
  const gatePath = await findGateByGateId(gateId, projectRoot)

  try {
    if (!gatePath) return
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
  await initializeDatabase(projectRoot, { syncProposals: true, syncRequirements: true })
  const db = getDb(projectRoot)

  // Ensure approved_by column exists (added by this proposal; idempotent)
  try {
    db.prepare('ALTER TABLE proposals ADD COLUMN approved_by TEXT').run()
  } catch {
    // Column already exists — ignore
  }

  // Ensure implemented_at column exists (added by this proposal; idempotent)
  try {
    db.prepare('ALTER TABLE proposals ADD COLUMN implemented_at TIMESTAMP').run()
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

  // Record approval event in audit trail
  try {
    const auditTrail = new ApprovalAuditTrail(db)
    auditTrail.record({
      proposal_hash: proposalHash,
      decision: 'approved',
      actor: options.approver ?? 'zeno',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.warn(`Failed to record approval event for ${proposalHash}: ${String(error)}`)
  }

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

  // Clean up the worktree associated with this proposal (if any)
  try {
    const worktreeManager = new WorktreeManager(projectRoot)
    await worktreeManager.remove(proposalHash, true)
    logger.debug(`Removed worktree for proposal ${proposalHash}`)
  } catch (error) {
    logger.debug(`No worktree to remove for proposal ${proposalHash}: ${String(error)}`)
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

export interface CompleteGateGitInstructions {
  commitMessage: string
  tagName?: string
  tagMessage?: string
  commands: string[]
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
  gitInstructions: CompleteGateGitInstructions
}> {
  const projectRoot = requireProjectRoot()
  await initializeDatabase(projectRoot, { syncProposals: true, syncRequirements: true })
  const db = getDb(projectRoot)

  const gateId = normalizeGateId(gateIdInput)

  const gate = getRequiredRow(
    db
      .prepare(
        `SELECT id, name, status, sequence, hash
         FROM gates
         WHERE id = ?`
      )
      .get(gateId) as { id: string; name: string; status: string; sequence: number; hash: string | null } | undefined,
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
    // Gate files are named gate-NN-full-name.md; resolve via prefix scan.
    const gatePrdPath = await findGateByGateId(gateId, projectRoot)
    let gateContent = ''
    try {
      if (gatePrdPath) gateContent = await readFile(gatePrdPath)
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
    const originalGatePath = gatePrdPath
    try {
      if (originalGatePath) await unlink(originalGatePath)
    } catch (error) {
      logger.warn(`Failed to remove original gate PRD ${String(originalGatePath)}: ${String(error)}`)
    }

    // Delete proposals from database after consolidation
    // First get proposal IDs and hashes for cleanup
    const proposalRows = db
      .prepare('SELECT id, hash FROM proposals WHERE gate_id = ?')
      .all(gate.id) as { id: string; hash: string }[]
    const proposalIds = proposalRows.map((row) => row.id)
    const proposalHashes = proposalRows.map((row) => row.hash)

    // Delete proposal_dependencies involving these proposals (both directions)
    if (proposalIds.length > 0) {
      const idPlaceholders = proposalIds.map(() => '?').join(',')
      const hashPlaceholders = proposalHashes.map(() => '?').join(',')
      db.prepare(
        `DELETE FROM proposal_dependencies WHERE source_proposal_id IN (${idPlaceholders})`
      ).run(...proposalIds)
      db.prepare(
        `DELETE FROM proposal_dependencies WHERE target_proposal_hash IN (${hashPlaceholders})`
      ).run(...proposalHashes)
    }

    // Delete the proposals themselves
    db.prepare('DELETE FROM proposals WHERE gate_id = ?').run(gate.id)

    // Clear proposal_hashes from the gate record.
    // NOTE: proposal_hashes is a denormalised cache column; its write path (populating
    // hashes when proposals are created/assigned) is planned for gate-07. For now this
    // clear is a no-op but kept so the column is reset consistently on archive.
    db.prepare('UPDATE gates SET proposal_hashes = NULL WHERE id = ?').run(gate.id)

    // Delete proposal files and remove the gate proposals directory
    const gateDir = path.join(proposalsDir, gateId)
    try {
      const files = await readdir(gateDir)
      for (const file of files) {
        try {
          await unlink(path.join(gateDir, file))
        } catch (unlinkErr) {
          logger.warn(`Failed to delete proposal file ${file}: ${String(unlinkErr)}`)
        }
      }
      await rmdir(gateDir)
    } catch {
      // Dir doesn't exist or already removed — nothing to do
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

  // Sync gate completion to project.json (backup/traceability archive)
  // Use DB gate values directly — avoids brittle name-based lookup against
  // project-overview.completedGates which may not be synced yet at this point.
  try {
    await archiveCompletedGateInState(
      gateId,
      gate.name,
      gate.sequence,
      gate.hash ?? `#gate${gateId.replace('gate-', '')}`,
      projectRoot
    )
  } catch (error) {
    logger.warn(`Failed to archive gate in project.json: ${String(error)}`)
    // Don't fail the completion if state sync fails
  }

  // Refresh .serena/memories/project_overview.md Gate Roadmap section from
  // project.json so agent sessions have current context.
  try {
    await syncMemoryFromProjectOverview(projectRoot)
  } catch (error) {
    logger.warn(`Failed to sync memory from project.json: ${String(error)}`)
    // Don't fail the completion if memory sync fails
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
  const commitMessage = stripAnsi(
    `feat(${gateId}): complete ${gate.name}\n\nVersion: ${newVersion}\n`
  )
  const tagName = git.autoTag ? `v${newVersion}-${gateId}` : undefined
  const tagMessage = git.autoTag
    ? stripAnsi(`Gate ${gateId}: ${gate.name} (version ${newVersion})`)
    : undefined

  // Build the ordered shell commands the agent should run to commit and tag
  const commands: string[] = [`git add -A`, `git commit -m ${JSON.stringify(commitMessage)}`]
  if (tagName) {
    commands.push(`git tag -a ${tagName} -m ${JSON.stringify(tagMessage ?? tagName)}`)
  }
  if (git.autoPush || options.push) {
    commands.push(`git push ${git.remote} HEAD`)
    if (tagName) {
      commands.push(`git push ${git.remote} ${tagName}`)
    }
  }

  return {
    projectRoot,
    gateId,
    gateName: gate.name,
    previousVersion,
    newVersion,
    bump,
    gitInstructions: { commitMessage, tagName, tagMessage, commands },
  }
}

export interface StartProposalOptions {
  startedBy?: string
}

export async function startProposal(
  hashInput: string,
  _options: StartProposalOptions = {}
): Promise<void> {
  const projectRoot = requireProjectRoot()
  await initializeDatabase(projectRoot, { syncProposals: true, syncRequirements: true })
  const db = getDb(projectRoot)

  const proposalHash = normalizeHash(hashInput)

  const proposal = getRequiredRow(
    db
      .prepare('SELECT id, status FROM proposals WHERE hash = ?')
      .get(proposalHash) as { id: string; status: string } | undefined,
    'Proposal not found',
    { hash: proposalHash }
  )

  if (proposal.status === 'in_progress') {
    throw new ValidationError('Proposal is already in progress', 'VALIDATION_STATE_CONFLICT', {
      hash: proposalHash,
      status: proposal.status,
    })
  }
  if (proposal.status === 'completed' || proposal.status === 'rejected') {
    throw new ValidationError(
      `Cannot start a ${proposal.status} proposal`,
      'VALIDATION_STATE_CONFLICT',
      { hash: proposalHash, status: proposal.status }
    )
  }

  db.prepare(
    `UPDATE proposals SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(proposal.id)

  // Sync status to proposal .md file
  try {
    const filePath = await findProposalByHash(proposalHash, projectRoot)
    if (filePath) {
      const content = await readFile(filePath)
      const updated = content.replace(/(\*\*Status\*\*:\s*)\w+/i, '$1in_progress')
      await writeFile(filePath, updated)
    }
  } catch (error) {
    logger.warn(`Failed to sync in_progress status to proposal file for ${proposalHash}: ${String(error)}`)
  }
}

export interface RejectProposalOptions {
  rejectedBy?: string
  rejectionReason?: string
}

export async function rejectProposal(
  hashInput: string,
  options: RejectProposalOptions = {}
): Promise<void> {
  const projectRoot = requireProjectRoot()
  await initializeDatabase(projectRoot, { syncProposals: true, syncRequirements: true })
  const db = getDb(projectRoot)

  const proposalHash = normalizeHash(hashInput)

  const proposal = getRequiredRow(
    db
      .prepare('SELECT id, status FROM proposals WHERE hash = ?')
      .get(proposalHash) as { id: string; status: string } | undefined,
    'Proposal not found',
    { hash: proposalHash }
  )

  if (proposal.status === 'rejected') {
    throw new ValidationError('Proposal is already rejected', 'VALIDATION_STATE_CONFLICT', {
      hash: proposalHash,
      status: proposal.status,
    })
  }
  if (proposal.status === 'completed') {
    throw new ValidationError('Cannot reject a completed proposal', 'VALIDATION_STATE_CONFLICT', {
      hash: proposalHash,
      status: proposal.status,
    })
  }

  db.prepare(
    `UPDATE proposals SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(proposal.id)

  // Record rejection event in audit trail
  try {
    const auditTrail = new ApprovalAuditTrail(db)
    auditTrail.record({
      proposal_hash: proposalHash,
      decision: 'rejected',
      actor: options.rejectedBy ?? 'zeno',
      reason: options.rejectionReason,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.warn(`Failed to record rejection event for ${proposalHash}: ${String(error)}`)
  }

  // Sync status to proposal .md file
  try {
    const filePath = await findProposalByHash(proposalHash, projectRoot)
    if (filePath) {
      const content = await readFile(filePath)
      const updated = content.replace(/(\*\*Status\*\*:\s*)\w+/i, '$1rejected')
      await writeFile(filePath, updated)
    }
  } catch (error) {
    logger.warn(`Failed to sync rejected status to proposal file for ${proposalHash}: ${String(error)}`)
  }
}

export interface StartGateOptions {
  startedBy?: string
}

export async function startGate(
  gateIdInput: string,
  _options: StartGateOptions = {}
): Promise<void> {
  const projectRoot = requireProjectRoot()
  await initializeDatabase(projectRoot, { syncProposals: false })
  const db = getDb(projectRoot)

  const gateId = normalizeGateId(gateIdInput)

  const gate = getRequiredRow(
    db
      .prepare('SELECT id, name, sequence, hash, status FROM gates WHERE id = ?')
      .get(gateId) as { id: string; name: string; sequence: number; hash: string; status: string } | undefined,
    'Gate not found',
    { gateId }
  )

  if (gate.status === 'in_progress') {
    throw new ValidationError('Gate is already in progress', 'VALIDATION_STATE_CONFLICT', {
      gateId,
      status: gate.status,
    })
  }
  if (gate.status === 'completed' || gate.status === 'rejected') {
    throw new ValidationError(
      `Cannot start a ${gate.status} gate`,
      'VALIDATION_STATE_CONFLICT',
      { gateId, status: gate.status }
    )
  }

  db.prepare(
    `UPDATE gates SET status = 'in_progress' WHERE id = ?`
  ).run(gate.id)

  // Sync currentGate to project.json
  try {
    await updateCurrentGateInState(gate.id, gate.name, gate.sequence, gate.hash)
  } catch (error) {
    logger.warn(`Failed to sync gate start to project.json: ${String(error)}`)
  }

  // Sync gates back to project.json
  try {
    await syncGatesToProjectOverview()
  } catch (error) {
    logger.debug(`Failed to sync gates to project.json: ${String(error)}`)
  }

  // Sync status to gate .md file
  try {
    const gatePath = await findGateByGateId(gateId, projectRoot)
    if (gatePath) {
      const content = await readFile(gatePath)
      const updated = content.replace(/(\*\*Status\*\*:\s*)\w+/i, '$1in_progress')
      await writeFile(gatePath, updated)
    }
  } catch (error) {
    logger.warn(`Failed to sync in_progress status to gate file for ${gateId}: ${String(error)}`)
  }
}

export async function regenerateGates(): Promise<void> {
  // Sync first to ensure current data
  try {
    await syncGatesToProjectOverview()
  } catch (error) {
    logger.debug(`Failed to sync gates before regeneration: ${String(error)}`)
  }

  let recentGateId: string | undefined

  try {
    const overview = await readProjectOverview()
    const completed = getCompletedGates(overview)
    if (completed.length > 0) {
      const last = completed[completed.length - 1]
      if (last) {
        recentGateId = `gate-${last.sequence.toString().padStart(2, '0')}`
      }
    }
  } catch {
    // No project.json — proceed without base gate
  }

  if (recentGateId) {
    await regenerateGatesWithAnalysis(recentGateId)
  } else {
    await regenerateGatesTheoreticalFromProject()
  }
}
