import { z } from 'zod'
import { GateIdSchema } from './common-schemas.js'
import { PreReviewSummarySchema } from './pre-review-schemas.js'

// PROPOSAL_GENERATE - Generate proposal documents from a gate PRD
export const ProposalGenerateInputSchema = z.object({
  gateId: GateIdSchema,
  templateName: z.string().optional().default('proposal-template'),
  outputDir: z.string().optional()
})

export type ProposalGenerateInput = z.infer<typeof ProposalGenerateInputSchema>

export const ProposalGenerateOutputSchema = z.object({
  success: z.boolean(),
  gateId: GateIdSchema,
  proposalsGenerated: z.number().int().min(0),
  proposals: z.array(z.object({
    hash: z.string(),
    filename: z.string(),
    path: z.string(),
    type: z.enum(['gate-tied', 'solitary']),
    status: z.string(),
    summary: z.string()
  })),
  dependencies: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.string()
  })).optional(),
  message: z.string(),
  /** Pre-review audit trail: echoes back agent-reported pre-review values for user verification */
  preReviewSummary: PreReviewSummarySchema.optional(),
})

export type ProposalGenerateOutput = z.infer<typeof ProposalGenerateOutputSchema>

// PROPOSAL_UPDATE_PROGRESS - Update proposal task progress during implementation
export const ProposalUpdateProgressInputSchema = z.object({
  hash: z.string(),
  taskIndex: z.number().int().min(0),
  completed: z.boolean(),
  notes: z.string().optional()
})

export type ProposalUpdateProgressInput = z.infer<typeof ProposalUpdateProgressInputSchema>

export const ProposalUpdateProgressOutputSchema = z.object({
  success: z.boolean(),
  hash: z.string(),
  taskIndex: z.number().int().min(0),
  completed: z.boolean(),
  completionSummary: z.object({
    tasksCompleted: z.number().int().min(0),
    tasksTotal: z.number().int().min(0),
    filesModified: z.number().int().min(0),
    testCoverage: z.number().min(0).max(100).optional(),
    qualityMetrics: z.object({
      coverage: z.number().min(0).max(100),
      security: z.number().int().min(0),
      lintErrors: z.number().int().min(0),
      typeErrors: z.number().int().min(0)
    }).optional()
  }).optional(),
  message: z.string(),
  /** Progress audit trail: current task, cumulative files modified, remaining files */
  progressSummary: z.object({
    currentTask: z.number().int().min(1),
    cumulativeFilesModified: z.array(z.string()),
    remainingFilesNotTouched: z.array(z.string()),
  }).optional(),
})

export type ProposalUpdateProgressOutput = z.infer<typeof ProposalUpdateProgressOutputSchema>

// GATE_GENERATE - Generate or regenerate gates from project requirements
export const GateGenerateInputSchema = z.object({
  mode: z.enum(['new', 'rebaseline', 'single']).default('new'),
  anchorGateId: GateIdSchema.optional(),
  templateName: z.string().optional().default('gate-prd-template'),
  requirementsPerGate: z.number().int().min(1).max(10).default(5)
})

export type GateGenerateInput = z.infer<typeof GateGenerateInputSchema>

export const GateGenerateOutputSchema = z.object({
  success: z.boolean(),
  mode: z.string(),
  gatesGenerated: z.number().int().min(0),
  gates: z.array(z.object({
    id: GateIdSchema,
    name: z.string(),
    type: z.string(),
    status: z.string(),
    requirementsCount: z.number().int().min(0),
    dependencies: z.array(z.string())
  })),
  requirementsAttributed: z.number().int().min(0),
  diagramsUpdated: z.array(z.string()),
  message: z.string(),
  /** Pre-review audit trail: echoes back agent-reported pre-review values for user verification */
  preReviewSummary: PreReviewSummarySchema.optional(),
})

export type GateGenerateOutput = z.infer<typeof GateGenerateOutputSchema>