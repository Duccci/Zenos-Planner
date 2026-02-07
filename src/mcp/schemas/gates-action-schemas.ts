/**
 * Gates Action Schemas
 *
 * Unified action-based tool for gate lifecycle operations.
 * Uses discriminated unions for LLM-friendly action dispatch.
 */

import { z } from 'zod'
import {
  GatesListInputSchema,
  GatesListOutputSchema,
  GatesShowInputSchema,
  GateDetailSchema,
  GatesStartInputSchema,
  GatesStartOutputSchema,
  GatesCompleteInputSchema,
  GatesCompleteOutputSchema,
  GatesRegenerateInputSchema,
  GatesRegenerateOutputSchema,
} from './gate-schemas.js'
import { GateCreateInputSchema, GateCreateOutputSchema } from './gate-create-schemas.js'

/**
 * Discriminated union for gate action inputs
 * Each action has its own payload schema
 */
export const GatesActionInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list'), payload: GatesListInputSchema }),
  z.object({ action: z.literal('show'), payload: GatesShowInputSchema }),
  z.object({ action: z.literal('create'), payload: GateCreateInputSchema }),
  z.object({ action: z.literal('start'), payload: GatesStartInputSchema }),
  z.object({ action: z.literal('complete'), payload: GatesCompleteInputSchema }),
  z.object({ action: z.literal('regenerate'), payload: GatesRegenerateInputSchema }),
])

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
    validation: ValidationResultSchema.optional()
  }),
  z.object({
    action: z.literal('show'),
    result: GateDetailSchema,
    validation: ValidationResultSchema.optional()
  }),
  z.object({
    action: z.literal('create'),
    result: GateCreateOutputSchema,
    validation: ValidationResultSchema.optional()
  }),
  z.object({
    action: z.literal('start'),
    result: GatesStartOutputSchema,
    validation: ValidationResultSchema.optional()
  }),
  z.object({
    action: z.literal('complete'),
    result: GatesCompleteOutputSchema,
    validation: ValidationResultSchema.optional()
  }),
  z.object({
    action: z.literal('regenerate'),
    result: GatesRegenerateOutputSchema,
    validation: ValidationResultSchema.optional()
  }),
])

export type GatesActionOutput = z.infer<typeof GatesActionOutputSchema>

/**
 * Type guards for gate actions
 */
export const isGatesListAction = (input: GatesActionInput): input is Extract<GatesActionInput, { action: 'list' }> =>
  input.action === 'list'

export const isGatesShowAction = (input: GatesActionInput): input is Extract<GatesActionInput, { action: 'show' }> =>
  input.action === 'show'

export const isGatesCreateAction = (input: GatesActionInput): input is Extract<GatesActionInput, { action: 'create' }> =>
  input.action === 'create'

export const isGatesStartAction = (input: GatesActionInput): input is Extract<GatesActionInput, { action: 'start' }> =>
  input.action === 'start'

export const isGatesCompleteAction = (input: GatesActionInput): input is Extract<GatesActionInput, { action: 'complete' }> =>
  input.action === 'complete'

export const isGatesRegenerateAction = (input: GatesActionInput): input is Extract<GatesActionInput, { action: 'regenerate' }> =>
  input.action === 'regenerate'
