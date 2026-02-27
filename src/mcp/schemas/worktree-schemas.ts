import { z } from 'zod'
import { ProposalHashSchema, GateIdSchema, TimestampSchema, OptionalTimestampSchema } from './common-schemas.js'

/**
 * Zod schemas for git worktree management operations
 *
 * Enables isolated parallel development of proposals and gates using git worktrees.
 * Each worktree is created in .local/worktrees/{proposal-hash}/ with independent branch state.
 */

// ============================================================================
// WORKTREE_LIST - List active worktrees
// ============================================================================

export const WorktreeListInputSchema = z.object({
  status: z.enum(['active', 'orphaned', 'all']).optional().default('active'),
})
export type WorktreeListInput = z.infer<typeof WorktreeListInputSchema>

export const WorktreeInfoSchema = z.object({
  hash: ProposalHashSchema,
  path: z.string().describe('Worktree path relative to workspace root'),
  branch: z.string().describe('Git branch name for this worktree'),
  status: z.enum(['active', 'pending_merge', 'orphaned']).describe('Worktree lifecycle status'),
  gateId: GateIdSchema.optional(),
  proposalHash: ProposalHashSchema.optional(),
  created: TimestampSchema,
  lastAccessed: TimestampSchema,
  expiresAt: OptionalTimestampSchema.describe('Auto-cleanup timestamp (7 days from creation by default)'),
  commitCount: z.number().int().min(0).describe('Number of commits in this worktree'),
  filesModified: z.number().int().min(0).describe('Number of files with uncommitted changes')
})
export type WorktreeInfo = z.infer<typeof WorktreeInfoSchema>

export const WorktreeListOutputSchema = z.object({
  worktrees: z.array(WorktreeInfoSchema),
  summary: z.object({
    total: z.number().int().min(0),
    active: z.number().int().min(0),
    orphaned: z.number().int().min(0),
    diskUsageMB: z.number().min(0).describe('Total disk usage for all worktrees')
  }),
})
export type WorktreeListOutput = z.infer<typeof WorktreeListOutputSchema>

// ============================================================================
// WORKTREE_PRUNE - Remove expired/orphaned worktrees
// ============================================================================

export const WorktreePruneInputSchema = z.object({
  dryRun: z.boolean().optional().default(false).describe('If true, list what would be deleted without deleting'),
  expireDays: z.number().int().min(1).optional().describe('Override default expiration days (default: 7)'),
  minDiskSpaceGB: z.number().min(0).optional().describe('Force cleanup if disk space below threshold')
})
export type WorktreePruneInput = z.infer<typeof WorktreePruneInputSchema>

export const WorktreePruneOutputSchema = z.object({
  success: z.boolean(),
  pruned: z.array(z.object({
    hash: ProposalHashSchema,
    path: z.string(),
    reason: z.enum(['expired', 'orphaned', 'disk_space_threshold']),
    deletedAt: TimestampSchema
  })),
  summary: z.object({
    prunedCount: z.number().int().min(0),
    diskFreedMB: z.number().min(0),
    worktreetRemaining: z.number().int().min(0)
  }),
  message: z.string()
})
export type WorktreePruneOutput = z.infer<typeof WorktreePruneOutputSchema>

// ============================================================================
// WORKTREE_REMOVE - Manual worktree removal
// ============================================================================

export const WorktreeRemoveInputSchema = z.object({
  hash: ProposalHashSchema,
  force: z.boolean().optional().default(false).describe('Force removal even with uncommitted changes')
})
export type WorktreeRemoveInput = z.infer<typeof WorktreeRemoveInputSchema>

export const WorktreeRemoveOutputSchema = z.object({
  success: z.boolean(),
  hash: ProposalHashSchema,
  path: z.string(),
  message: z.string(),
  warning: z.string().optional().describe('Warnings like "uncommitted changes were discarded"')
})
export type WorktreeRemoveOutput = z.infer<typeof WorktreeRemoveOutputSchema>

// ============================================================================
// WORKTREE_MERGE - Merge worktree branch to main with conflict handling
// ============================================================================

export const WorktreeMergeInputSchema = z.object({
  hash: ProposalHashSchema,
  strategy: z.enum(['rebase', 'squash', 'merge']).optional().default('rebase').describe('Git merge strategy'),
  dryRun: z.boolean().optional().default(false).describe('If true, show what would happen without merging'),
  autoResolveConflicts: z.boolean().optional().default(false).describe('Attempt auto-resolution of simple conflicts')
})
export type WorktreeMergeInput = z.infer<typeof WorktreeMergeInputSchema>

export const MergeConflictSchema = z.object({
  file: z.string(),
  type: z.enum(['content', 'delete_modify', 'add_add']),
  ours: z.string().optional().describe('Our version of conflicting content'),
  theirs: z.string().optional().describe('Their version of conflicting content'),
  resolution: z.enum(['manual', 'auto_ours', 'auto_theirs']).optional()
})
export type MergeConflict = z.infer<typeof MergeConflictSchema>

export const WorktreeMergeOutputSchema = z.object({
  success: z.boolean(),
  hash: ProposalHashSchema,
  branch: z.string(),
  strategy: z.string(),
  mergedAt: OptionalTimestampSchema,
  conflicts: z.array(MergeConflictSchema).describe('Unresolved conflicts requiring manual intervention'),
  stats: z.object({
    filesChanged: z.number().int().min(0),
    insertions: z.number().int().min(0),
    deletions: z.number().int().min(0),
    merge_commits: z.number().int().min(0)
  }).optional(),
  message: z.string(),
  nextSteps: z.array(z.string()).optional().describe('Manual steps needed if conflicts exist')
})
export type WorktreeMergeOutput = z.infer<typeof WorktreeMergeOutputSchema>

// ============================================================================
// AGENT_DELEGATE - Hand-off control to another agent with context preservation
// ============================================================================

export const AgentDelegateInputSchema = z.object({
  targetModel: z.string().describe('Target model/agent for delegation (e.g., "claude-opus" for cloud review)'),
  tag: z.string().optional().describe('Optional delegation tag for tracking (e.g., "code-review")'),
  preserveContext: z.boolean().optional().default(true).describe('Preserve full conversation history in hand-off'),
  transferData: z.record(z.string(), z.any()).optional().describe('Additional data to transfer to delegated agent')
})
export type AgentDelegateInput = z.infer<typeof AgentDelegateInputSchema>

export const AgentDelegateOutputSchema = z.object({
  success: z.boolean(),
  delegatedFrom: z.string().describe('Current agent/session ID'),
  delegatedTo: z.string().describe('Target agent/session ID'),
  tag: z.string().optional(),
  contextPreserved: z.boolean(),
  contextSize: z.number().int().min(0).describe('Size of preserved conversation in tokens'),
  message: z.string(),
  handoffUrl: z.string().optional().describe('URL or reference for agent hand-off')
})
export type AgentDelegateOutput = z.infer<typeof AgentDelegateOutputSchema>

// ============================================================================
// PROPOSAL_START_ENHANCED - Start proposal with worktree creation
// ============================================================================

export const ProposalStartEnhancedOutputSchema = z.object({
  success: z.boolean(),
  hash: ProposalHashSchema,
  previousStatus: z.string(),
  newStatus: z.literal('in_progress'),
  worktree: z.object({
    path: z.string().describe('Worktree path: .local/worktrees/{hash}/'),
    branch: z.string().describe('Git branch for this proposal'),
    created: TimestampSchema,
    expiresAt: OptionalTimestampSchema
  }).optional().describe('Worktree created for isolated development'),
  instructions: z.array(z.string()).describe('Next steps for agent'),
  message: z.string()
})
export type ProposalStartEnhancedOutput = z.infer<typeof ProposalStartEnhancedOutputSchema>

// ============================================================================
// PROPOSAL_APPROVE_ENHANCED - Approve proposal with worktree merge
// ============================================================================

export const ProposalApproveEnhancedOutputSchema = z.object({
  success: z.boolean(),
  hash: ProposalHashSchema,
  previousStatus: z.string(),
  newStatus: z.literal('completed'),
  worktreeMerge: z.object({
    merged: z.boolean(),
    branch: z.string().describe('Branch that was merged to main'),
    conflicts: z.array(MergeConflictSchema).optional().describe('Unresolved merge conflicts if any'),
    stats: z.object({
      filesChanged: z.number().int().min(0),
      insertions: z.number().int().min(0),
      deletions: z.number().int().min(0)
    }).optional()
  }).optional().describe('Details of worktree merge operation'),
  worktreeDeleted: z.boolean().describe('Whether worktree was cleaned up'),
  approvedAt: TimestampSchema,
  nextSteps: z.string().optional(),
  message: z.string()
})
export type ProposalApproveEnhancedOutput = z.infer<typeof ProposalApproveEnhancedOutputSchema>
