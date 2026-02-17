/**
 * Proposal Action Schemas
 *
 * Unified action-based tool for proposal lifecycle operations.
 * Uses discriminated unions for LLM-friendly action dispatch.
 */

import { z } from 'zod'
import {
  ProposalListInputSchema,
  ProposalListOutputSchema,
  ProposalShowInputSchema,
  ProposalDetailSchema,
  ProposalValidateInputSchema,
  ProposalValidateOutputSchema,
  ProposalApproveInputSchema,
  ProposalApproveOutputSchema,
  ProposalRejectInputSchema,
  ProposalRejectOutputSchema,
  ProposalStartInputSchema,
  ProposalStartOutputSchema,
} from './proposal-schemas.js'
import { ProposalCreateInputSchema, ProposalCreateOutputSchema } from './proposal-create-schemas.js'
import {
  ProposalGenerateInputSchema,
  ProposalGenerateOutputSchema,
  ProposalUpdateProgressInputSchema,
  ProposalUpdateProgressOutputSchema,
} from './workflow-schemas.js'

/**
 * Discriminated union for proposal action inputs
 * Each action has its own payload schema
 */
export const ProposalActionInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list'), payload: ProposalListInputSchema }),
  z.object({ action: z.literal('show'), payload: ProposalShowInputSchema }),
  z.object({ action: z.literal('create'), payload: ProposalCreateInputSchema }),
  z.object({ action: z.literal('generate'), payload: ProposalGenerateInputSchema }),
  z.object({ action: z.literal('validate'), payload: ProposalValidateInputSchema }),
  z.object({ action: z.literal('approve'), payload: ProposalApproveInputSchema }),
  z.object({ action: z.literal('reject'), payload: ProposalRejectInputSchema }),
  z.object({ action: z.literal('start'), payload: ProposalStartInputSchema }),
  z.object({ action: z.literal('progress'), payload: ProposalUpdateProgressInputSchema }),
])

export type ProposalActionInput = z.infer<typeof ProposalActionInputSchema>

/**
 * Validation result schema for guardrail enforcement
 */
const ValidationResultSchema = z.object({
  allowed: z.boolean(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
})

/**
 * Discriminated union for proposal action outputs
 * Maps each action to its corresponding output schema
 */
export const ProposalActionOutputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list'),
    result: ProposalListOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('show'),
    result: ProposalDetailSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('create'),
    result: ProposalCreateOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('generate'),
    result: ProposalGenerateOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('validate'),
    result: ProposalValidateOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('approve'),
    result: ProposalApproveOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('reject'),
    result: ProposalRejectOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('start'),
    result: ProposalStartOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('progress'),
    result: ProposalUpdateProgressOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
])

export type ProposalActionOutput = z.infer<typeof ProposalActionOutputSchema>

/**
 * Type guards for proposal actions
 */
export const isProposalListAction = (
  input: ProposalActionInput
): input is Extract<ProposalActionInput, { action: 'list' }> => input.action === 'list'

export const isProposalShowAction = (
  input: ProposalActionInput
): input is Extract<ProposalActionInput, { action: 'show' }> => input.action === 'show'

export const isProposalCreateAction = (
  input: ProposalActionInput
): input is Extract<ProposalActionInput, { action: 'create' }> => input.action === 'create'

export const isProposalValidateAction = (
  input: ProposalActionInput
): input is Extract<ProposalActionInput, { action: 'validate' }> => input.action === 'validate'

export const isProposalApproveAction = (
  input: ProposalActionInput
): input is Extract<ProposalActionInput, { action: 'approve' }> => input.action === 'approve'

export const isProposalRejectAction = (
  input: ProposalActionInput
): input is Extract<ProposalActionInput, { action: 'reject' }> => input.action === 'reject'

export const isProposalStartAction = (
  input: ProposalActionInput
): input is Extract<ProposalActionInput, { action: 'start' }> => input.action === 'start'
