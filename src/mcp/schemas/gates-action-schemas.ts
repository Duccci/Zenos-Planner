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
import { GateTypeEnum, GateStatusEnum } from './common-schemas.js'
import {
  GatesListOutputSchema,
  GateDetailSchema,
  GatesStartOutputSchema,
  GatesCompleteOutputSchema,
  GatesRegenerateOutputSchema,
  GatesCancelOutputSchema,
  GatesDeferOutputSchema,
  GatesValidateOutputSchema,
  GateQualitativeReviewSchema,
} from './gate-schemas.js'
import { GateCreateOutputSchema } from './gate-create-schemas.js'
import { GateGenerateOutputSchema } from './workflow-schemas.js'

/**
 * Flat input schema for the gates_action tool.
 *
 * action required for all calls:
 *   list       — list gates; optional: status, skip, take
 *   show       — get gate details; required: gateId (gate hash preferred)
 *   create     — create a new gate; required: gateId, name, type, sequence, objectives; optional: dependencies, description
 *   generate   — generate gates from requirements; required: preReview (enforced by handler); optional: mode, anchorGateId, templateName, requirementsPerGate
 *   start      — transition gate to in_progress; required: gateId (gate hash preferred); optional: notes
 *   complete   — mark gate completed; required: gateId (gate hash preferred); optional: completionNotes, approvalDate
 *   regenerate — unified replan: regenerate future gates, or clear+re-render a single gate from template.
 *                 optional: gateId (single-gate mode, gate hash preferred), fromGateId, prdChanged, dryRun, mode
 *
 * preReview: required for `generate` action (enforced by handler, not schema).
 */
export const GatesActionInputSchema = z.object({
  action: z
    .enum(['list', 'show', 'create', 'generate', 'validate', 'start', 'complete', 'regenerate', 'cancel', 'defer'])
    .optional()
    .describe(
      'Action to perform. ' +
        'list=show all gates (optional: status filter). ' +
        'show=get gate details (needs: gateId). ' +
        'create=new gate (needs: gateId, name, type, sequence, objectives). ' +
        'generate=generate from requirements (optional: mode, anchorGateId; required: preReview with phase=generate). ' +
        'validate=dry-run quality/structural checks without completing (needs: gateId). ' +
        'start=begin gate work, validated→in_progress (needs: gateId; required: qualitativeReview with all six booleans + flaggedItems). ' +
        'complete=finish gate (needs: gateId). ' +
        'regenerate=unified replan: omit gateId to regenerate all future gates; supply gateId to clear+re-render that single gate from template. ' +
        'Optional: gateId (single-gate), fromGateId (multi-gate baseline), prdChanged=true (rescope signal), dryRun=true (plan only), mode. ' +
        'cancel=mark gate as cancelled/dropped (needs: gateId, confirmed: true; optional: notes as reason). ' +
        'defer=move gate to backlog for later implementation (needs: gateId, confirmed: true; optional: notes as reason). ' +
        'IMPORTANT: cancel and defer are destructive and require confirmed: true — omitting it returns a confirmation prompt instead of executing.'
    ),

  // --- shared identifier ---
  gateId: z
    .string()
    .optional()
    .describe('Gate hash (from gates_action:list) — preferred over the textual gate-XX ID (show/create/start/complete/validate/cancel/defer/regenerate)'),

  // --- list filters ---
  status: GateStatusEnum
    .optional()
    .describe('Filter gates by status (list action)'),

  // --- create fields ---
  name: z.string().optional().describe('Human-readable gate name (create)'),
  type: GateTypeEnum.optional().describe('Gate type (create)'),
  sequence: z.number().int().min(1).optional().describe('Gate sequence number (create)'),
  dependencies: z
    .array(z.string())
    .optional()
    .describe('Gate IDs that must complete first (create)'),
  objectives: z.array(z.string()).optional().describe('Goals the gate must achieve (create)'),
  description: z.string().optional().describe('Optional gate description (create)'),
  phases: z
    .array(z.union([z.number().int().min(1), z.string().min(1)]))
    .optional()
    .describe(
      'Delivery phase labels for this gate (create/generate). ' +
      'Well-known values: numeric sequence (1, 2, 3), "MVP", "Post-MVP", "Deferred", "Backup". ' +
      'Custom project-specific values (e.g. "May Demo", "Beta") are also accepted. ' +
      'Multiple values allowed, e.g. [2, "Post-MVP"].'
    ),

  // --- generate fields ---
  mode: z
    .enum(['new', 'rebaseline', 'single', 'full', 'partial', 'check'])
    .optional()
    .describe(
      'Generation/regeneration mode (generate: new|rebaseline|single; regenerate: full|partial|check)'
    ),
  anchorGateId: z.string().optional().describe('Gate hash (or ID) to anchor generation from (generate)'),
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

  // --- destructive action guard ---
  confirmed: z
    .boolean()
    .optional()
    .describe(
      'Must be true to execute destructive actions (cancel, defer). ' +
        'If absent or false, the action returns a confirmation prompt with the required details ' +
        'instead of executing. Always present this prompt to the user and wait for explicit approval ' +
        'before re-calling with confirmed: true.'
    ),

  // --- start/complete/regenerate fields ---
  notes: z.string().optional().describe('Optional notes (start, cancel, defer)'),
  completionNotes: z.string().optional().describe('Completion summary notes (complete)'),
  approvalDate: z.string().optional().describe('ISO timestamp of approval (complete)'),
  fromGateId: z.string().optional().describe('Multi-gate baseline: regenerate gates after this completed gate (regenerate)'),
  prdChanged: z
    .boolean()
    .optional()
    .describe(
      'Rescope signal: set true when the project PRD end-state has changed. ' +
      'Causes the replan to pull the current PRD end-state as additional reasoning context (regenerate).'
    ),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      'Return the replan result without writing any files to disk (regenerate). ' +
      'Useful for previewing changes before committing.'
    ),

  // --- qualitativeReview field (start) ---
  /**
   * Agent-submitted qualitative review evidence. Required for the `start` action.
   * The handler returns a structured error if absent when action === 'start' (and gate
   * is not already in_progress). Evaluate every item in the validate checklist first,
   * then submit findings here before calling start.
   */
  qualitativeReview: GateQualitativeReviewSchema.optional().describe(
    "Required for 'start' action. Evaluate the qualitative checklist from gates_action:validate, " +
      'then submit: { objectivesConfirmed, requirementsMapped, proposalCountAppropriate, ' +
      'testFirstOrderingVerified, dependenciesConfirmed, scopeAchievable, flaggedItems }.'
  ),

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
    action: z.literal('validate'),
    result: GatesValidateOutputSchema,
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
