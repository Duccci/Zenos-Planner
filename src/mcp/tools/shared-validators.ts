/**
 * Shared validator factories for the entity-action handler layer.
 *
 * Gate and proposal tools share common validation patterns at the action level.
 * Centralising them here prevents drift when validation rules change.
 */
import type { FunctionRegistry } from '../../integration/function-registry.js'
import type { ValidationResult } from '../validators/types.js'
import { validatePreReviewGeneratePhase, type PreReview } from '../validators/pre-review-validator.js'
import { validateMarkdownOnly } from '../validators/scope-validator.js'
import type { ProposalGateSibling } from '../validators/test-first-validator.js'
import { inferRoleFromFilename } from '../validators/test-first-validator.js'
import { createStateTransitionValidator } from './entity-action-handler.js'
import { type GateStatus, GATE_TRANSITIONS, type ProposalStatus, PROPOSAL_TRANSITIONS } from '../../core/transitions.js'

/**
 * Creates the two generate validators shared by both gates and proposals:
 *  1. PreReview enforcement (G5–G8): structured preconditions must be met
 *  2. Markdown-only constraint (G12): generate actions may only produce .md files
 *
 * For proposals, spread this into the larger validators array that appends
 * proposal-specific checks (scope-creep, explicit paths, dependency DAG).
 * For gates, assign directly — no additional generate validators are needed.
 *
 * @param toolName - MCP tool name used in error messages
 */
export function createGenerateValidators(
  toolName: 'gates_action' | 'proposal_action'
): (payload: Record<string, unknown> | undefined, _r: FunctionRegistry) => (() => Promise<ValidationResult>)[] {
  return (payload, _r) => [
    // eslint-disable-next-line @typescript-eslint/require-await
    async () =>
      validatePreReviewGeneratePhase(
        (payload as { preReview?: PreReview }).preReview,
        toolName,
        (payload as { gateId?: string }).gateId
      ),
    // eslint-disable-next-line @typescript-eslint/require-await
    async () => {
      const filesAffected = (payload as { filesAffected?: string[] }).filesAffected ?? []
      return validateMarkdownOnly(filesAffected)
    },
  ]
}

/**
 * Resolves all sibling proposals for a gate, loading their Role metadata from disk.
 *
 * Used by gate-level test-first validators in both gate-tools and proposal-tools
 * to avoid duplicating the list → map → readFile → roleMatch pattern.
 *
 * Returns an empty array when:
 *  - the proposal list call fails
 *  - the gate has no proposals yet
 *
 * Individual file-read errors are swallowed so that missing files don't block
 * validation entirely (the validator treats missing roles as unset).
 */
/**
 * Creates a state-transition validator for a gate action.
 *
 * Reduces the 13-line `createStateTransitionValidator<GateStatus>({ getCurrentStatus, ... })`
 * boilerplate that was repeated for every gate validator (start, complete) down to a
 * single call that only specifies what varies: target state and valid source states.
 */
export function createGateTransitionValidator(
  payload: Record<string, unknown> | undefined,
  r: FunctionRegistry,
  targetStatus: GateStatus,
  validFromStatuses: GateStatus[]
): () => Promise<ValidationResult> {
  const gateId = (payload as { gateId?: string } | undefined)?.gateId ?? ''
  return createStateTransitionValidator<GateStatus>({
    getCurrentStatus: async () => {
      const result = await r.invoke('gates_show', { gateId })
      if (!result.success) return null
      return ((result.data as { status?: string }).status as GateStatus | undefined) ?? null
    },
    targetStatus,
    validFromStatuses,
    allTransitions: GATE_TRANSITIONS,
    entityLabel: `gate:${gateId || '<unknown>'}`,
  })
}

/**
 * Creates a state-transition validator for a proposal action.
 *
 * Same reduction as `createGateTransitionValidator` but for the proposal entity:
 * proposal_show, PROPOSAL_TRANSITIONS, and `proposal:` entity label prefix.
 */
export function createProposalTransitionValidator(
  payload: Record<string, unknown> | undefined,
  r: FunctionRegistry,
  targetStatus: ProposalStatus,
  validFromStatuses: ProposalStatus[]
): () => Promise<ValidationResult> {
  const hash = (payload as { hash?: string } | undefined)?.hash ?? ''
  return createStateTransitionValidator<ProposalStatus>({
    getCurrentStatus: async () => {
      const result = await r.invoke('proposal_show', { hash })
      if (!result.success) return null
      return ((result.data as { status?: string }).status as ProposalStatus | undefined) ?? null
    },
    targetStatus,
    validFromStatuses,
    allTransitions: PROPOSAL_TRANSITIONS,
    entityLabel: `proposal:${hash || '<unknown>'}`,
  })
}

export async function resolveGateTestFirstSiblings(
  r: FunctionRegistry,
  gateId: string
): Promise<ProposalGateSibling[]> {
  const listResult = await r.invoke('proposal_list', { gateId })
  if (!listResult.success) return []

  const rows = ((listResult.data as { proposals?: unknown[] }).proposals ?? []) as {
    hash: string
    lastUpdated?: string
  }[]
  if (rows.length === 0) return []

  const { findProposalByHash } = await import('../../utils/artifact-locator.js')
  const { readFile } = await import('../../utils/file.js')

  return Promise.all(
    rows.map(async (p) => {
      let role: string | undefined
      let resolvedPath: string | undefined
      let filesAffected: string[] | undefined
      try {
        const filePath = await findProposalByHash(p.hash)
        if (filePath) {
          resolvedPath = filePath
          const content = await readFile(filePath)
          const roleMatch = /\*\*Roles\*\*:\s*(.+)/.exec(content)
          const rawRole = roleMatch?.[1]?.trim()
          // Treat unreplaced template placeholders (e.g. '{{ROLES}}') as unset
          role = rawRole && !rawRole.startsWith('{{') ? rawRole : undefined
          // Fall back to filename convention when explicit role is absent
          role ??= inferRoleFromFilename(filePath)
          // Parse Files Affected section for cross-proposal reuse validation
          const sectionMatch = /## Files Affected[^\n]*\n([\s\S]*?)(?=\n## |$)/i.exec(content)
          if (sectionMatch?.[1]) {
            const backtickPaths = sectionMatch[1].match(/`([^`]+\.[a-z]{1,10})`/gi) ?? []
            filesAffected = [...new Set(backtickPaths.map((m) => m.slice(1, -1)))]
          }
        }
      } catch {
        // role stays undefined — validator treats as unset
      }
      return {
        hash: p.hash,
        role,
        createdAt: p.lastUpdated ?? new Date().toISOString(),
        filePath: resolvedPath,
        filesAffected,
      }
    })
  )
}
