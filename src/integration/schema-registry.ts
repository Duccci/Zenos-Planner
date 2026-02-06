/**
 * Repository & Architecture & Analysis Operations Registry
 *
 * Consolidated registry for repository, architecture, and analysis operations
 * to keep related operations together.
 *
 * Handles:
 *   - Repository: repos_list, repos_deps, repos_detect, repos_adjust
 *   - Architecture: arch_generate, arch_show
 *   - Analysis: analyze, show, metrics, git_trace
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { invokeCommand } from './command-invoker.js'
import { parseCommitsForHashes } from '../utils/git.js'
import { GitTraceInputSchema, GitTraceOutputSchema } from '../mcp/schemas/git-trace-schemas.js'

export function registerRepositoryOps(registry: FunctionRegistry): void {
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
}

export function registerArchitectureOps(registry: FunctionRegistry): void {
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
}

export function registerAnalysisOps(registry: FunctionRegistry): void {
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

  registry.register('git_trace', async (params) => {
    const validated = GitTraceInputSchema.parse(params)
    
    const commits = await parseCommitsForHashes(
      validated.artifactHash,
      {
        dateRange: validated.dateRange,
        branch: validated.branch,
        limit: validated.limit
      },
      validated.dir
    )

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
}
