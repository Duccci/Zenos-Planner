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
    summary: z.string(),
    phase: z.enum(['RED', 'GREEN']).optional(),
    coverageTarget: z.number().int().min(0).optional(),
  })),
  dependencies: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.string()
  })).optional(),
  message: z.string(),
  /**
   * Explicit notice that generated files are scaffold/skeleton proposals.
   * Prevents LLMs from incorrectly treating template placeholders as empty
   * files that should be removed.
   */
  scaffoldNotice: z.string().optional(),
  /**
   * Ordered list of concrete next steps the agent should take after generation.
   * Replaces ambiguous workflow guidance with actionable instructions.
   */
  nextSteps: z.array(z.string()).optional(),
  /**
   * Top-level objectives extracted from the gate PRD, as used for proposal decomposition.
   * One implementation proposal was generated per objective. Verify this list matches
   * the gate's major deliverables before filling in proposal content.
   */
  objectives: z.array(z.string()).optional(),
  /** Pre-review audit trail: echoes back agent-reported pre-review values for user verification */
  preReviewSummary: PreReviewSummarySchema.optional(),
})

export type ProposalGenerateOutput = z.infer<typeof ProposalGenerateOutputSchema>

export const ProposalRegenerateOutputSchema = z.object({
  success: z.boolean(),
  scope: z.enum(['single', 'all']),
  gateIds: z.array(GateIdSchema),
  gatesProcessed: z.number().int().min(0),
  proposalsGenerated: z.number().int().min(0),
  gates: z.array(ProposalGenerateOutputSchema),
  message: z.string(),
})

export type ProposalRegenerateOutput = z.infer<typeof ProposalRegenerateOutputSchema>

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
  /** File paths extracted from all fully-completed task sections in the proposal. */
  completedFiles: z.array(z.string()).optional(),
  /** True when the final progress update also transitioned the proposal to completed. */
  proposalCompleted: z.boolean().optional(),
  /** True when all tasks are complete and the gate's Proposal Status table was updated. */
  gateStatusUpdated: z.boolean().optional(),
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
