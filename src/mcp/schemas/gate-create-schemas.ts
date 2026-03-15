/**
 * Gate Creation Schemas
 *
 * Zod schemas for creating new gates via MCP.
 */

import { z } from 'zod'
import { GateIdSchema, GateTypeEnum, TimestampSchema } from './common-schemas.js'

/**
 * Schema for gate_create input
 * Defines the structure for creating a new gate
 */
export const GateCreateInputSchema = z.object({
  /** Gate ID (e.g., "gate-03") */
  gateId: GateIdSchema,

  /** Human-readable gate name */
  name: z.string().min(1, 'Gate name is required'),

  /** Gate type */
  type: GateTypeEnum,

  /** Gate sequence number */
  sequence: z.number().int().min(1),

  /** Gate dependencies (gate IDs that must complete first) */
  dependencies: z.array(GateIdSchema).default([]),

  /** Gate objectives (goals to achieve) */
  objectives: z.array(z.string()).min(1, 'At least one objective is required'),

  /** Optional gate description */
  description: z.string().optional(),
})

export type GateCreateInput = z.infer<typeof GateCreateInputSchema>

/**
 * Schema for gate_plan input.
 * Registers a gate with a name and goal statement before generating the full PRD.
 * Stores only the minimal identifying information needed to anchor the gate's intent.
 */
export const GatePlanInputSchema = z.object({
  /** Gate ID (e.g., "gate-03") */
  gateId: GateIdSchema,

  /** Human-readable gate name */
  name: z.string().min(1, 'Gate name is required'),

  /** Short project statement defining the main goal of the gate (1–3 sentences) */
  goal: z.string().min(1, 'Gate goal is required'),

  /** Gate sequence number */
  sequence: z.number().int().min(1),

  /** Gate type */
  type: GateTypeEnum.default('feature'),

  /** Gate dependencies (gate IDs that must complete first) */
  dependencies: z.array(GateIdSchema).default([]),
})

export type GatePlanInput = z.infer<typeof GatePlanInputSchema>

/**
 * Schema for gate_plan output
 */
export const GatePlanOutputSchema = z.object({
  /** Planned gate ID */
  gateId: GateIdSchema,

  /** Gate hash reference */
  hash: z.string(),

  /** Whether the gate already existed (updated vs inserted) */
  alreadyExisted: z.boolean(),

  /** Creation timestamp */
  createdAt: TimestampSchema,
})

export type GatePlanOutput = z.infer<typeof GatePlanOutputSchema>

/**
 * Schema for gate_create output
 * Returns details about the created gate
 */
export const GateCreateOutputSchema = z.object({
  /** Created gate ID */
  gateId: GateIdSchema,

  /** Path to the created gate file */
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

  /** Whether gate-roadmap.md was updated */
  roadmapUpdated: z.boolean(),

  /** Creation timestamp */
  createdAt: TimestampSchema,
})

export type GateCreateOutput = z.infer<typeof GateCreateOutputSchema>

/**
 * Validation error codes for gate creation
 */
export enum GateCreateErrorCode {
  DUPLICATE_ID = 'DUPLICATE_ID',
  INVALID_TYPE = 'INVALID_TYPE',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  MISSING_DEPENDENCY = 'MISSING_DEPENDENCY',
  INVALID_SEQUENCE = 'INVALID_SEQUENCE',
  FILE_WRITE_FAILED = 'FILE_WRITE_FAILED',
}
