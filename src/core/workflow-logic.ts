/**
 * Workflow Logic Orchestrator
 *
 * Central coordinator for Zeno's three main workflows:
 * - Proposal Generation (zeno-proposal)
 * - Proposal Application/Implementation (zeno-apply)
 * - Gate Generation (zeno-gate)
 *
 * Delegates to focused workflow modules for clarity and maintainability.
 */

// Proposal Generation Workflow
export {
  generateProposals,
  type ProposalGenerateInput,
  type ProposalGenerateOutput
} from './proposal-generation.js'

// Proposal Application Workflow
export {
  updateProposalProgress,
  type ProposalUpdateProgressInput,
  type ProposalUpdateProgressOutput
} from './proposal-application.js'

// Gate Generation Workflow
export {
  generateGates,
  type GateGenerateInput,
  type GateGenerateOutput
} from './gate-generation.js'

// Implementations for `updateProposalProgress` and `generateGates` live in their respective modules
// (`proposal-application.ts` and `gate-generation.ts`). Keeping `workflow-logic.ts` as orchestrator
// that re-exports those implementations to avoid duplicate exports and preserve a single source of truth.


// Helper functions (moved to workflow modules) - removed from orchestrator


