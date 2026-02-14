import { z } from 'zod'
import {
  ReqListInputSchema,
  ReqListOutputSchema,
  ReqShowInputSchema,
  RequirementDetailSchema,
  ReqDepsInputSchema,
  DependencyGraphSchema,
  ReqTransferInputSchema,
  ReqTransferOutputSchema,
} from './requirement-schemas.js'

/**
 * Unified requirement action schemas using discriminated union
 */

// Input schema with discriminated union
export const ReqActionInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list'),
    payload: ReqListInputSchema,
  }),
  z.object({
    action: z.literal('show'),
    payload: ReqShowInputSchema,
  }),
  z.object({
    action: z.literal('deps'),
    payload: ReqDepsInputSchema,
  }),
  z.object({
    action: z.literal('transfer'),
    payload: ReqTransferInputSchema,
  }),
])

export type ReqActionInput = z.infer<typeof ReqActionInputSchema>

// Output schema with discriminated union
export const ReqActionOutputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list'),
    result: ReqListOutputSchema,
  }),
  z.object({
    action: z.literal('show'),
    result: RequirementDetailSchema,
  }),
  z.object({
    action: z.literal('deps'),
    result: DependencyGraphSchema,
  }),
  z.object({
    action: z.literal('transfer'),
    result: ReqTransferOutputSchema,
  }),
])

export type ReqActionOutput = z.infer<typeof ReqActionOutputSchema>

// Helper function to get output schema for a specific action
export function getReqActionOutputSchema(action: ReqActionInput['action']): z.ZodType {
  switch (action) {
    case 'list':
      return ReqListOutputSchema
    case 'show':
      return RequirementDetailSchema
    case 'deps':
      return DependencyGraphSchema
    case 'transfer':
      return ReqTransferOutputSchema
  }
}
