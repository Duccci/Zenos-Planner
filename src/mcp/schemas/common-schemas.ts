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
 * - in_progress: Gate started via `zeno gates start`
 * - completed: All requirements tested, gate approved
 * - rejected: Gate rejected during review
 */
export const GateStatusEnum = z.enum(['pending', 'in_progress', 'completed', 'rejected'])
export type GateStatus = z.infer<typeof GateStatusEnum>

/**
 * Requirement status lifecycle:
 * - pending: Requirement generated, not started
 * - in_progress: Work in progress
 * - tested: Implementation complete and tested
 * - archived: Requirement archived after gate completion
 */
export const RequirementStatusEnum = z.enum(['pending', 'in_progress', 'tested', 'archived'])
export type RequirementStatus = z.infer<typeof RequirementStatusEnum>

/**
 * Proposal status lifecycle:
 * - pending: Proposal generated, awaiting start
 * - in_progress: Implementation in progress
 * - completed: Implementation done, awaiting approval
 * - archived: Proposal completed and archived
 * - rejected: Proposal rejected during review
 */
export const ProposalStatusEnum = z.enum([
  'pending',
  'in_progress',
  'completed',
  'archived',
  'rejected',
])
export type ProposalStatus = z.infer<typeof ProposalStatusEnum>

/**
 * Repository types for project boundary detection
 */
export const RepositoryTypeEnum = z.enum(['main', 'service', 'library', 'tool'])
export type RepositoryType = z.infer<typeof RepositoryTypeEnum>

/**
 * Gate types for different purposes
 */
export const GateTypeEnum = z.enum(['feature', 'infrastructure', 'migration'])
export type GateType = z.infer<typeof GateTypeEnum>

/**
 * Requirement types for categorization
 */
export const RequirementTypeEnum = z.enum(['feature', 'infrastructure', 'test', 'documentation'])
export type RequirementType = z.infer<typeof RequirementTypeEnum>

// ============================================================================
// IDENTIFIERS - Validated ID and hash types
// ============================================================================

/** Gate identifier (e.g., "gate-01", "gate-02") */
export const GateIdSchema = z.string().regex(/^gate-\d{2}$/, 'Gate ID must be format gate-XX')
export type GateId = z.infer<typeof GateIdSchema>

/** Requirement hash identifier (e.g., "#req12345678") */
export const RequirementHashSchema = z
  .string()
  .regex(/^[a-z0-9]{8}$/, 'Requirement hash must be 8 alphanumeric characters')
export type RequirementHash = z.infer<typeof RequirementHashSchema>

/** Proposal hash identifier (e.g., "#g01p01hash") */
export const ProposalHashSchema = z
  .string()
  .regex(/^[a-z0-9]{8}$/, 'Proposal hash must be 8 alphanumeric characters')
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

/** ISO 8601 timestamp string */
export const TimestampSchema = z.iso.datetime()
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
// PAGINATION - List operation support
// ============================================================================

/** Pagination parameters for list operations */
export const PaginationInputSchema = z.object({
  skip: z.number().int().min(0).default(0),
  take: z.number().int().min(1).max(1000).default(100),
})
export type PaginationInput = z.infer<typeof PaginationInputSchema>

/** Pagination metadata in list responses */
export const PaginationMetadataSchema = z.object({
  total: z.number().int().min(0),
  skip: z.number().int().min(0),
  take: z.number().int().min(1),
  hasMore: z.boolean(),
})
export type PaginationMetadata = z.infer<typeof PaginationMetadataSchema>

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
  pagination: PaginationMetadataSchema,
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
