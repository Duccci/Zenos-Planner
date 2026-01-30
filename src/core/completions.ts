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
 */

import type Database from 'better-sqlite3'
import { findProjectRoot, loadConfig, saveConfig } from '../utils/config.js'
import { ConfigError, DatabaseError, ValidationError } from '../utils/errors.js'
import { bumpSemver, type VersionBump } from '../utils/version.js'
import { initializeDatabase, getDatabase } from '../storage/database.js'
import { syncWithGit } from '../utils/git.js'

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
  const versioning = config.versioning;
  return {
    enabled: versioning.enabled,
    proposalBump: versioning.proposalBump as VersionBump,
    gateBump: versioning.gateBump as VersionBump,
    lifecycleBump: versioning.lifecycleBump as VersionBump,
  }
}

function getRequiredRow<T>(row: T | undefined, message: string, context: Record<string, unknown>): T {
  if (!row) {
    throw new ValidationError(message, 'VALIDATION_NOT_FOUND', context)
  }
  return row
}

function getDb(projectRoot: string): Database.Database {
  try {
    return getDatabase(projectRoot)
  } catch (error) {
    throw new DatabaseError('Failed to open database', 'DB_CONNECTION_FAILED', { projectRoot }, error as Error)
  }
}

export interface ApproveProposalOptions {
  push?: boolean
}

export async function approveProposal(hashInput: string, options: ApproveProposalOptions = {}): Promise<{
  projectRoot: string
  proposalHash: string
  gateId: string
  title: string
  previousVersion: string
  newVersion: string
}> {
  const projectRoot = requireProjectRoot()
  await initializeDatabase(projectRoot)
  const db = getDb(projectRoot)

  const proposalHash = normalizeHash(hashInput)

  const proposal = getRequiredRow(
    db
      .prepare(
        `SELECT id, gate_id as gateId, title, status
         FROM proposals
         WHERE hash = ?`
      )
      .get(proposalHash) as { id: string; gateId: string; title: string; status: string } | undefined,
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
           implemented_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(proposalId)
  })
  tx(proposal.id)

  const config = await loadConfig(projectRoot)
  const previousVersion = config.version
  const versioning = getVersioningSettings(config)
  const newVersion = versioning.enabled ? bumpSemver(previousVersion, versioning.proposalBump) : previousVersion
  if (newVersion !== previousVersion) {
    await saveConfig({ ...config, version: newVersion }, projectRoot)
  }

  const git = getGitSettings(config)
  if (git.autoCommit) {
    const tagName = git.autoTag ? `v${newVersion}-proposal-${proposalHash}` : undefined
    const tagMessage = git.autoTag
      ? `Proposal #${proposalHash}: ${proposal.title} (gate ${proposal.gateId})`
      : undefined

    await syncWithGit({
      commitMessage: `chore(proposal): complete ${proposal.title} #${proposalHash}\n\nGate: ${proposal.gateId}\nVersion: ${newVersion}\n`,
      tagName,
      tagMessage,
      autoPush: options.push ?? git.autoPush,
      remote: git.remote,
      dir: projectRoot,
    })
  }

  return {
    projectRoot,
    proposalHash,
    gateId: proposal.gateId,
    title: proposal.title,
    previousVersion,
    newVersion,
  }
}

export interface CompleteGateOptions {
  push?: boolean
}

export async function completeGate(gateIdInput: string, options: CompleteGateOptions = {}): Promise<{
  projectRoot: string
  gateId: string
  gateName: string
  previousVersion: string
  newVersion: string
  bump: 'minor' | 'major'
}> {
  const projectRoot = requireProjectRoot()
  await initializeDatabase(projectRoot)
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
  })
  tx(gate.id)

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
    const tagMessage = git.autoTag ? `Gate ${gateId}: ${gate.name} (version ${newVersion})` : undefined

    await syncWithGit({
      commitMessage: `chore(gate): complete ${gateId} - ${gate.name}\n\nVersion: ${newVersion}\n`,
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

