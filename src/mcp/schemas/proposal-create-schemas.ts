/**
 * Proposal Creation Schemas
 *
 * Zod schemas for creating new proposals via MCP.
 */

import { z } from 'zod'
import { ProposalHashSchema, GateIdSchema, TimestampSchema } from './common-schemas.js'

/**
 * Schema for a proposal task
 */
export const ProposalTaskInputSchema = z.object({
  /** Task description (also used as the task title heading) */
  description: z.string().min(1),

  /** Acceptance criteria (unchecked by default) */
  acceptanceCriteria: z.array(z.string()).default([]),

  /** Proposal phase: RED (write tests) or GREEN (verify tests pass with implementation) */
  phase: z.enum(['RED', 'GREEN']).optional(),

  /** File paths this task touches */
  files: z.array(z.string()).optional(),

  /** Change action for this task's files */
  action: z.enum(['create', 'modify', 'delete', 'refactor']).optional(),
})

export type ProposalTaskInput = z.infer<typeof ProposalTaskInputSchema>

/**
 * Schema for proposal_create input
 * Defines the structure for creating a new proposal
 */
export const ProposalCreateInputSchema = z.object({
  /** Proposal title */
  title: z.string().min(1, 'Title is required'),

  /** Proposal summary (2-3 sentences) */
  summary: z.string().min(1, 'Summary is required'),

  /** Gate ID for gate-tied proposals */
  gateId: GateIdSchema.optional(),

  /** Flag for solitary proposals (not tied to a gate) */
  solitary: z.boolean().default(false),

  /** Array of tasks with descriptions and acceptance criteria */
  tasks: z.array(ProposalTaskInputSchema).min(1, 'At least one task is required'),

  /** Array of files that will be affected */
  filesAffected: z.array(z.string()).default([]),

  /** Optional proposal context */
  context: z.string().optional(),

  /** Optional dependencies */
  dependencies: z.array(z.string()).default([]),
})

export type ProposalCreateInput = z.infer<typeof ProposalCreateInputSchema>

/**
 * Schema for proposal_create output
 * Returns details about the created proposal
 */
export const ProposalCreateOutputSchema = z.object({
  /** Generated proposal hash (8-character alphanumeric) */
  hash: ProposalHashSchema,

  /** Path to the created proposal file */
  filePath: z.string(),

  /** Validation results */
  validation: z.object({
    /** Whether validation passed */
    passed: z.boolean(),
    /** Validation errors (if any) */
    errors: z.array(z.string()).default([]),
    /** Validation warnings (if any) */
    warnings: z.array(z.string()).default([]),
  }),

  /** Proposal status (always "pending" on creation) */
  status: z.literal('pending'),

  /** Creation timestamp */
  createdAt: TimestampSchema,

  /** Gate ID (if applicable) */
  gateId: GateIdSchema.optional(),

  /** Whether this is a solitary proposal */
  solitary: z.boolean(),
})

export type ProposalCreateOutput = z.infer<typeof ProposalCreateOutputSchema>

/**
 * Validation error codes for proposal creation
 */
export enum ProposalCreateErrorCode {
  DUPLICATE_HASH = 'DUPLICATE_HASH',
  INVALID_GATE = 'INVALID_GATE',
  INVALID_STRUCTURE = 'INVALID_STRUCTURE',
  FILE_WRITE_FAILED = 'FILE_WRITE_FAILED',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
}
