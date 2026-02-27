/**
 * Proposal Command Category
 *
 * Commands for managing implementation proposals
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { getDatabase } from '../../storage/database.js'
import { findProjectRoot, loadConfig } from '../../utils/config.js'
import { normalizeHash } from '../../utils/normalize.js'
import { readFile } from '../../utils/file.js'
import { readdir } from 'node:fs/promises'
import path from 'path'
import { syncProposalsFromDisk } from '../../storage/proposal-sync.js'
import { invokeProposalAction } from '../cli-tool-invoker.js'

interface ProposalRecord {
  id: string
  gate_id: string | null
  title: string
  status: string
  hash: string
  created_at: string
  approved_at?: string
  requirement_id?: string
}

// Shape returned by the MCP registry (camelCase)
interface ProposalSummaryResult {
  hash: string
  gateId: string | null
  title: string
  status: string
  created: string
  updated: string | null
  completedAt: string | null
}

interface ProposalDetailResult {
  hash: string
  gateId: string | null
  title: string
  status: string
  created: string
  updated: string | null
  completedAt: string | null
  summary?: string
  context?: string
  tasks?: unknown[]
  dependencies?: string[]
  files?: string[]
}

/**
 * Read proposal file content
 */
async function readProposalFile(
  projectRoot: string,
  proposal: { gate_id?: string | null; gateId?: string | null; hash: string }
): Promise<string | null> {
  try {
    const gateFolder = (proposal.gate_id ?? proposal.gateId) ?? 'solitary'
    const gateDir = path.join(projectRoot, 'zeno', 'proposals', gateFolder)
    const files = await readdir(gateDir)

    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(gateDir, file)
        const content = await readFile(filePath)
        if (content.includes(`#${proposal.hash}`) || content.includes(`**Hash**: ${proposal.hash}`)) {
          return content
        }
      }
    }
  } catch (error) {
    logger.debug(`Could not read proposal file: ${String(error)}`)
  }

  return null
}

/**
 * Register proposal commands
 */
export function registerProposalCommands(program: Command): void {
  const proposalCmd = program
    .command('proposal')
    .description('Manage implementation proposals')
    .alias('prop')
    .alias('proposals')

  proposalCmd
    .command('list')
    .description('List proposals')
    .option('--gate <gate-id>', 'Filter by gate')
    .option('--status <status>', 'Filter by status (pending/in_progress/completed/rejected/cancelled/backlog)')
    .action(async (options: { gate?: string; status?: string }) => {
      const result = await invokeProposalAction<{ proposals: ProposalSummaryResult[] }>('list', {
        ...(options.gate && { gateId: options.gate }),
        ...(options.status && { status: options.status }),
      })

      if (!result.success) {
        logger.error(`Failed to list proposals: ${result.error ?? 'Unknown error'}`)
        return
      }

      const proposals = result.data?.proposals ?? []

      if (proposals.length === 0) {
        logger.info('No proposals found')
        return
      }

      logger.info(`\nProposals (${String(proposals.length)}):\n`)
      for (const proposal of proposals) {
        const badge =
          proposal.status === 'completed'
            ? 'COMPLETED'
            : proposal.status === 'rejected'
              ? 'REJECTED'
              : proposal.status === 'cancelled'
                ? 'CANCELLED'
                : proposal.status === 'backlog'
                  ? 'BACKLOG'
                  : 'PENDING'
        logger.info(`${badge} #${proposal.hash.slice(0, 8)} [${proposal.status}] ${proposal.title}`)
        logger.info(`  Gate: ${proposal.gateId ?? 'solitary'}, Created: ${proposal.created}`)
      }
    })

  proposalCmd
    .command('show <hash>')
    .description('Show proposal details')
    .action(async (hash: string) => {
      const result = await invokeProposalAction<ProposalDetailResult>('show', { hash })

      if (!result.success || !result.data) {
        logger.error(`Proposal not found: ${hash}`)
        return
      }

      const proposal = result.data

      logger.info(`\n# Proposal: ${proposal.title}`)
      logger.info(`**Hash**: #${proposal.hash}`)
      logger.info(`**Gate**: ${proposal.gateId ?? 'solitary'}`)
      logger.info(`**Status**: ${proposal.status}`)
      logger.info(`**Created**: ${proposal.created}`)
      if (proposal.completedAt) {
        logger.info(`**Completed**: ${proposal.completedAt}`)
      }

      const projectRoot = findProjectRoot(process.cwd())
      if (projectRoot) {
        const content = await readProposalFile(projectRoot, { gateId: proposal.gateId, hash: proposal.hash })
        if (content) {
          logger.info('\n--- Content ---')
          logger.info(content)
        }
      }
    })

  // Create a new proposal
  proposalCmd
    .command('create <title>')
    .description('Create a new proposal markdown file and register it')
    .option('--gate <gate-id>', 'Attach proposal to a specific gate (optional)')
    .option('--requirement <requirement-id>', 'Attach proposal to a requirement (optional)')
    .action(async (title: string, options: { gate?: string; requirement?: string } = {}) => {
      const projectRoot = findProjectRoot(process.cwd())
      if (!projectRoot) {
        logger.error('Not a Zeno project')
        return
      }

      const { readFile: readTemplate, writeFile } = await import('../../utils/file.js')
      const { createHash } = await import('node:crypto')

      // Generate hash: SHA-256, first 16 hex chars
      const hash = createHash('sha256')
        .update(`${title}-${String(Date.now())}`)
        .digest('hex')
        .slice(0, 16)

      // Destination folder: zeno/proposals/<gate-id|solitary>
      const gateId = options.gate
      const dir = gateId
        ? path.join(projectRoot, 'zeno', 'proposals', gateId)
        : path.join(projectRoot, 'zeno', 'proposals', 'solitary')

      // Slug for file name
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 40)
      const date = new Date().toISOString().slice(0, 10)
      const fileName = `${date}-${slug}.md`
      const filePath = path.join(dir, fileName)

      // Load template and replace placeholders
      const templatePath = path.join(
        projectRoot,
        'templates',
        'md-templates',
        'proposal-template.md'
      )
      let content = await readTemplate(templatePath)
      content = content.replace('[Proposal Title]', title)
      content = content.replace('[Generated SHA-256 first 16 chars]', hash)
      content = content.replace('[Gate ID]', gateId ?? 'solitary')
      content = content.replace('[Gate Name]', gateId ?? 'Solitary Proposal')
      content = content.replace('[DATE]', new Date().toISOString())

      // Write file and register in DB
      try {
        await writeFile(filePath, content)
      } catch (error) {
        logger.error(`Failed to write proposal file: ${String(error)}`)
        return
      }

      // Sync file into DB (upsert — preserves any existing lifecycle metadata)
      const db = getDatabase(projectRoot)
      try {
        syncProposalsFromDisk(db, projectRoot)
        logger.info(`Proposal created: #${hash} -> ${filePath}`)

        // Post-generation format validation (fast)
        try {
          const { ArtifactValidationService } = await import(
            '../../analysis/artifact-validation-service.js'
          )
          const svc = new ArtifactValidationService()
          const validation = await svc.validate({
            artifactPath: filePath,
            artifactType: 'proposal',
            validationMode: 'format',
          })
          if (!validation.passed) {
            logger.warn('Post-generation format validation found issues:')
            for (const e of validation.errors ?? []) logger.warn(` - ${e}`)
            logger.info(
              'Please address these issues before approval. Run `zeno proposal validate <hash>` for detailed checks.'
            )
          } else {
            logger.info('Post-generation format validation passed.')
          }
        } catch (err) {
          logger.debug(`Artifact validation failed to run: ${String(err)}`)
        }
      } catch (error) {
        logger.error(`Failed to sync proposal to database: ${String(error)}`)
        return
      }
    })

  proposalCmd
    .command('start <hash>')
    .description('Start implementation (status: pending -> in_progress)')
    .action(async (hash: string) => {
      const result = await invokeProposalAction('start', { hash })

      if (!result.success) {
        logger.error(`Failed to show proposal: ${result.error ?? 'Unknown error'}`)
        return
      }

      logger.info(`Proposal started: #${normalizeHash(hash)}`)
    })

  proposalCmd
    .command('validate <hash>')
    .description('Run automated checks on proposal')
    .option('--strict', 'Treat warnings as errors and fail validation')
    .action(async (hash: string, options: { strict?: boolean } = {}) => {
      const projectRoot = findProjectRoot(process.cwd())
      if (!projectRoot) {
        logger.error('Not a Zeno project')
        return
      }

      const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash
      const db = getDatabase(projectRoot)
      const proposal = db
        .prepare('SELECT * FROM proposals WHERE hash = ?')
        .get(normalizedHash) as ProposalRecord | undefined

      if (!proposal) {
        logger.error(`Proposal not found: #${normalizedHash}`)
        return
      }

      const warnings: string[] = []

      const content = await readProposalFile(projectRoot, proposal)

      if (!content) {
        warnings.push('Proposal file not found: could not locate file in proposals directory')
      } else {
        if (!content.includes('## Completion Summary')) {
          warnings.push('Missing ## Completion Summary section in proposal file')
        } else {
          const tasksClaimedMatch = /\*\*Tasks Completed\*\*:\s*(\d+)\/(\d+)/.exec(content)
          if (tasksClaimedMatch) {
            const claimed = parseInt(tasksClaimedMatch[1] ?? '0', 10)
            const total = parseInt(tasksClaimedMatch[2] ?? '0', 10)
            const actualChecked = (content.match(/- \[x\]/gi) ?? []).length
            if (actualChecked !== claimed || claimed !== total) {
              warnings.push(
                `Tasks Completed: ${String(claimed)}/${String(total)} claimed but ${String(actualChecked)} checked tasks found`
              )
            }
          }
        }
      }

      if (warnings.length > 0) {
        for (const w of warnings) {
          logger.warn(w)
        }
        if (options.strict) {
          logger.error('Validation failed: warnings treated as errors in strict mode')
          throw new Error('Validation failed')
        }
        logger.info('Checks passed with warnings. Address warnings before approval.')
      } else {
        logger.info('All checks passed!')
      }
    })

  proposalCmd
    .command('approve <hash>')
    .description(
      'Approve proposal (status: in_progress -> completed). Git commits occur at gate completion.'
    )
    .action(async (hash: string) => {
      const projectRoot = findProjectRoot(process.cwd())
      if (!projectRoot) {
        logger.error('Not a Zeno project')
        process.exit(1)
        return
      }

      const config = await loadConfig(projectRoot)
      const workflowMode = config.workflowMode

      if (workflowMode === 'solo') {
        const qt = config.qualityThresholds
        const failures: string[] = []

        if (qt.codeCoverage < 90) {
          failures.push(`Code coverage ${String(qt.codeCoverage)}% is below 90% threshold`)
        }
        if (qt.securityVulnerabilities > 0) {
          failures.push(`${String(qt.securityVulnerabilities)} security vulnerabilities found`)
        }
        if (qt.lintingErrorRate > 0.01) {
          failures.push(`Linting error rate ${String(qt.lintingErrorRate)} exceeds 0.01 threshold`)
        }
        if (qt.typeCheckingErrors > 0) {
          failures.push(`${String(qt.typeCheckingErrors)} TypeScript type errors found`)
        }

        if (failures.length > 0) {
          if (failures.length === 1) {
            logger.error(failures[0] ?? 'Quality gate failed')
          } else {
            logger.error('Auto-approval blocked: quality gate failures')
            for (const f of failures) logger.error(f)
          }
          process.exit(1)
          return
        }
      }

      const { approveProposal } = await import('../../core/completions.js')

      try {
        if (workflowMode === 'solo') {
          await approveProposal(hash, { approver: 'solo-auto' })
          logger.info(`auto-approved (solo mode)`)
        } else {
          await approveProposal(hash)
        }
        logger.info(`Proposal completed: #${normalizeHash(hash)}`)
        logger.info('Note: Git commit will occur when gate is completed (requires human approval)')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('already completed')) {
          logger.info(`Proposal #${normalizeHash(hash)} is already completed (no-op)`)
        } else {
          throw err
        }
      }
    })

  proposalCmd
    .command('reject <hash>')
    .description('Reject proposal (status: -> rejected)')
    .action((hash: string) => {
      const projectRoot = findProjectRoot(process.cwd())
      if (!projectRoot) {
        logger.error('Not a Zeno project')
        return
      }

      const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash
      const db = getDatabase(projectRoot)
      const proposal = db
        .prepare('SELECT * FROM proposals WHERE hash = ?')
        .get(normalizedHash) as { id: string; status: string } | undefined

      if (!proposal) {
        logger.error(`Proposal not found: #${normalizedHash}`)
        return
      }

      if (proposal.status === 'completed') {
        logger.error('Cannot reject a completed proposal')
        return
      }

      db.prepare('UPDATE proposals SET status = ? WHERE hash = ?').run('rejected', normalizedHash)

      logger.info(`Proposal rejected: #${normalizeHash(hash)}`)
    })
}
