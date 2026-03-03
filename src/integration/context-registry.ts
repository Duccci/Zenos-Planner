/**
 * Context Operations Registry
 *
 * Registers context_gate and context_proposal operations with the function
 * registry. These provide compact working context by querying the registry DB,
 * replacing the need to load full PRD / architecture documents during execution.
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { logger } from '../utils/logger.js'
import { getDatabase } from '../storage/database.js'

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

// ── Input schemas ────────────────────────────────────────────────────────────

const ContextGateInputSchema = z.object({
  gateId: z.string().min(1),
  operationMode: z.enum(['planning', 'execution']).optional(),
})

const ContextProposalInputSchema = z.object({
  hash: z.string().min(1),
  operationMode: z.enum(['planning', 'execution']).optional(),
})

// ── Registration ─────────────────────────────────────────────────────────────

export function registerContextOps(registry: FunctionRegistry): void {
  /**
   * context_gate: compact working context for a gate
   */
  registry.register(
    'context_gate',
    (params: Record<string, unknown>) => {
      const { gateId, operationMode } = ContextGateInputSchema.parse(params)

      try {
        const db = getDatabase()

        // Gate metadata
        const gate = db
          .prepare('SELECT id, name, status, description, sequence, depends_on FROM gates WHERE id = ?')
          .get(gateId) as GateRow | undefined

        if (!gate) {
          return {
            error: { code: 'GATE_NOT_FOUND', message: `Gate not found: ${gateId}` },
          }
        }

        // Proposals for this gate
        const proposals = (
          db
            .prepare(
              'SELECT id, title, status, hash FROM proposals WHERE gate_id = ? ORDER BY created_at'
            )
            .all(gateId) as { id: string; title: string; status: string; hash: string }[]
        )

        // Requirements for this gate
        const requirements = (
          db
            .prepare(
              'SELECT id, description, type, priority, hash FROM requirements WHERE gate_id = ? ORDER BY priority, type'
            )
            .all(gateId) as RequirementRow[]
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
          ...(operationMode === 'planning' && {
            _planningContext: {
              prdPath: 'zeno/overview/PROJECT_PRD.md',
              structurePath: 'zeno/overview/STRUCTURE.md',
            },
          }),
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
        const proposal = db
          .prepare(
            'SELECT id, title, status, hash, gate_id, created_at, started_at FROM proposals WHERE hash = ?'
          )
          .get(hash) as ProposalRow | undefined

        if (!proposal) {
          return {
            error: { code: 'PROPOSAL_NOT_FOUND', message: `Proposal not found: ${hash}` },
          }
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
              'SELECT target_proposal_hash, dependency_type, description FROM proposal_dependencies WHERE source_proposal_id = ?'
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
          ...(operationMode === 'planning' && {
            _planningContext: {
              prdPath: 'zeno/overview/PROJECT_PRD.md',
              structurePath: 'zeno/overview/STRUCTURE.md',
            },
          }),
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
}
