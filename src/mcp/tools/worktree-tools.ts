/**
 * Worktree Tool Definitions and Handlers
 *
 * MCP tools for managing isolated git worktrees per proposal.
 */

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { WorktreeManager } from '../../core/worktree-manager.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { getDatabase } from '../../storage/database.js'
import { getWorkspaceRoot } from '../../utils/config.js'
import {
  WorktreeListInputSchema,
  WorktreePruneInputSchema,
  WorktreeRemoveInputSchema,
  WorktreeMergeInputSchema,
} from '../schemas/worktree-schemas.js'
import { normalizeHash } from '../../utils/normalize.js'

export const worktreeToolDefinitions = [
  {
    name: 'worktree_action',
    description:
      'Manage isolated git worktrees for proposals. All params are flat — do NOT nest inside a payload object. ' +
      'CRITICAL: All worktree lifecycle operations (list, merge, remove, prune) MUST use this MCP tool or proposal_action. ' +
      'Never run git worktree commands, the zeno worktree CLI, or manually delete .local/worktrees/* directories — ' +
      'these bypass registry tracking, branch metadata, and cleanup safeguards. ' +
      'Editing files inside an active worktree directory is safe; managing worktree lifecycle outside MCP is not. ' +
      'Actions: ' +
      'list=show active/orphaned worktrees (optional: status="active"|"orphaned"|"all", default "active"). ' +
      'remove=explicitly delete a worktree by hash (needs: hash; optional: force=true to discard uncommitted changes). Use when a proposal was rejected or abandoned. ' +
      'prune=batch-remove all orphaned worktrees that have no matching proposal in the DB (optional: dryRun=true to preview). ' +
      'merge=merge a proposal branch into main (needs: hash; optional: strategy="rebase"|"squash"|"merge" default "rebase", dryRun=true). ' +
      'COLLAPSE WORKFLOW: use strategy="squash" to collapse all worktree commits into a single commit before merging — useful when the branch contains many WIP or fixup commits. Always run with dryRun=true first to preview the result. ' +
      'MERGE WORKFLOW: proposal_action:approve is the preferred merge path (merges + removes worktree automatically). Call worktree_action:merge directly ONLY when approve returns MERGE_CONFLICT errors, or when a specific strategy (squash, merge) is required. ' +
      'On success, merge also removes the worktree. On conflict, the worktree is preserved for manual resolution and conflicts are listed in the response. ' +
      'merge refuses if the worktree has uncommitted changes; commit or stash them first.',
    inputSchema: z.object({
      action: z.enum(['list', 'remove', 'prune', 'merge']),
      // list
      status: z.enum(['active', 'orphaned', 'all']).optional().describe('Filter for list action (default: active)'),
      // remove / merge
      hash: z.string().optional().describe('Proposal hash (required for remove and merge). Leading # is stripped automatically.'),
      force: z.boolean().optional().describe('Force removal even with uncommitted changes (remove action only)'),
      // prune / merge dry-run
      dryRun: z.boolean().optional().describe('Preview what would happen without making changes (prune and merge actions)'),
      // merge
      strategy: z.enum(['rebase', 'squash', 'merge']).optional().describe('Git merge strategy (merge action, default: rebase)'),
      autoResolveConflicts: z.boolean().optional().describe('Attempt auto-resolution of simple conflicts (merge action)'),
    }),
  },
]

export function worktreeHandlers(
  _registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  return {
    worktree_action: async (args) => {
      const action = args['action'] as string
      // Flat params — read directly from args, with legacy payload fallback for back-compat
      const legacyPayload = (args['payload'] ?? {}) as Record<string, unknown>
      const flatArgs = { ...legacyPayload, ...args }
      // Normalize hash fields: strip leading '#' so tools work with or without it
      if (typeof flatArgs['hash'] === 'string') {
        flatArgs['hash'] = normalizeHash(flatArgs['hash'])
      }

      try {
        const manager = new WorktreeManager()

        if (action === 'list') {
          WorktreeListInputSchema.parse(flatArgs)
          const list = await manager.list()
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    worktrees: list.map((w) => ({
                      hash: w.proposalHash,
                      path: w.path,
                      branch: w.branch,
                      status: 'active' as const,
                      created: w.createdAt.toISOString(),
                      lastAccessed: w.createdAt.toISOString(),
                      commitCount: 0,
                      filesModified: 0,
                    })),
                    summary: {
                      total: list.length,
                      active: list.length,
                      orphaned: 0,
                      diskUsageMB: 0,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          }
        }

        if (action === 'remove') {
          const input = WorktreeRemoveInputSchema.parse(flatArgs)
          await manager.remove(input.hash, input.force)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    hash: input.hash,
                    path: `.local/worktrees/${input.hash}`,
                    message: `Worktree for proposal ${input.hash} removed.`,
                  },
                  null,
                  2
                ),
              },
            ],
          }
        }

        if (action === 'prune') {
          const input = WorktreePruneInputSchema.parse(flatArgs)
          const before = await manager.list()

          let knownHashes: Set<string>
          try {
            const db = getDatabase(getWorkspaceRoot())
            const rows = db.prepare('SELECT hash FROM proposals').all() as { hash: string }[]
            knownHashes = new Set(rows.map((r) => r.hash))
          } catch {
            knownHashes = new Set()
          }

          const wouldPrune = before.filter(
            (w) => !knownHashes.has(w.proposalHash)
          )

          if (!input.dryRun) {
            await manager.prune(knownHashes)
          }

          const after = input.dryRun ? before : await manager.list()
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    pruned: input.dryRun
                      ? []
                      : wouldPrune.map((w) => ({
                          hash: w.proposalHash,
                          path: w.path,
                          reason: 'orphaned' as const,
                          deletedAt: new Date().toISOString(),
                        })),
                    summary: {
                      prunedCount: input.dryRun ? 0 : wouldPrune.length,
                      diskFreedMB: 0,
                      worktreesRemaining: after.length,
                    },
                    message: input.dryRun
                      ? `Dry run: would prune ${String(wouldPrune.length)} worktree(s).`
                      : `Pruned ${String(wouldPrune.length)} worktree(s). ${String(after.length)} remaining.`,
                  },
                  null,
                  2
                ),
              },
            ],
          }
        }

        if (action === 'merge') {
          const input = WorktreeMergeInputSchema.parse(flatArgs)
          const strategy = input.strategy
          const result = await manager.merge(
            input.hash,
            'main',
            strategy,
            input.dryRun
          )

          const hasConflicts = (result.conflicts ?? []).length > 0
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: !hasConflicts,
                    hash: input.hash,
                    branch: `proposal/${input.hash}`,
                    strategy,
                    mergedAt: hasConflicts ? undefined : new Date().toISOString(),
                    conflicts: result.conflicts ?? [],
                    message: hasConflicts
                      ? `Merge failed with conflicts in: ${result.conflicts?.join(', ') ?? ''}`
                      : input.dryRun
                        ? `Dry run: would merge proposal/${input.hash} into main using ${strategy}.`
                        : `Worktree for proposal ${input.hash} merged into main using ${strategy}.`,
                  },
                  null,
                  2
                ),
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown worktree action: ${action}` }, null, 2),
            },
          ],
          isError: true,
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { error: error instanceof Error ? error.message : String(error) },
                null,
                2
              ),
            },
          ],
          isError: true,
        }
      }
    },
  }
}
