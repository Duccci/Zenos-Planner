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
      'Manage isolated git worktrees for proposals. Actions: list (active/orphaned/all), remove (by hash, optional --force), prune (remove orphaned worktrees with no matching proposal, supports dry-run), merge (proposal branch into main, strategies: rebase|squash|merge, supports dry-run).',
    inputSchema: z.object({
      action: z.enum(['list', 'remove', 'prune', 'merge']),
      payload: z.record(z.string(), z.unknown()).optional().default({}),
    }),
  },
]

export function worktreeHandlers(
  _registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  return {
    worktree_action: async (args) => {
      const action = args['action'] as string
      const rawPayload = (args['payload'] ?? {}) as Record<string, unknown>
      // Normalize hash fields: strip leading '#' so tools work with or without it
      const payload = { ...rawPayload }
      if (typeof payload['hash'] === 'string') {
        payload['hash'] = normalizeHash(payload['hash'])
      }

      try {
        const manager = new WorktreeManager()

        if (action === 'list') {
          WorktreeListInputSchema.parse(payload)
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
          const input = WorktreeRemoveInputSchema.parse(payload)
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
          const input = WorktreePruneInputSchema.parse(payload)
          const before = await manager.list()

          let knownHashes: Set<string>
          try {
            const db = getDatabase(process.cwd())
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
          const input = WorktreeMergeInputSchema.parse(payload)
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
