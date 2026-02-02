/**
 * Function Implementations Registry
 *
 * Creates a function registry instance and registers all Zeno CLI operations
 * as invokable functions with proper validation schemas and error handling.
 * This serves as the single source of truth for all Zeno operations.
 *
 * Note: Current implementation uses command invocation for actual operations.
 * Task 4 will refactor CLI commands to extract internal implementations and
 * delegate to the registry for true single-source-of-truth architecture.
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { invokeCommand } from './command-invoker.js'
import { logger } from '../utils/logger.js'
import { loadConfig } from '../utils/config.js'
import { parseCommitsForHashes } from '../utils/git.js'
import { GitTraceInputSchema, GitTraceOutputSchema } from '../mcp/schemas/git-trace-schemas.js'

/**
 * Create and return a fully initialized function registry
 *
 * Registers all Zeno operations with proper validation.
 * This will be the single source of truth once Task 4 refactors
 * the CLI to delegate to the registry.
 */
export function createFunctionRegistry(): FunctionRegistry {
  const registry = new FunctionRegistry()

  // ============================================================================
  // GATE OPERATIONS
  // ============================================================================

  registry.register('gates_list', async () => {
    const result = await invokeCommand('gates_list')
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'List all gates in the project with their status',
    parameters: [],
    returnType: 'Gate[]',
    schema: z.object({})
  })

  registry.register('gates_show', async (params) => {
    const validated = z.object({ gateId: z.string() }).parse(params)
    const result = await invokeCommand('gates_show', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Show detailed information about a specific gate',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'The ID of the gate to show (e.g., "gate-01")',
        required: true
      }
    ],
    returnType: 'GateDetails',
    schema: z.object({
      gateId: z.string().min(1, 'Gate ID is required')
    })
  })

  registry.register('gates_start', async (params) => {
    const validated = z.object({ gateId: z.string() }).parse(params)
    const result = await invokeCommand('gates_start', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Start working on a gate (changes status from pending to in_progress)',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'The ID of the gate to start',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      gateId: z.string().min(1, 'Gate ID is required')
    })
  })

  registry.register('gates_complete', async (params) => {
    const validated = z.object({ gateId: z.string() }).parse(params)
    const result = await invokeCommand('gates_complete', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Mark a gate as completed and create a release tag',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'The ID of the gate to complete',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      gateId: z.string().min(1, 'Gate ID is required')
    })
  })

  registry.register('gates_regenerate', async () => {
    const result = await invokeCommand('gates_regenerate')
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Regenerate future gates based on current project state',
    parameters: [],
    returnType: 'void',
    schema: z.object({})
  })

  // ============================================================================
  // REQUIREMENT OPERATIONS
  // ============================================================================

  registry.register('req_list', async (params) => {
    const validated = z.object({
      gateId: z.string().optional(),
      project: z.boolean().optional()
    }).parse(params)
    const result = await invokeCommand('req_list', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'List requirements, optionally filtered by gate or project-wide',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'Optional gate ID to filter requirements',
        required: false
      },
      {
        name: 'project',
        type: 'boolean',
        description: 'If true, list project-level requirements only',
        required: false
      }
    ],
    returnType: 'Requirement[]',
    schema: z.object({
      gateId: z.string().optional(),
      project: z.boolean().optional()
    })
  })

  registry.register('req_show', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('req_show', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Show detailed information about a specific requirement',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the requirement',
        required: true
      }
    ],
    returnType: 'RequirementDetails',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  registry.register('req_deps', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('req_deps', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Show dependency graph for a requirement',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the requirement',
        required: true
      }
    ],
    returnType: 'DependencyGraph',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })



  registry.register('req_transfer', async (params) => {
    const validated = z.object({
      hash: z.string(),
      gateId: z.string()
    }).parse(params)
    const result = await invokeCommand('req_transfer', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Transfer a requirement to another gate',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the requirement',
        required: true
      },
      {
        name: 'gateId',
        type: 'string',
        description: 'The target gate ID',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required'),
      gateId: z.string().min(1, 'Gate ID is required')
    })
  })

  // ============================================================================
  // PROPOSAL OPERATIONS
  // ============================================================================

  registry.register('proposal_list', async (params) => {
    const validated = z.object({
      gateId: z.string().optional(),
      status: z.string().optional()
    }).parse(params)
    const result = await invokeCommand('proposal_list', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'List proposals, optionally filtered by gate or status',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'Optional gate ID to filter proposals',
        required: false
      },
      {
        name: 'status',
        type: 'string',
        description: 'Optional status filter: pending, in_progress, completed, rejected',
        required: false
      }
    ],
    returnType: 'Proposal[]',
    schema: z.object({
      gateId: z.string().optional(),
      status: z.string().optional()
    })
  })

  registry.register('proposal_show', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('proposal_show', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Show detailed information about a specific proposal',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'ProposalDetails',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  registry.register('proposal_start', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('proposal_start', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Start implementation of a proposal (status: pending -> in_progress)',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  registry.register('proposal_validate', async (params) => {
    const validated = z.object({ hash: z.string(), strict: z.boolean().optional() }).parse(params)
    const result = await invokeCommand('proposal_validate', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Run automated validation checks on a proposal',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      },
      {
        name: 'strict',
        type: 'boolean',
        description: 'Treat warnings as errors and fail validation',
        required: false
      }
    ],
    returnType: 'ValidationResult',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required'),
      strict: z.boolean().optional()
    })
  })

  registry.register('proposal_approve', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('proposal_approve', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Approve a completed proposal (status: in_progress -> completed)',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  registry.register('proposal_reject', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('proposal_reject', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Reject a proposal (status: in_progress -> rejected)',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  // ============================================================================
  // REPOSITORY OPERATIONS
  // ============================================================================

  registry.register('repos_list', async () => {
    const result = await invokeCommand('repos_list')
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'List all detected repositories in the project',
    parameters: [],
    returnType: 'Repository[]',
    schema: z.object({})
  })

  registry.register('repos_deps', async () => {
    const result = await invokeCommand('repos_deps')
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Show cross-repository dependencies',
    parameters: [],
    returnType: 'DependencyGraph',
    schema: z.object({})
  })

  registry.register('repos_detect', async () => {
    const result = await invokeCommand('repos_detect')
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Re-run repository boundary detection',
    parameters: [],
    returnType: 'void',
    schema: z.object({})
  })

  registry.register('repos_adjust', async (params) => {
    const validated = z.object({
      repoId: z.string(),
      boundary: z.string()
    }).parse(params)
    const result = await invokeCommand('repos_adjust', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Manually adjust repository boundaries',
    parameters: [
      {
        name: 'repoId',
        type: 'string',
        description: 'The repository ID to adjust',
        required: true
      },
      {
        name: 'boundary',
        type: 'string',
        description: 'The new boundary path',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      repoId: z.string().min(1, 'Repository ID is required'),
      boundary: z.string().min(1, 'Boundary is required')
    })
  })

  // ============================================================================
  // ARCHITECTURE OPERATIONS
  // ============================================================================

  registry.register('arch_generate', async () => {
    const result = await invokeCommand('arch_generate')
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Generate all architecture diagrams for the project',
    parameters: [],
    returnType: 'void',
    schema: z.object({})
  })

  registry.register('arch_show', async (params) => {
    const validated = z.object({ type: z.string() }).parse(params)
    const result = await invokeCommand('arch_show', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Show a specific type of architecture diagram',
    parameters: [
      {
        name: 'type',
        type: 'string',
        description: 'Diagram type: system, lifecycle, flow, gate-roadmap',
        required: true
      }
    ],
    returnType: 'Diagram',
    schema: z.object({
      type: z.string().min(1, 'Diagram type is required')
    })
  })

  // ============================================================================
  // ANALYSIS OPERATIONS
  // ============================================================================

  registry.register('analyze', async (params) => {
    const validated = z.object({ path: z.string().optional() }).parse(params)
    const result = await invokeCommand('analyze', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Deep analysis of codebase structure and dependencies',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Optional path to analyze (defaults to current directory)',
        required: false
      }
    ],
    returnType: 'AnalysisResult',
    schema: z.object({
      path: z.string().optional()
    })
  })

  registry.register('show', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('show', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Resolve a hash to its entity details',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier to resolve',
        required: true
      }
    ],
    returnType: 'EntityDetails',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  registry.register('metrics', async (params) => {
    const validated = z.object({ path: z.string().optional() }).parse(params)
    const result = await invokeCommand('metrics', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Get code metrics for project or specified path',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Optional path to analyze (defaults to current directory)',
        required: false
      }
    ],
    returnType: 'MetricsResult',
    schema: z.object({
      path: z.string().optional()
    })
  })

  // ============================================================================
  // TEMPLATE OPERATIONS
  // ============================================================================

  registry.register('template_list', async () => {
    const result = await invokeCommand('template_list')
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'List all available templates',
    parameters: [],
    returnType: 'Template[]',
    schema: z.object({})
  })

  registry.register('template_get', async (params) => {
    const validated = z.object({ name: z.string() }).parse(params)
    const result = await invokeCommand('template_get', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Get template content by name',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Template name to retrieve',
        required: true
      }
    ],
    returnType: 'string',
    schema: z.object({
      name: z.string().min(1, 'Template name is required')
    })
  })

  registry.register('template_context', async (params) => {
    const validated = z.object({ name: z.string() }).parse(params)
    const result = await invokeCommand('template_context', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Get template with contextual metadata for LLM usage',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Template name to retrieve',
        required: true
      }
    ],
    returnType: 'TemplateContext',
    schema: z.object({
      name: z.string().min(1, 'Template name is required')
    })
  })

  // ============================================================================
  // CONFIGURATION OPERATIONS
  // ============================================================================

  registry.register('config_get', async () => {
    const result = await loadConfig()
    return result
  }, {
    description: 'Get project configuration values',
    parameters: [],
    returnType: 'ZenoConfig',
    schema: z.object({})
  })

  // ============================================================================
  // GIT TRACEABILITY
  // ============================================================================

  registry.register('git_trace', async (params) => {
    const validated = GitTraceInputSchema.parse(params)
    
    // Call git parsing function
    const commits = await parseCommitsForHashes(
      validated.artifactHash,
      {
        dateRange: validated.dateRange,
        branch: validated.branch,
        limit: validated.limit
      },
      validated.dir
    )

    // Format output
    const result: z.infer<typeof GitTraceOutputSchema> = {
      commits,
      totalCommits: commits.length,
      searchParams: {
        artifactHash: validated.artifactHash,
        dateRange: validated.dateRange,
        branch: validated.branch,
        limit: validated.limit
      }
    }

    return GitTraceOutputSchema.parse(result)
  }, {
    description: 'Trace git commits referencing a specific artifact hash with confidence scoring',
    parameters: [
      {
        name: 'artifactHash',
        type: 'string',
        description: 'Artifact hash to trace in git history',
        required: true
      },
      {
        name: 'dateRange',
        type: 'object',
        description: 'Optional date range for filtering commits',
        required: false
      },
      {
        name: 'branch',
        type: 'string',
        description: 'Optional branch to search',
        required: false
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Optional limit on number of commits to return',
        required: false
      }
    ],
    returnType: 'GitTraceOutput',
    schema: GitTraceInputSchema
  })

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
