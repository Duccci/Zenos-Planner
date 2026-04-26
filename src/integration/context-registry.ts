/**
 * Context Operations Registry
 *
 * Registers context_gate, context_proposal, context_requirement, and
 * context_repository operations with the function registry. These provide
 * compact working context by querying the registry DB, replacing both the need
 * to load full PRD / architecture documents during execution and the old
 * show_entity tool. Resolves entities by hash or by name/id.
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { logger } from '../utils/logger.js'
import { getDatabase } from '../storage/database.js'
import { normalizeHash, resolveGateIdentifier } from '../utils/normalize.js'
import { getZenoGitDir, getWorkspaceRoot } from '../utils/config.js'
import { relative } from 'node:path'

// ── DB row types ─────────────────────────────────────────────────────────────

interface GateRow {
  id: string
  name: string
  status: string
  description: string | null
  sequence: number
  depends_on: string | null
}

interface ProposalRow {
  id: string
  title: string
  status: string
  hash: string
  gate_id: string | null
  created_at: string
  started_at: string | null
}

interface RequirementRow {
  id: string
  description: string
  type: string
  priority: string
  hash: string
}

interface DependencyRow {
  target_proposal_hash: string
  dependency_type: string
  description: string | null
}

interface RepositoryRow {
  id: string
  name: string
  path: string
  type: string
  hash: string
  metadata: string | null
  created_at: string
}

interface RequirementDetailRow {
  id: string
  description: string
  type: string
  priority: string
  level: string
  hash: string
  gate_id: string | null
  acceptance_criteria: string | null
  created_at: string
}

// ── Input schemas ────────────────────────────────────────────────────────────

const ContextGateInputSchema = z.object({
  gateId: z.string().min(1).optional(),
  hash: z.string().min(1).optional(),
  operationMode: z.enum(['planning', 'execution']).optional(),
}).superRefine((data, ctx) => {
  if (!data.gateId && !data.hash) {
    ctx.addIssue({ code: 'custom', path: ['gateId'], message: 'gate action requires gateId or hash' })
  }
})

const ContextProposalInputSchema = z.object({
  hash: z.string().min(1),
  operationMode: z.enum(['planning', 'execution']).optional(),
})

const ContextRequirementInputSchema = z.object({
  hash: z.string().min(1),
})

const ContextRepositoryInputSchema = z.object({
  hash: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
}).superRefine((data, ctx) => {
  if (!data.hash && !data.name) {
    ctx.addIssue({ code: 'custom', path: ['hash'], message: 'repository action requires hash or name' })
  }
})

// ── Registration ─────────────────────────────────────────────────────────────

export function registerContextOps(registry: FunctionRegistry): void {
  /**
   * context_gate: compact working context for a gate
   */
  registry.register(
    'context_gate',
    (params: Record<string, unknown>) => {
      const { gateId, hash, operationMode } = ContextGateInputSchema.parse(params)

      try {
        const db = getDatabase()

        // Resolve gate by gateId or hash
        let gate: GateRow | undefined
        let resolvedGateId: string | undefined
        if (gateId) {
          resolvedGateId = resolveGateIdentifier(gateId)
          gate = db
            .prepare('SELECT id, name, status, description, sequence, depends_on FROM gates WHERE id = ?')
            .get(resolvedGateId) as GateRow | undefined
        } else if (hash) {
          gate = db
            .prepare('SELECT id, name, status, description, sequence, depends_on FROM gates WHERE hash = ?')
            .get(normalizeHash(hash)) as GateRow | undefined
          resolvedGateId = gate?.id
        }

        if (!gate) {
          throw new Error(`Gate not found: ${(gateId ?? hash) ?? 'unknown'}`)
        }

        // Proposals for this gate
        const proposals = (
          db
            .prepare(
              'SELECT id, title, status, hash FROM proposals WHERE gate_id = ? ORDER BY created_at'
            )
            .all(resolvedGateId) as { id: string; title: string; status: string; hash: string }[]
        )

        // Requirements for this gate
        const requirements = (
          db
            .prepare(
              'SELECT id, description, type, priority, hash FROM requirements WHERE gate_id = ? ORDER BY priority, type'
            )
            .all(resolvedGateId) as RequirementRow[]
        )

        // Parse depends_on (stored as JSON array or comma-separated)
        let dependsOn: string[] = []
        if (gate.depends_on) {
          try {
            dependsOn = JSON.parse(gate.depends_on) as string[]
          } catch {
            dependsOn = gate.depends_on.split(',').map((s) => s.trim()).filter(Boolean)
          }
        }

        return {
          gate: {
            id: gate.id,
            name: gate.name,
            status: gate.status,
            description: gate.description,
            sequence: gate.sequence,
            dependsOn,
          },
          proposals,
          requirements,
          ...(operationMode === 'planning' && (() => {
            const root = getWorkspaceRoot()
            const zenoGitDir = relative(root, getZenoGitDir(root)).replace(/\\/g, '/')
            return {
              _planningContext: {
                prdPath: `${zenoGitDir}/overview/PROJECT_PRD.md`,
                structurePath: `${zenoGitDir}/overview/STRUCTURE.md`,
              },
            }
          })()),
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`context_gate failed: ${message}`)
        throw error
      }
    },
    {
      description: 'Get compact working context for a gate (objectives, proposals, requirements)',
      parameters: [
        { name: 'gateId', type: 'string', description: 'Gate ID', required: true },
      ],
      returnType: 'GateContextOutput',
      schema: ContextGateInputSchema,
    }
  )

  /**
   * context_proposal: compact working context for a proposal
   */
  registry.register(
    'context_proposal',
    (params: Record<string, unknown>) => {
      const { hash, operationMode } = ContextProposalInputSchema.parse(params)

      try {
        const db = getDatabase()

        // Proposal metadata
        const normalizedProposalHash = normalizeHash(hash)
        const proposal = db
          .prepare(
            'SELECT id, title, status, hash, gate_id, created_at, started_at FROM proposals WHERE hash = ?'
          )
          .get(normalizedProposalHash) as ProposalRow | undefined

        if (!proposal) {
          throw new Error(`Proposal not found: ${normalizedProposalHash}`)
        }

        // Parent gate context (if gate-tied)
        let gate: { id: string; name: string; status: string } | null = null
        if (proposal.gate_id) {
          const gateRow = db
            .prepare('SELECT id, name, status FROM gates WHERE id = ?')
            .get(proposal.gate_id) as { id: string; name: string; status: string } | undefined
          gate = gateRow ?? null
        }

        // Requirements linked to this proposal's gate
        let requirements: RequirementRow[] = []
        if (proposal.gate_id) {
          requirements = db
            .prepare(
              'SELECT id, description, type, priority, hash FROM requirements WHERE gate_id = ? ORDER BY priority, type'
            )
            .all(proposal.gate_id) as RequirementRow[]
        }

        // Proposal dependencies
        const dependencies = (
          db
            .prepare(
              'SELECT target_hash AS target_proposal_hash, dependency_type, description FROM dependency_map WHERE source_type = \'proposal\' AND source_id = ?'
            )
            .all(proposal.id) as DependencyRow[]
        ).map((d) => ({
          targetHash: d.target_proposal_hash,
          type: d.dependency_type,
          description: d.description,
        }))

        return {
          proposal: {
            id: proposal.id,
            title: proposal.title,
            status: proposal.status,
            hash: proposal.hash,
            gateId: proposal.gate_id,
            createdAt: proposal.created_at,
            startedAt: proposal.started_at,
          },
          gate,
          requirements,
          dependencies,
          ...(operationMode === 'planning' && (() => {
            const root = getWorkspaceRoot()
            const zenoGitDir = relative(root, getZenoGitDir(root)).replace(/\\/g, '/')
            return {
              _planningContext: {
                prdPath: `${zenoGitDir}/overview/PROJECT_PRD.md`,
                structurePath: `${zenoGitDir}/overview/STRUCTURE.md`,
              },
            }
          })()),
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`context_proposal failed: ${message}`)
        throw error
      }
    },
    {
      description: 'Get compact working context for a proposal (tasks, gate, requirements, dependencies)',
      parameters: [
        { name: 'hash', type: 'string', description: 'Proposal hash', required: true },
      ],
      returnType: 'ProposalContextOutput',
      schema: ContextProposalInputSchema,
    }
  )

  /**
   * context_requirement: full details for a requirement by hash
   */
  registry.register(
    'context_requirement',
    (params: Record<string, unknown>) => {
      const { hash } = ContextRequirementInputSchema.parse(params)

      try {
        const db = getDatabase()

        const normalizedReqHash = normalizeHash(hash)
        const req = db
          .prepare(
            'SELECT id, description, type, priority, level, hash, gate_id, acceptance_criteria, created_at FROM requirements WHERE hash = ?'
          )
          .get(normalizedReqHash) as RequirementDetailRow | undefined

        if (!req) {
          throw new Error(`Requirement not found: ${normalizedReqHash}`)
        }

        return {
          id: req.id,
          description: req.description,
          type: req.type,
          priority: req.priority,
          level: req.level,
          hash: req.hash,
          gateId: req.gate_id,
          acceptanceCriteria: req.acceptance_criteria,
          createdAt: req.created_at,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`context_requirement failed: ${message}`)
        throw error
      }
    },
    {
      description: 'Resolve a requirement hash to its full details',
      parameters: [
        { name: 'hash', type: 'string', description: 'Requirement hash', required: true },
      ],
      returnType: 'RequirementContextOutput',
      schema: ContextRequirementInputSchema,
    }
  )

  /**
   * context_repository: full details for a repository by hash or name
   */
  registry.register(
    'context_repository',
    (params: Record<string, unknown>) => {
      const { hash, name } = ContextRepositoryInputSchema.parse(params)

      try {
        const db = getDatabase()

        let repo: RepositoryRow | undefined
        if (hash) {
          repo = db
            .prepare(
              'SELECT id, name, path, type, hash, metadata, created_at FROM repositories WHERE hash = ?'
            )
            .get(normalizeHash(hash)) as RepositoryRow | undefined
        } else if (name) {
          repo = db
            .prepare(
              'SELECT id, name, path, type, hash, metadata, created_at FROM repositories WHERE name = ?'
            )
            .get(name) as RepositoryRow | undefined
        }

        if (!repo) {
          throw new Error(`Repository not found: ${(hash ?? name) ?? 'unknown'}`)
        }

        let metadata: Record<string, unknown> | null = null
        if (repo.metadata) {
          try {
            metadata = JSON.parse(repo.metadata) as Record<string, unknown>
          } catch {
            metadata = null
          }
        }

        return {
          id: repo.id,
          name: repo.name,
          path: repo.path,
          type: repo.type,
          hash: repo.hash,
          metadata,
          createdAt: repo.created_at,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`context_repository failed: ${message}`)
        throw error
      }
    },
    {
      description: 'Resolve a repository hash or name to its full details',
      parameters: [
        { name: 'hash', type: 'string', description: 'Repository hash', required: false },
        { name: 'name', type: 'string', description: 'Repository name', required: false },
      ],
      returnType: 'RepositoryContextOutput',
      schema: ContextRepositoryInputSchema,
    }
  )
}
