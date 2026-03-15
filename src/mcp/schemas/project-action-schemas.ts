/**
 * Project Action Tool Schemas
 *
 * Zod schemas for project-level operations (init, status).
 */

import { z } from 'zod'

/**
 * Input schema for project_action tool.
 * Flat schema (not discriminated union) so the entity-action-handler can strip
 * the `action` field and pass remaining fields as payload — consistent with all
 * other action tool schemas.
 */
export const ProjectActionInputSchema = z.object({
  action: z.enum(['init', 'status']).optional().describe(
    'Action to perform. init=create new project (needs: projectName, endState). status=show project overview.'
  ),
  projectName: z.string().min(1).max(100).optional().describe('Project name (init)'),
  endState: z.string().min(1).optional().describe('Project end state description (init)'),
}).superRefine((data, ctx) => {
  if (data.action === 'init') {
    if (!data.projectName) {
      ctx.addIssue({
        code: 'custom',
        path: ['projectName'],
        message: 'projectName is required for init action',
      })
    }
    if (!data.endState) {
      ctx.addIssue({
        code: 'custom',
        path: ['endState'],
        message: 'endState is required for init action',
      })
    }
  }
})

export type ProjectActionInput = z.infer<typeof ProjectActionInputSchema>

/**
 * Output schemas for each action
 */
export const ProjectInitOutputSchema = z.object({
  success: z.boolean(),
  projectName: z.string().optional(),
  message: z.string().optional(),
  gatesGenerated: z.number().int().min(0).optional(),
  requirementsGenerated: z.number().int().min(0).optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
})

export const ProjectStatusOutputSchema = z.object({
  activeGates: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
  })),
  completedGates: z.array(z.string()),
  requirements: z.object({
    total: z.number().int().min(0),
    byPriority: z.object({
      must: z.number().int().min(0),
      should: z.number().int().min(0),
      could: z.number().int().min(0),
      wont: z.number().int().min(0),
    }),
    byLevel: z.object({
      project: z.number().int().min(0),
      gate: z.number().int().min(0),
    }),
  }),
  proposals: z.object({
    total: z.number().int().min(0),
    byStatus: z.object({
      pending: z.number().int().min(0),
      validated: z.number().int().min(0),
      approved: z.number().int().min(0),
      in_progress: z.number().int().min(0),
      completed: z.number().int().min(0),
      rejected: z.number().int().min(0),
    }),
  }),
  mcp: z.object({
    status: z.string(),
    toolsRegistered: z.number().int().min(0),
    configLoaded: z.boolean(),
  }),
})

/**
 * Unified output schema — discriminated union on `action` wrapping `result`.
 * Matches the envelope produced by createEntityActionHandler: { action, result }.
 */
export const ProjectActionOutputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('init'), result: ProjectInitOutputSchema }),
  z.object({ action: z.literal('status'), result: ProjectStatusOutputSchema }),
])

export type ProjectActionOutput = z.infer<typeof ProjectActionOutputSchema>
