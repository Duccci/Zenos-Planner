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
import { DiagramSelector } from '../generation/diagram-selector.js'
import type { DiagramContext } from '../generation/diagram-generator-base.js'
import { isValidDiagramType, getCatalogueEntry } from '../generation/diagram-catalogue.js'
import { readProjectOverview, getGatesFromOverview } from '../utils/config.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Build comprehensive diagram context from project artifacts.
 * Reads PRD, gates, and project metadata to enable aspirational architecture generation.
 */
async function buildDiagramContext(): Promise<DiagramContext> {
  const context: DiagramContext = { projectName: 'Zeno\'s Planner' }

  try {
    const projectRoot = process.cwd()

    // Read PROJECT_PRD.md for aspirational vision
    try {
      const prdPath = join(projectRoot, 'zeno', 'PROJECT_PRD.md')
      const prdContent = readFileSync(prdPath, 'utf-8')
      context.prdContent = prdContent

      // Extract project description from PRD (first paragraph)
      const descMatch = /## Overview\s+([\s\S]*?)\n##/.exec(prdContent)
      if (descMatch?.[1]) {
        context.projectDescription = descMatch[1].trim()
      }

      // Extract key technical decisions for metadata
      const decisions: Record<string, string> = {}
      const decisionMatches = prdContent.matchAll(/### ([\d.]+)\.\s+(.+?)\n\n-\s+\*\*Choice\*\*:\s+(.+?)(?:\n\n|$)/g)
      for (const match of decisionMatches) {
        if (match[2] && match[3]) {
          decisions[match[2]] = match[3]
        }
      }
      if (Object.keys(decisions).length > 0) {
        context.metadata ??= {}
        context.metadata.technicalDecisions = decisions
      }
    } catch (e) {
      // PRD not found or read error - proceed with minimal context
      void e
    }

    // Read project overview for gate status
    try {
      const overview = await readProjectOverview(projectRoot)
      const allGates = getGatesFromOverview(overview)

      // Map gates to context format with proper status indicators
      context.gates = allGates.map((gate) => ({
        id: gate.id,
        number: gate.sequence,
        name: gate.name,
        status: gate.status as 'pending' | 'in_progress' | 'completed' | 'rejected'
      }))

      // Add metadata about gate progress
      context.metadata ??= {}
      const implementedCount = allGates.filter((g) => g.status === 'completed').length
      context.metadata.targetGateCount = allGates.length
      context.metadata.implementedGateCount = implementedCount
    } catch (e) {
      // Project overview not found - proceed with what we have
      void e
    }

    context.projectType = 'library' // Default; could be extracted from package.json
  } catch (error) {
    // Gracefully degrade if reading fails
    if (error instanceof Error) {
      console.warn(`Note: Could not fully load project context for aspirational diagrams: ${error.message}`)
    }
  }

  return context
}

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
  registry.register('arch_generate', async (params) => {
    // Direct in-process generation - avoids invokeCommand -> CLI -> registry recursion
    const validated = z.object({
      gateHash: z.string().optional(),
      diagramType: z.string().optional(),
    }).parse(params)

    // Build comprehensive context with PRD, gates, and project metadata
    // for aspirational architecture generation
    const context = await buildDiagramContext()

    const thresholds = { maxMermaidNodes: 50, maxMermaidEdges: 100, nestingDepthMultiplier: 1.5 }
    const selector = new DiagramSelector(thresholds)

    let generators = selector.selectCoreDiagrams()

    // If a specific type is requested, filter to just that one
    if (validated.diagramType) {
      generators = generators.filter((g) => g.getType() === validated.diagramType)
      // If not in core, try as a conditional type
      if (generators.length === 0) {
        const conditionals = selector.selectConditionalDiagrams(
          [validated.diagramType],
          validated.gateHash ?? 'default'
        )
        generators = conditionals
      }
    }

    const results = await Promise.all(generators.map((g) => g.generate(context)))

    return {
      diagrams: results.map((r) => ({
        type: r.diagramType,
        category: r.category,
        format: r.renderingBackend,
        generated: true,
      })),
      totalGenerated: results.length,
      timestamp: new Date().toISOString(),
      success: true,
    }
  }, {
    description: 'Generate all architecture diagrams for the project. Generates ASPIRATIONAL architecture based on PROJECT_PRD.md vision, not current implementation.',
    parameters: [
      { name: 'gateHash', type: 'string', description: 'Gate hash to scope generation', required: false },
      { name: 'diagramType', type: 'string', description: 'Single diagram type to generate', required: false },
    ],
    returnType: 'ArchDiagramGenerateOutput',
    schema: z.object({
      gateHash: z.string().optional(),
      diagramType: z.string().optional(),
    })
  })

  registry.register('arch_show', async (params) => {
    // Direct in-process retrieval - avoids invokeCommand -> CLI -> registry recursion
    const validated = z.object({
      type: z.string().min(1),
      gateHash: z.string().optional(),
    }).parse(params)

    const diagramType = validated.type
    if (!isValidDiagramType(diagramType)) {
      throw Object.assign(new Error(`Unknown diagram type: ${diagramType}`), { code: 'DIAGRAM_NOT_FOUND' })
    }

    const entry = getCatalogueEntry(diagramType)
    const context = await buildDiagramContext()
    const thresholds = { maxMermaidNodes: 50, maxMermaidEdges: 100, nestingDepthMultiplier: 1.5 }
    const selector = new DiagramSelector(thresholds)

    // Try core generators first, then conditional
    const coreGenerators = selector.selectCoreDiagrams()
    let generator = coreGenerators.find((g) => g.getType() === diagramType)
    if (!generator) {
      const conditionals = selector.selectConditionalDiagrams(
        [diagramType],
        validated.gateHash ?? 'default'
      )
      generator = conditionals[0]
    }

    if (!generator) {
      throw Object.assign(new Error(`Diagram type not available: ${diagramType}`), { code: 'DIAGRAM_NOT_FOUND' })
    }

    const output = await generator.generate(context)
    return {
      type: diagramType,
      title: entry?.name ?? diagramType,
      content: output.markdown,
      format: output.renderingBackend,
      found: true,
    }
  }, {
    description: 'Show a specific type of architecture diagram',
    parameters: [
      {
        name: 'type',
        type: 'string',
        description: 'Diagram type: system, lifecycle, flow, gate-roadmap',
        required: true
      },
      {
        name: 'gateHash',
        type: 'string',
        description: 'Optional gate hash for gate-scoped diagram',
        required: false
      }
    ],
    returnType: 'Diagram',
    schema: z.object({
      type: z.string().min(1, 'Diagram type is required'),
      gateHash: z.string().optional(),
    })
  })

  registry.register('arch_catalogue', () => {
    // Return the diagram type catalogue with metadata
    const catalogue = [
      // Core diagrams
      {
        type: 'system-overview',
        category: 'core',
        description: 'Component relationships and module structure',
      },
      {
        type: 'data-flow',
        category: 'core',
        description: 'End-to-end data processing paths',
      },
      {
        type: 'gate-roadmap',
        category: 'core',
        description: 'Gate structure and parallel relationships',
      },
      {
        type: 'lifecycle',
        category: 'core',
        description: 'State machine for gate workflow',
      },
      {
        type: 'context',
        category: 'core',
        description: 'System boundary and external dependencies',
      },
      // Conditional diagrams
      {
        type: 'sequence',
        category: 'conditional',
        description: 'Temporal interactions for complex workflows',
      },
      {
        type: 'component',
        category: 'conditional',
        description: 'Detailed module structure for complex components',
      },
      {
        type: 'package',
        category: 'conditional',
        description: 'Code organization and module dependencies',
      },
      {
        type: 'deployment',
        category: 'conditional',
        description: 'Runtime infrastructure and deployment topology',
      },
      {
        type: 'network',
        category: 'conditional',
        description: 'Network topology and communication patterns',
      },
    ]
    return catalogue
  }, {
    description: 'Get the complete catalogue of available architecture diagram types',
    parameters: [],
    returnType: 'DiagramCatalogue[]',
    schema: z.object({})
  })

  registry.register('arch_select', (params) => {
    const validated = z.object({
      gateHash: z.string().min(1, 'Gate hash is required'),
      diagramTypes: z.array(z.string()).min(1, 'At least one diagram type is required'),
      descriptors: z.record(z.string(), z.string()).optional()
    }).parse(params)
    
    // Store selection for the gate (this would normally persist to a file or database)
    // For now, just return a confirmation
    return {
      gateHash: validated.gateHash,
      selectedTypes: validated.diagramTypes,
      count: validated.diagramTypes.length,
      status: 'recorded'
    }
  }, {
    description: 'Record selected diagram types for a specific gate',
    parameters: [
      {
        name: 'gateHash',
        type: 'string',
        description: 'The hash of the gate to select diagrams for',
        required: true
      },
      {
        name: 'diagramTypes',
        type: 'string[]',
        description: 'Array of diagram type names to select',
        required: true
      },
      {
        name: 'descriptors',
        type: 'object',
        description: 'Optional custom descriptions for selected diagrams',
        required: false
      }
    ],
    returnType: 'void',
    schema: z.object({
      gateHash: z.string().min(1, 'Gate hash is required'),
      diagramTypes: z.array(z.string()).min(1, 'At least one diagram type is required'),
      descriptors: z.record(z.string(), z.string()).optional()
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
