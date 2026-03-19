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
import { registerConfigOps } from './config-registry.js'
import { registerTemplateOps } from './template-registry.js'
import { registerWorkflowOps } from './workflow-registry.js'
import {
  registerRepositoryOps,
  registerArchitectureOps,
  registerAnalysisOps,
} from './schema-registry.js'
import { registerContextOps } from './context-registry.js'
import { registerProjectOps } from './project-registry.js'

/**
 * Create and return a fully initialized function registry
 *
 * Delegates to domain-specific registrars in dependency order:
 *  1. Config (used by other registries)
 *  2. Gates (base entity)
 *  3. Proposals (core workflow)
 *  4. Requirements (core workflow)
 *  5. Workflow (meta-operations)
 *  6. Repository/Architecture/Analysis (cross-cutting)
 *  7. Template (utility)
 */
export function createFunctionRegistry(): FunctionRegistry {
  const registry = new FunctionRegistry()

  // Register all operations in dependency order
  registerConfigOps(registry)
  registerGatesOps(registry)
  registerProposalsOps(registry)
  registerRequirementsOps(registry)
  registerWorkflowOps(registry)
  registerRepositoryOps(registry)
  registerArchitectureOps(registry)
  registerAnalysisOps(registry)
  registerContextOps(registry)
  registerProjectOps(registry)
  registerTemplateOps(registry)

  logger.debug(`Function registry initialized with ${String(registry.list().length)} functions`)

  return registry
}

/** Process-wide singleton; `null` until first call to {@link getGlobalRegistry}. */
let globalRegistry: FunctionRegistry | null = null

/**
 * Return the process-wide singleton {@link FunctionRegistry}, creating it on
 * first call via {@link createFunctionRegistry}.
 *
 * Node.js is single-threaded, so no synchronisation is needed.  The singleton
 * is reset to `null` only in tests that call `vi.resetModules()` or clear the
 * module cache between test cases.
 *
 * @returns The shared {@link FunctionRegistry} instance.
 */
export function getGlobalRegistry(): FunctionRegistry {
  globalRegistry ??= createFunctionRegistry()
  return globalRegistry
}
