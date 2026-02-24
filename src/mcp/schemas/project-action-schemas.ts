/**
 * Project Action Tool Schemas
 *
 * Zod schemas for project-level operations (init, status).
 */

import { z } from 'zod'

/**
 * Input schema for project_action tool
 * Discriminated union supporting 'init' and 'status' actions
 */
export const ProjectActionInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('init'),
    projectName: z.string().min(1).max(100),
    endState: z.string().min(1),
  }),
  z.object({
    action: z.literal('status'),
  }),
])

export type ProjectActionInput = z.infer<typeof ProjectActionInputSchema>

/**
 * Output schemas for each action
 */
const ProjectInitOutputSchema = z.object({
  success: z.boolean(),
  projectName: z.string(),
  message: z.string().optional(),
  gatesGenerated: z.number().int().min(0),
  requirementsGenerated: z.number().int().min(0),
})

const ProjectStatusGateSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
})

const ProjectStatusMcpSchema = z.object({
  status: z.string(),
  toolsRegistered: z.number().int().min(0),
  configLoaded: z.boolean(),
})

const ProjectStatusOutputSchema = z.object({
  activeGates: z.array(ProjectStatusGateSchema),
  completedGates: z.array(z.string()),
  mcp: ProjectStatusMcpSchema,
})

/**
 * Unified output schema - discriminated union by action
 */
export const ProjectActionOutputSchema = z.discriminatedUnion('success', [
  ProjectInitOutputSchema.extend({ action: z.literal('init').optional() }),
  ProjectStatusOutputSchema.extend({ success: z.literal(true).optional() }),
]).or(
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
)

export type ProjectActionOutput = z.infer<typeof ProjectActionOutputSchema>
