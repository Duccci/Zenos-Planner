/**
 * Function Implementations Orchestrator
 *
 * Central orchestration module that coordinates registration of all Zeno CLI
 * operations through domain-specific registries. This provides the single
 * source of truth for all available functions.
 *
 * Domain registries:
 *   - Gates: gate lifecycle operations
 *   - Proposals: proposal management and approval workflow
 *   - Requirements: requirement tracking and dependencies
 *   - Archive: archival and consolidation of completed work
 *   - Config: configuration access
 *   - Template: template management
 *   - Workflow: proposal and gate generation workflows
 *   - Repository/Architecture/Analysis: cross-cutting analysis operations
 */

import { FunctionRegistry } from './function-registry.js'
import { logger } from '../utils/logger.js'
import { registerGatesOps } from './gates-registry.js'
import { registerProposalsOps } from './proposals-registry.js'
import { registerRequirementsOps } from './requirements-registry.js'
import { registerArchiveOps } from './archive-registry.js'
import { registerConfigOps } from './config-registry.js'
import { registerTemplateOps } from './template-registry.js'
import { registerWorkflowOps } from './workflow-registry.js'
import { 
  registerRepositoryOps, 
  registerArchitectureOps, 
  registerAnalysisOps 
} from './schema-registry.js'

/**
 * Create and return a fully initialized function registry
 *
 * Delegates to domain-specific registrars in dependency order:
 *  1. Config (used by other registries)
 *  2. Gates (base entity)
 *  3. Archive (depends on gates)
 *  4. Proposals (core workflow)
 *  5. Requirements (core workflow)
 *  6. Workflow (meta-operations)
 *  7. Repository/Architecture/Analysis (cross-cutting)
 *  8. Template (utility)
 */
export function createFunctionRegistry(): FunctionRegistry {
  const registry = new FunctionRegistry()

  // Register all operations in dependency order
  registerConfigOps(registry)
  registerGatesOps(registry)
  registerArchiveOps(registry)
  registerProposalsOps(registry)
  registerRequirementsOps(registry)
  registerWorkflowOps(registry)
  registerRepositoryOps(registry)
  registerArchitectureOps(registry)
  registerAnalysisOps(registry)
  registerTemplateOps(registry)

  logger.debug(`Function registry initialized with ${registry.list().length} functions`)

  return registry
}

/**
 * Global singleton instance
 */
let globalRegistry: FunctionRegistry | null = null

/**
 * Get or create the global function registry
 */
export function getGlobalRegistry(): FunctionRegistry {
  if (!globalRegistry) {
    globalRegistry = createFunctionRegistry()
  }
  return globalRegistry
}

