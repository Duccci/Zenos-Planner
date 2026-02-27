/**
 * Gates Action Schemas
 *
 * Flat, self-documenting input schema for the gates_action tool.
 * All fields are optional top-level properties so LLMs can call this tool
 * with any subset of args and the handler decides what is required per action.
 * An empty call ({}) passes validation and the handler returns usage guidance.
 */

import { z } from 'zod'
import { PreReviewSchema } from './pre-review-schemas.js'
import {
  GatesListOutputSchema,
  GateDetailSchema,
  GatesStartOutputSchema,
  GatesCompleteOutputSchema,
  GatesRegenerateOutputSchema,
  GatesCancelOutputSchema,
  GatesDeferOutputSchema,
} from './gate-schemas.js'
import { GateCreateOutputSchema } from './gate-create-schemas.js'
import { GateGenerateOutputSchema } from './workflow-schemas.js'

/**
 * Flat input schema for the gates_action tool.
 *
 * action required for all calls:
 *   list       — list gates; optional: status, skip, take
 *   show       — get gate details; required: gateId
 *   create     — create a new gate; required: gateId, name, type, sequence, objectives; optional: dependencies, description
 *   generate   — generate gates from requirements; required: preReview (enforced by handler); optional: mode, anchorGateId, templateName, requirementsPerGate
 *   start      — transition gate to in_progress; required: gateId; optional: notes
 *   complete   — mark gate completed; required: gateId; optional: completionNotes, approvalDate
 *   regenerate — regenerate gate sequence; optional: fromGateId, mode
 *
 * preReview: required for `generate` action (enforced by handler, not schema).
 */
export const GatesActionInputSchema = z.object({
  action: z
    .enum(['list', 'show', 'create', 'generate', 'start', 'complete', 'regenerate', 'cancel', 'defer'])
    .optional()
    .describe(
      'Action to perform. ' +
        'list=show all gates (optional: status filter). ' +
        'show=get gate details (needs: gateId). ' +
        'create=new gate (needs: gateId, name, type, sequence, objectives). ' +
        'generate=generate from requirements (optional: mode, anchorGateId; required: preReview with phase=generate). ' +
        'start=begin gate work, pending→in_progress (needs: gateId). ' +
        'complete=finish gate (needs: gateId). ' +
        'regenerate=rebuild future gates after rescope (optional: fromGateId, mode). ' +
        'cancel=mark gate as cancelled/dropped (needs: gateId; optional: notes as reason). ' +
        'defer=move gate to backlog for later implementation (needs: gateId; optional: notes as reason).'
    ),

  // --- shared identifier ---
  gateId: z
    .string()
    .optional()
    .describe('Gate ID e.g. "gate-01" (show/create/start/complete/regenerate)'),

  // --- list filters ---
  status: z
    .enum(['pending', 'in_progress', 'completed', 'archived', 'cancelled', 'backlog'])
    .optional()
    .describe('Filter gates by status (list action)'),

  // --- create fields ---
  name: z.string().optional().describe('Human-readable gate name (create)'),
  type: z.enum(['feature', 'quality', 'rescope']).optional().describe('Gate type (create)'),
  sequence: z.number().int().min(1).optional().describe('Gate sequence number (create)'),
  dependencies: z
    .array(z.string())
    .optional()
    .describe('Gate IDs that must complete first (create)'),
  objectives: z.array(z.string()).optional().describe('Goals the gate must achieve (create)'),
  description: z.string().optional().describe('Optional gate description (create)'),

  // --- generate fields ---
  mode: z
    .enum(['new', 'rebaseline', 'single', 'full', 'partial', 'check'])
    .optional()
    .describe(
      'Generation/regeneration mode (generate: new|rebaseline|single; regenerate: full|partial|check)'
    ),
  anchorGateId: z.string().optional().describe('Gate to anchor generation from (generate)'),
  templateName: z
    .string()
    .optional()
    .describe('Template name (generate, default: gate-prd-template)'),
  requirementsPerGate: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe('Max requirements per gate (generate, default 5)'),

  // --- start/complete/regenerate fields ---
  notes: z.string().optional().describe('Optional notes (start)'),
  completionNotes: z.string().optional().describe('Completion summary notes (complete)'),
  approvalDate: z.string().optional().describe('ISO timestamp of approval (complete)'),
  fromGateId: z.string().optional().describe('Regenerate from this gate forward (regenerate)'),

  // --- preReview field (generate) ---
  /**
   * Pre-work review evidence. Required for the `generate` action.
   * The handler returns a structured error if absent when action === 'generate'.
   * Must use phase='generate'.
   */
  preReview: PreReviewSchema.optional().describe(
    "Pre-work review evidence (required for 'generate' action). " +
      "phase must be 'generate'. Read the full project PRD and requirements before generating gates."
  ),
})

export type GatesActionInput = z.infer<typeof GatesActionInputSchema>

/**
 * Validation result schema for guardrail enforcement
 */
const ValidationResultSchema = z.object({
  allowed: z.boolean(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
})

/**
 * Discriminated union for gate action outputs
 * Maps each action to its corresponding output schema
 */
export const GatesActionOutputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list'),
    result: GatesListOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('show'),
    result: GateDetailSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('create'),
    result: GateCreateOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('generate'),
    result: GateGenerateOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('start'),
    result: GatesStartOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('complete'),
    result: GatesCompleteOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('regenerate'),
    result: GatesRegenerateOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('cancel'),
    result: GatesCancelOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('defer'),
    result: GatesDeferOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
])

export type GatesActionOutput = z.infer<typeof GatesActionOutputSchema>
