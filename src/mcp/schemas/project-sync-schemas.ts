import { z } from 'zod'

// ============================================================================
// CONFIG EXTENSION — sync key in .zeno/config.json
// ============================================================================

export const SyncConfigSchema = z.object({
  coreRepo: z.string().optional().describe('Name of the core submodule (auto-detected if omitted)'),
  consumers: z.array(z.string()).optional().default([]).describe('Explicit consumer list; empty = auto-discover'),
  submodulePath: z.string().optional().describe('Path within each consumer where the submodule lives'),
  postSyncHooks: z.array(z.string()).optional().default([]).describe('Shell commands to run in each consumer after sync'),
  schemaDir: z.string().optional().describe('Directory to watch for schema-change warnings'),
  schemaDriftWarning: z.boolean().optional().default(true).describe('Emit warnings when synced commits touch schemaDir'),
})
export type SyncConfig = z.infer<typeof SyncConfigSchema>

// ============================================================================
// INPUT SCHEMA — flat, action-dispatched
// ============================================================================

export const ProjectSyncActionInputSchema = z.object({
  action: z
    .enum(['status', 'commit', 'propagate', 'full', 'diff'])
    .describe('Action to perform. status: report submodule pin state. commit: commit core changes. propagate: update submodule pointers in consumers. full: commit + propagate. diff: show file-level changes between core HEAD and each consumer\'s pinned submodule commit.'),

  // diff
  detailed: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include full unified diff patch output per consumer. Default: false (summary only). (diff)'),

  // status / propagate
  repos: z
    .array(z.string())
    .optional()
    .describe('Subset of consumer repo names. Default: all discovered consumers. (status, propagate)'),

  // commit
  message: z
    .string()
    .optional()
    .describe('Commit message subject line. (commit, full)'),
  scope: z
    .string()
    .optional()
    .describe('Scope for commitFormat interpolation, e.g. "schemas", "gates". (commit, full)'),
  tag: z
    .string()
    .optional()
    .describe('Optional tag to create after commit. (commit, full)'),

  // propagate
  commitHash: z
    .string()
    .optional()
    .describe('Core commit to pin. Default: core repo HEAD. (propagate, full)'),
  commitMessage: z
    .string()
    .optional()
    .describe('Override propagation commit message. (propagate, full)'),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe('Report changes without writing. Default: false. (propagate, full)'),
  force: z
    .boolean()
    .optional()
    .default(false)
    .describe('Sync even if consumer working tree is dirty. Default: false. (propagate, full)'),
  push: z
    .boolean()
    .optional()
    .describe('Push after committing. Default: config.git.autoPush. (commit, propagate, full)'),
})
export type ProjectSyncActionInput = z.infer<typeof ProjectSyncActionInputSchema>

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

// --- status ---

export const ConsumerStatusSchema = z.object({
  repo: z.string(),
  pinnedHash: z.string(),
  behind: z.number().int().min(0),
  dirty: z.boolean(),
  hasWorktree: z.boolean(),
})
export type ConsumerStatus = z.infer<typeof ConsumerStatusSchema>

export const ProjectSyncStatusOutputSchema = z.object({
  coreRepo: z.string(),
  coreHead: z.string(),
  coreHeadShort: z.string(),
  consumers: z.array(ConsumerStatusSchema),
  summary: z.object({
    total: z.number().int().min(0),
    current: z.number().int().min(0),
    behind: z.number().int().min(0),
    dirty: z.number().int().min(0),
    blocked: z.number().int().min(0),
  }),
})
export type ProjectSyncStatusOutput = z.infer<typeof ProjectSyncStatusOutputSchema>

// --- commit ---

export const ProjectSyncCommitOutputSchema = z.object({
  status: z.enum(['committed', 'no-op']),
  commitHash: z.string().optional(),
  commitHashShort: z.string().optional(),
  commitMessage: z.string().optional(),
  tag: z.string().optional(),
  pushed: z.boolean().optional(),
})
export type ProjectSyncCommitOutput = z.infer<typeof ProjectSyncCommitOutputSchema>

// --- propagate ---

export const HookResultSchema = z.object({
  command: z.string(),
  exitCode: z.number().int(),
  stderr: z.string().optional(),
})

export const PropagateResultSchema = z.object({
  repo: z.string(),
  status: z.enum(['updated', 'already-current', 'blocked-worktree', 'blocked-dirty', 'error']),
  previousHash: z.string().optional(),
  newHash: z.string().optional(),
  pushed: z.boolean().optional(),
  hookResults: z.array(HookResultSchema).optional(),
  error: z.string().optional(),
})
export type PropagateResult = z.infer<typeof PropagateResultSchema>

export const SchemaWarningSchema = z.object({
  type: z.literal('schema-change'),
  files: z.array(z.string()),
  message: z.string(),
})

export const ProjectSyncPropagateOutputSchema = z.object({
  coreCommitHash: z.string(),
  coreCommitHashShort: z.string(),
  dryRun: z.boolean(),
  results: z.array(PropagateResultSchema),
  summary: z.object({
    updated: z.number().int().min(0),
    alreadyCurrent: z.number().int().min(0),
    blocked: z.number().int().min(0),
    errors: z.number().int().min(0),
  }),
  warnings: z.array(SchemaWarningSchema).optional(),
})
export type ProjectSyncPropagateOutput = z.infer<typeof ProjectSyncPropagateOutputSchema>

// --- full ---

export const ProjectSyncFullOutputSchema = z.object({
  commit: ProjectSyncCommitOutputSchema,
  propagate: ProjectSyncPropagateOutputSchema,
})
export type ProjectSyncFullOutput = z.infer<typeof ProjectSyncFullOutputSchema>

// --- diff ---

export const DiffFileEntrySchema = z.object({
  file: z.string(),
  status: z.enum(['added', 'modified', 'deleted', 'renamed', 'copied']),
  additions: z.number().int().min(0),
  deletions: z.number().int().min(0),
})
export type DiffFileEntry = z.infer<typeof DiffFileEntrySchema>

export const ConsumerDiffSchema = z.object({
  repo: z.string(),
  pinnedHash: z.string(),
  pinnedHashShort: z.string(),
  coreHead: z.string(),
  coreHeadShort: z.string(),
  status: z.enum(['behind', 'current', 'error']),
  behind: z.number().int(),
  files: z.array(DiffFileEntrySchema),
  totalAdditions: z.number().int().min(0),
  totalDeletions: z.number().int().min(0),
  patch: z.string().optional(),
  error: z.string().optional(),
})
export type ConsumerDiff = z.infer<typeof ConsumerDiffSchema>

export const ProjectSyncDiffOutputSchema = z.object({
  coreRepo: z.string(),
  coreHead: z.string(),
  coreHeadShort: z.string(),
  consumers: z.array(ConsumerDiffSchema),
  summary: z.object({
    total: z.number().int().min(0),
    current: z.number().int().min(0),
    behind: z.number().int().min(0),
    totalFiles: z.number().int().min(0),
    totalAdditions: z.number().int().min(0),
    totalDeletions: z.number().int().min(0),
    errors: z.number().int().min(0),
  }),
})
export type ProjectSyncDiffOutput = z.infer<typeof ProjectSyncDiffOutputSchema>

// --- discriminated union for all actions ---

export const ProjectSyncActionOutputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status'), result: ProjectSyncStatusOutputSchema }),
  z.object({ action: z.literal('commit'), result: ProjectSyncCommitOutputSchema }),
  z.object({ action: z.literal('propagate'), result: ProjectSyncPropagateOutputSchema }),
  z.object({ action: z.literal('full'), result: ProjectSyncFullOutputSchema }),
  z.object({ action: z.literal('diff'), result: ProjectSyncDiffOutputSchema }),
])
export type ProjectSyncActionOutput = z.infer<typeof ProjectSyncActionOutputSchema>
