import { z } from 'zod'

/**
 * Common Zod schemas and enums used across all MCP tools
 * Provides runtime validation and TypeScript type inference
 */

// ============================================================================
// ENUMS - Database and workflow status values
// ============================================================================

/**
 * Gate status lifecycle:
 * - pending: Gate generated, not yet started
 * - validated: Gate passed dry-run checks via gates_action:validate
 * - in_progress: Gate started via `zeno gates start`
 * - completed: All requirements tested, gate approved
 * - rejected: Gate rejected during review
 */
export const GateStatusEnum = z.enum(['pending', 'validated', 'in_progress', 'completed', 'rejected', 'cancelled', 'backlog'])
export type GateStatus = z.infer<typeof GateStatusEnum>

/**
 * Proposal status lifecycle:
 * - pending: Proposal generated, awaiting start
 * - validated: Proposal passed dry-run checks via proposal_action:validate
 * - in_progress: Implementation in progress
 * - completed: Implementation done and integrated at gate completion
 * - rejected: Proposal rejected during review
 * - archived: Proposal archived after gate completion
 */
export const ProposalStatusEnum = z.enum(['pending', 'validated', 'in_progress', 'completed', 'rejected', 'cancelled', 'backlog', 'archived'])
export type ProposalStatus = z.infer<typeof ProposalStatusEnum>

/**
 * Repository types for project boundary detection
 */
export const RepositoryTypeEnum = z.enum(['main', 'service', 'library', 'tool'])
export type RepositoryType = z.infer<typeof RepositoryTypeEnum>

/**
 * Gate phase — groups gates into delivery milestones.
 *
 * Well-known string values:
 *   'MVP'       — minimum viable product scope
 *   'Post-MVP'  — planned work after the MVP is shipped
 *   'Deferred'  — explicitly pushed to a later decision point
 *   'Backup'    — contingency / nice-to-have scope
 *
 * Numeric milestones (1, 2, 3 …) allow simple sequential grouping.
 * Any other string (e.g. 'May Demo', 'Beta', 'GA') is accepted for
 * project-specific milestones.
 *
 * A gate may carry multiple milestones at once, e.g. [2, 'Post-MVP'].
 */
export const GateMilestoneSchema = z.union([
  z.number().int().min(1),
  z.string().min(1),
])
export type GateMilestone = z.infer<typeof GateMilestoneSchema>

/**
 * Requirement types for categorization
 */
export const RequirementTypeEnum = z.enum(['functional', 'non_functional', 'constraint'])
export type RequirementType = z.infer<typeof RequirementTypeEnum>

/**
 * Requirement status lifecycle:
 * - pending: Requirement generated, not yet implemented
 * - in_progress: Actively being implemented
 * - tested: Implementation verified (set at gate completion)
 * - archived: Archived with the parent gate
 *
 * Note: status transitions are not user-controlled via CLI. The `zeno req status`
 * command was removed. Status progresses automatically through gate/proposal lifecycle.
 */
export const RequirementStatusEnum = z.enum(['pending', 'in_progress', 'tested', 'archived'])
export type RequirementStatus = z.infer<typeof RequirementStatusEnum>

/**
 * Requirement priority levels (MoSCoW)
 */
export const RequirementPriorityEnum = z.enum(['must', 'should', 'could', 'wont'])
export type RequirementPriority = z.infer<typeof RequirementPriorityEnum>

// ============================================================================
// IDENTIFIERS - Validated ID and hash types
// ============================================================================

/** Gate identifier (e.g., "gate-01", "gate-02") */
export const GateIdSchema = z.string().regex(/^gate-\d{2}$/, 'Gate ID must be format gate-XX')
export type GateId = z.infer<typeof GateIdSchema>

/** Requirement hash identifier (e.g., "02e2ad5d6ecd6f46") */
export const RequirementHashSchema = z
  .string()
  .regex(/^[a-z0-9]{16}$/, 'Requirement hash must be 16 alphanumeric characters')
export type RequirementHash = z.infer<typeof RequirementHashSchema>

/** Proposal hash identifier (e.g., "a6aca3c1", "p05g04conddiag0", "p0209mcp-util-extract") */
export const ProposalHashSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Proposal hash must be lowercase alphanumeric with optional hyphens')
export type ProposalHash = z.infer<typeof ProposalHashSchema>

/** Git commit hash */
export const CommitHashSchema = z.string().regex(/^[a-f0-9]{7,40}$/i, 'Invalid commit hash format')
export type CommitHash = z.infer<typeof CommitHashSchema>

/** File path relative to project root */
export const FilePathSchema = z.string().min(1).max(500)
export type FilePath = z.infer<typeof FilePathSchema>

// ============================================================================
// TIMESTAMPS - ISO string validation
// ============================================================================

/** ISO 8601 timestamp string (e.g., 2024-02-18T10:30:45.000Z) */
export const TimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?$/, 'Invalid ISO 8601 datetime format')
export type Timestamp = z.infer<typeof TimestampSchema>

/** Optional timestamp (for fields that may be null) */
export const OptionalTimestampSchema = TimestampSchema.nullable().optional()
export type OptionalTimestamp = z.infer<typeof OptionalTimestampSchema>

// ============================================================================
// ERROR HANDLING - Structured error responses
// ============================================================================

/**
 * Error codes for structured error responses across all MCP tools.
 *
 * - `COMMAND_FAILED` — A CLI or shell command returned a non-zero exit code
 * - `NOT_FOUND` — Requested entity (gate, proposal, requirement) does not exist
 * - `INVALID_INPUT` — Input parameters failed validation
 * - `INVALID_STATUS_TRANSITION` — Attempted an illegal status change (e.g. pending→completed)
 * - `ALREADY_EXISTS` — Entity with the same identifier already exists
 * - `PERMISSION_DENIED` — Caller lacks permission for the operation
 * - `UNAUTHORIZED` — Authentication required or credentials invalid
 * - `CONFLICT` — Operation conflicts with current state (e.g. concurrent edits)
 * - `INTERNAL_ERROR` — Unexpected internal failure
 * - `VALIDATION_ERROR` — Business-rule validation failed
 * - `DEPENDENCY_BLOCKED` — Operation blocked by an unresolved dependency
 * - `GIT_VIOLATION` — Git operations attempted during a restricted phase (apply)
 */
export const ErrorCodeEnum = z.enum([
  'COMMAND_FAILED',
  'NOT_FOUND',
  'INVALID_INPUT',
  'INVALID_STATUS_TRANSITION',
  'ALREADY_EXISTS',
  'PERMISSION_DENIED',
  'UNAUTHORIZED',
  'CONFLICT',
  'INTERNAL_ERROR',
  'VALIDATION_ERROR',
  'DEPENDENCY_BLOCKED',
  'GIT_VIOLATION',
])
export type ErrorCode = z.infer<typeof ErrorCodeEnum>

/** Error context with helpful debugging information */
export const ErrorContextSchema = z.object({
  resourceId: z.string().optional(),
  resourceType: z.string().optional(),
  field: z.string().optional(),
  expectedValues: z.array(z.string()).optional(),
  currentValue: z.any().optional(),
  suggestion: z.string().optional(),
})
export type ErrorContext = z.infer<typeof ErrorContextSchema>

/** Structured error response for MCP tools */
export const ErrorResponseSchema = z.object({
  code: ErrorCodeEnum,
  message: z.string(),
  context: ErrorContextSchema.optional(),
  timestamp: TimestampSchema.optional(),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

/**
 * Discriminated union representing either a successful result or a structured error.
 * Use as the return type for any MCP tool handler or function-registry invocation.
 */
export type ToolResponse<T> = { success: true; data: T } | { success: false; error: ErrorResponse }

// ============================================================================
// TEMPLATE SCHEMAS
// ============================================================================

/** Template category enum */
export const TemplateCategoryEnum = z.enum(['markdown', 'architecture', 'config', 'workflow'])
export type TemplateCategory = z.infer<typeof TemplateCategoryEnum>

/** Template metadata */
export const TemplateMetadataSchema = z.object({
  name: z.string(),
  category: TemplateCategoryEnum,
  description: z.string(),
  version: z.string(),
  usage: z.string().optional(),
})
export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>

/** Template content response */
export const TemplateContentSchema = z.object({
  name: z.string(),
  content: z.string(),
  metadata: TemplateMetadataSchema,
})
export type TemplateContent = z.infer<typeof TemplateContentSchema>

/** List of templates */
export const TemplateListSchema = z.object({
  templates: z.array(TemplateMetadataSchema),
})
export type TemplateList = z.infer<typeof TemplateListSchema>

/** Template context for LLM */
export const TemplateContextSchema = z.object({
  templateName: z.string(),
  content: z.string(),
  metadata: TemplateMetadataSchema,
  gateContext: z
    .object({
      gateId: GateIdSchema,
      gateName: z.string(),
      gateDescription: z.string(),
    })
    .optional(),
  usage: z.string(),
})
export type TemplateContext = z.infer<typeof TemplateContextSchema>

// ============================================================================
// CONFIG SCHEMAS
// ============================================================================

/** Project configuration */
export const ProjectConfigSchema = z.object({
  projectName: z.string(),
  version: z.string(),
  description: z.string().optional(),
  paths: z
    .object({
      root: FilePathSchema,
      src: FilePathSchema,
      tests: FilePathSchema,
      zeno: FilePathSchema,
    })
    .optional(),
  quality: z
    .object({
      minCoverage: z.number().min(0).max(100).optional(),
      maxLintErrors: z.number().min(0).optional(),
      maxSecurityIssues: z.number().min(0).optional(),
    })
    .optional(),
})
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>

/** Configuration value - any JSON value */
export const ConfigValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
])
export type ConfigValue = unknown

/** Configuration object with arbitrary structure */
export const ConfigObjectSchema = z.record(z.string(), z.unknown())
export type ConfigObject = z.infer<typeof ConfigObjectSchema>

// ============================================================================
// GENERIC RESPONSE WRAPPERS
// ============================================================================

/** Success response wrapper for operations */
export const SuccessResponseSchema = (dataSchema: z.ZodType): z.ZodType =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
  })

/** Failure response wrapper for operations */
export const FailureResponseSchema = z.object({
  success: z.literal(false),
  error: ErrorResponseSchema,
})

/** Operation result - either success or failure */
export const OperationResultSchema = (dataSchema: z.ZodType): z.ZodType =>
  z.union([SuccessResponseSchema(dataSchema), FailureResponseSchema])
