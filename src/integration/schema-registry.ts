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
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function safeToString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message
  try {
    if (value == null) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    if (typeof value === 'symbol') return value.toString()
    if (typeof value === 'function') return '[function]'
    return String(value as number | boolean | bigint)
  } catch {
    return ''
  }
}

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
      const prdPath = join(projectRoot, 'zeno', 'overview', 'PROJECT_PRD.md')
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
        const metadata: Record<string, unknown> = context.metadata ?? {}
        metadata['technicalDecisions'] = decisions
        context.metadata = metadata
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
        status: gate.status as 'pending' | 'validated' | 'in_progress' | 'completed' | 'rejected'
      }))

      // Add metadata about gate progress (use a typed local metadata object)
      const implementedCount = allGates.filter((g) => g.status === 'completed').length
      const gateMetadata: Record<string, unknown> = context.metadata ?? {}
      gateMetadata['targetGateCount'] = allGates.length
      gateMetadata['implementedGateCount'] = implementedCount
      context.metadata = gateMetadata
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
      throw new Error(result.error ?? 'repos_list failed')
    }
    try {
      const parsed = JSON.parse(result.output) as unknown
      if (parsed && typeof parsed === 'object' && 'repositories' in parsed) {
        return parsed
      }
      const repos = Array.isArray(parsed) ? parsed : []
      return {
        repositories: repos,
      }
    } catch {
      return {
        repositories: [],
      }
    }
  }, {
    description: 'List all detected repositories in the project',
    parameters: [],
    returnType: 'ReposListOutput',
    schema: z.object({})
  })

  registry.register('repos_deps', async (params) => {
    const validated = z.object({ repositoryId: z.string().optional() }).parse(params)
    const result = await invokeCommand('repos_deps', validated)
    if (!result.success) {
      throw new Error(result.error ?? 'repos_deps failed')
    }
    try {
      const parsed = JSON.parse(result.output) as unknown
      if (parsed && typeof parsed === 'object' && 'repositories' in parsed) {
        return parsed
      }
      return { repositories: [], edges: [] }
    } catch {
      return { repositories: [], edges: [] }
    }
  }, {
    description: 'Show cross-repository dependencies',
    parameters: [],
    returnType: 'RepositoryDependencyGraph',
    schema: z.object({})
  })

  registry.register('repos_detect', async () => {
    const result = await invokeCommand('repos_detect')
    if (!result.success) {
      throw new Error(result.error ?? 'repos_detect failed')
    }
    try {
      const parsed = JSON.parse(result.output) as unknown
      if (parsed && typeof parsed === 'object' && 'detected' in parsed) {
        return parsed
      }
    } catch {
      // fall through to default
    }
    return {
      detected: [],
      summary: 'Detection completed',
    }
  }, {
    description: 'Re-run repository boundary detection',
    parameters: [],
    returnType: 'ReposDetectOutput',
    schema: z.object({}).strict()
  })

  registry.register('repos_adjust', async (params) => {
    const validated = z.object({
      repoId: z.string(),
      boundary: z.string(),
    }).parse(params)
    const result = await invokeCommand('repos_adjust', validated)
    if (!result.success) {
      throw new Error(result.error ?? 'repos_adjust failed')
    }
    return {
      repoId: validated.repoId,
      boundary: validated.boundary,
      status: 'adjusted',
    }
  }, {
    description: 'Manually adjust repository boundaries',
    parameters: [
      { name: 'repoId', type: 'string', description: 'Repository ID', required: true },
      { name: 'boundary', type: 'string', description: 'New boundary path', required: true },
    ],
    returnType: 'ReposAdjustOutput',
    schema: z.object({
      repoId: z.string(),
      boundary: z.string(),
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

    // Persist each diagram to zeno/architecture/<type>.md so arch_show and
    // subsequent MCP calls can read from disk instead of re-generating.
    // Graphviz diagrams: write .dot + .svg sidecars to dot-diagrams/ and reference
    // via <img> in the .md (avoids VS Code DOMPurify stripping SVG transform attrs).
    const archDir = join(process.cwd(), 'zeno', 'architecture')
    const dotDiagramsDir = join(archDir, 'dot-diagrams')
    mkdirSync(archDir, { recursive: true })
    const written: string[] = []
    for (const r of results) {
      if (r.svgContent && r.dotSource) {
        // Graphviz diagram — write sidecars, .md holds only the <img> reference
        mkdirSync(dotDiagramsDir, { recursive: true })
        const dotSource = safeToString(r.dotSource)
        const svgContent = safeToString(r.svgContent)
        writeFileSync(join(dotDiagramsDir, `${r.diagramType}.dot`), dotSource, 'utf-8')
        writeFileSync(join(dotDiagramsDir, `${r.diagramType}.svg`), svgContent, 'utf-8')
      }
      const filePath = join(archDir, `${r.diagramType}.md`)
      const markdown = safeToString(r.markdown)
      writeFileSync(filePath, markdown, 'utf-8')
      written.push(filePath)
    }

    return {
      diagrams: results.map((r) => ({
        type: r.diagramType,
        category: r.category,
        format: r.renderingBackend,
        generated: true,
        content: r.markdown,
        filePath: join('zeno', 'architecture', `${r.diagramType}.md`),
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

    // Read from persisted file first (written by arch_generate); re-generate if missing.
    const archFile = join(process.cwd(), 'zeno', 'architecture', `${diagramType}.md`)
    if (existsSync(archFile)) {
      const content = readFileSync(archFile, 'utf-8')
      const format = content.includes('dot-diagrams/') || content.includes('<svg') ? 'graphviz' : 'mermaid'
      return {
        type: diagramType,
        title: entry?.name ?? diagramType,
        content,
        format,
        found: true,
        filePath: join('zeno', 'architecture', `${diagramType}.md`),
      }
    }

    const output = await generator.generate(context)

    // Persist freshly generated diagram for future reads
    const archDir = join(process.cwd(), 'zeno', 'architecture')
    const dotDiagramsDir = join(archDir, 'dot-diagrams')
    mkdirSync(archDir, { recursive: true })
    if (output.svgContent && output.dotSource) {
      mkdirSync(dotDiagramsDir, { recursive: true })
      const dotSourceOut = safeToString(output.dotSource)
      const svgContentOut = safeToString(output.svgContent)
      writeFileSync(join(dotDiagramsDir, `${diagramType}.dot`), dotSourceOut, 'utf-8')
      writeFileSync(join(dotDiagramsDir, `${diagramType}.svg`), svgContentOut, 'utf-8')
    }
    const markdownOut = safeToString(output.markdown)
    writeFileSync(archFile, markdownOut, 'utf-8')

    return {
      type: diagramType,
      title: entry?.name ?? diagramType,
      content: output.markdown,
      format: output.renderingBackend,
      found: true,
      filePath: join('zeno', 'architecture', `${diagramType}.md`),
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
    // Return the diagram type catalogue with metadata matching ArchDiagramCatalogueOutputSchema
    const diagrams = [
      // Core diagrams
      {
        type: 'system-overview',
        category: 'core' as const,
        name: 'System Overview',
        description: 'Component relationships and module structure',
        whenUseful: 'Always — provides top-level component view',
        templatePath: 'templates/architecture-templates/system-overview.md',
        alwaysGenerated: true,
      },
      {
        type: 'data-flow',
        category: 'core' as const,
        name: 'Data Flow',
        description: 'End-to-end data processing paths',
        whenUseful: 'Always — shows how data moves through the system',
        templatePath: 'templates/architecture-templates/data-flow.md',
        alwaysGenerated: true,
      },
      {
        type: 'gate-roadmap',
        category: 'core' as const,
        name: 'Gate Roadmap',
        description: 'Gate structure and parallel relationships',
        whenUseful: 'Always — visualises project milestones',
        templatePath: 'templates/architecture-templates/gate-roadmap.md',
        alwaysGenerated: true,
      },
      {
        type: 'lifecycle',
        category: 'core' as const,
        name: 'Gate Lifecycle',
        description: 'State machine for gate workflow',
        whenUseful: 'Always — shows gate state transitions',
        templatePath: 'templates/architecture-templates/lifecycle.md',
        alwaysGenerated: true,
      },
      {
        type: 'context',
        category: 'core' as const,
        name: 'Context Diagram',
        description: 'System boundary and external dependencies',
        whenUseful: 'Always — shows external system integrations',
        templatePath: 'templates/architecture-templates/context.md',
        alwaysGenerated: true,
      },
      // Conditional diagrams
      {
        type: 'sequence',
        category: 'conditional' as const,
        name: 'Sequence Diagram',
        description: 'Temporal interactions for complex workflows',
        whenUseful: 'When complex multi-step interactions exist between components',
        templatePath: 'templates/architecture-templates/sequence.md',
        alwaysGenerated: false,
      },
      {
        type: 'component',
        category: 'conditional' as const,
        name: 'Component Diagram',
        description: 'Detailed module structure for complex components',
        whenUseful: 'When components have many internal parts worth documenting',
        templatePath: 'templates/architecture-templates/component.md',
        alwaysGenerated: false,
      },
      {
        type: 'package',
        category: 'conditional' as const,
        name: 'Package Diagram',
        description: 'Code organization and module dependencies',
        whenUseful: 'When package/module structure is complex',
        templatePath: 'templates/architecture-templates/package.md',
        alwaysGenerated: false,
      },
      {
        type: 'deployment',
        category: 'conditional' as const,
        name: 'Deployment Diagram',
        description: 'Runtime infrastructure and deployment topology',
        whenUseful: 'When deploying to cloud infrastructure or multiple environments',
        templatePath: 'templates/architecture-templates/deployment.md',
        alwaysGenerated: false,
      },
      {
        type: 'network',
        category: 'conditional' as const,
        name: 'Network Diagram',
        description: 'Network topology and communication patterns',
        whenUseful: 'When network configuration is a critical architecture concern',
        templatePath: 'templates/architecture-templates/network.md',
        alwaysGenerated: false,
      },
    ]
    const coreCount = diagrams.filter((d) => d.category === 'core').length
    const conditionalCount = diagrams.filter((d) => d.category === 'conditional').length
    return {
      diagrams,
      totalDiagrams: diagrams.length,
      coreCount,
      conditionalCount,
    }
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

    // Core diagrams are always included alongside selected conditional ones
    const CORE_TYPES = ['system-overview', 'data-flow', 'gate-roadmap', 'lifecycle', 'context']
    const selectedConditional = validated.diagramTypes.filter((t) => !CORE_TYPES.includes(t))
    const selected = [...CORE_TYPES, ...selectedConditional]

    return {
      gateHash: validated.gateHash,
      selected,
      totalSelected: selected.length,
      coreCount: CORE_TYPES.length,
      conditionalCount: selectedConditional.length,
      ready: true,
      timestamp: new Date().toISOString(),
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
