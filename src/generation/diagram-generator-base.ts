/**
 * Abstract Diagram Generator Base
 *
 * Provides the base class for all diagram generators. Handles complexity analysis,
 * rendering backend selection, and markdown wrapping, allowing subclasses to focus
 * on diagram content generation.
 */

import type {
  DiagramType,
  DiagramCategory,
  DiagramMetadata,
  RenderingBackend,
} from './diagram-types.js'
import { ComplexityAnalyzer } from './complexity-analyzer.js'
import { GraphvizRenderer } from './graphviz-renderer.js'
import { logger } from '../utils/logger.js'

/**
 * Context provided to diagram generators for content generation.
 *
 * IMPORTANT: Architecture diagrams must be ASPIRATIONAL, reflecting the target design
 * from PROJECT_PRD.md, not the current implementation. Diagrams show:
 * - Target architecture with all planned components (Gates 1-14)
 * - Implementation status indicators (🟢 done, 🟡 in-progress, 🔵 planned)
 * - Desired system boundaries and module organization
 *
 * Generators should read from PRD vision, gate descriptions, and requirements,
 * not from current code structure.
 */
export interface DiagramContext {
  /** Project name */
  projectName: string

  /** Full PRD content for reading aspirational architecture and vision */
  prdContent?: string

  /** Project type (e.g., 'library', 'cli-tool', 'service', 'framework') */
  projectType?: string

  /** Project description/overview from PRD */
  projectDescription?: string

  /** Current gate status (for progress indicators) */
  gates?: {
    id: string
    number: number
    name: string
    status: 'pending' | 'validated' | 'in_progress' | 'completed' | 'rejected'
    objectives?: string
  }[]

  /** Requirements for context and decomposition */
  requirements?: {
    id: string
    type: string
    status: string
    priority?: string
    gateId?: string
  }[]

  /** Existing diagrams for reference */
  existingDiagrams?: DiagramMetadata[]

  /** Project metadata for architecture decisions */
  metadata?: {
    targetGateCount?: number
    implementedGateCount?: number
    technicalDecisions?: Record<string, string>
  }
}

/**
 * Output from diagram generation, including both raw content and metadata
 */
export interface DiagramOutput {
  /** Markdown file content — for graphviz diagrams this contains an `<img>` reference to the sidecar SVG */
  markdown: string
  renderingBackend: RenderingBackend
  diagramType: DiagramType
  category: DiagramCategory
  filePath?: string
  /** Raw SVG content (graphviz only). Caller is responsible for writing to `dot-diagrams/<type>.svg`. */
  svgContent?: string
  /** DOT source used to produce the SVG (graphviz only). Caller is responsible for writing to `dot-diagrams/<type>.dot`. */
  dotSource?: string
}

/**
 * Abstract base class for all diagram generators.
 * Subclasses implement the content generation logic specific to their diagram type.
 */
export abstract class DiagramGeneratorBase {
  protected complexityAnalyzer: ComplexityAnalyzer

  constructor(complexityAnalyzer?: ComplexityAnalyzer) {
    this.complexityAnalyzer = complexityAnalyzer ?? new ComplexityAnalyzer()
  }

  /**
   * Get the diagram type (e.g., 'system-overview', 'sequence', 'component')
   */
  abstract getType(): DiagramType

  /**
   * Get the diagram category ('core' or 'conditional')
   */
  abstract getCategory(): DiagramCategory

  /**
   * Generate raw diagram content (Mermaid syntax or DOT syntax).
   * Returns the markup without markdown wrapper.
   */
  abstract generateContent(context: DiagramContext): string

  /**
   * Count nodes in the diagram content for complexity analysis.
   * Subclasses can override for more accurate counting.
   */
  protected countNodes(context: DiagramContext): number {
    return context.gates?.length ?? 0
  }

  /**
   * Count edges in the diagram content for complexity analysis.
   * Subclasses can override for more accurate counting.
   */
  protected countEdges(context: DiagramContext): number {
    return (context.gates?.length ?? 0) - 1
  }

  /**
   * Count nesting depth in the diagram content for complexity analysis.
   * Subclasses can override for more accurate counting.
   */
  protected countNestingDepth(_context: DiagramContext): number {
    return 1
  }

  /**
   * Main entry point: orchestrate complexity analysis, backend selection, and rendering.
   * Returns complete markdown output with metadata.
   *
   * If Graphviz is requested but unavailable, falls back to Mermaid with a warning.
   */
  async generate(
    context: DiagramContext,
    renderingBackend?: RenderingBackend
  ): Promise<DiagramOutput> {
    try {
      // Generate raw diagram content
      const content = this.generateContent(context)

      // Analyze complexity to determine appropriate rendering backend
      const nodeCount = this.countNodes(context)
      const edgeCount = this.countEdges(context)
      const nestingDepth = this.countNestingDepth(context)

      const score = this.complexityAnalyzer.score(nodeCount, edgeCount, nestingDepth)
      let selectedBackend = renderingBackend ?? this.complexityAnalyzer.selectBackend(score)

      // Check if Graphviz is available when requested; reuse renderer for rendering step
      const graphvizRenderer = new GraphvizRenderer()
      if (selectedBackend === 'graphviz') {
        const available = await graphvizRenderer.isAvailable()

        if (!available) {
          logger.warn(
            `Graphviz not available for diagram ${this.getType()}. Falling back to Mermaid. Run 'zeno arch setup-graphviz' for installation instructions.`
          )
          selectedBackend = 'mermaid'
        }
      }

      logger.debug(
        `Diagram ${this.getType()}: nodes=${String(nodeCount)}, edges=${String(edgeCount)}, depth=${String(nestingDepth)}, complexity=${String(score.totalScore)}, backend=${selectedBackend}`
      )

      let markdown: string
      let svgContent: string | undefined
      let dotSource: string | undefined
      if (selectedBackend === 'graphviz') {
        // Render DOT syntax to SVG. Write sidecar files (caller's responsibility).
        // Reference the SVG via <img> instead of embedding inline — VS Code's DOMPurify
        // strips `transform` attributes from inline SVG, pushing content out of viewport.
        try {
          const svg = await graphvizRenderer.renderToSvg(content)
          svgContent = svg
          dotSource = content
          const svgRelPath = `dot-diagrams/${this.getType()}.svg`
          markdown = graphvizRenderer.buildMarkdownImgRef(svgRelPath, this.getType())
        } catch (renderError) {
          // Fall back to Mermaid when DOT rendering fails (e.g. generator returns
          // Mermaid syntax but complexity pushed the backend selection to graphviz).
          const msg = renderError instanceof Error ? renderError.message : String(renderError)
          logger.warn(
            `Graphviz rendering failed for ${this.getType()}, falling back to Mermaid: ${msg}`
          )
          selectedBackend = 'mermaid'
          svgContent = undefined
          dotSource = undefined
          markdown = this.wrapMarkdown(content, 'mermaid')
        }
      } else {
        // Wrap content in markdown code fence
        markdown = this.wrapMarkdown(content, selectedBackend)
      }

      return {
        markdown,
        renderingBackend: selectedBackend,
        diagramType: this.getType(),
        category: this.getCategory(),
        svgContent,
        dotSource,
      }
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to generate diagram ${this.getType()}: ${err}`)
      throw error
    }
  }

  /**
   * Wrap raw Mermaid content in a markdown code fence.
   * Graphviz diagrams are rendered to SVG directly in `generate()` and do not go through this path.
   */
  protected wrapMarkdown(content: string, backend: RenderingBackend): string {
    if (backend === 'mermaid') {
      return ['```mermaid', content, '```'].join('\n')
    }
    // Fallback: return content as-is for unknown backends
    return content
  }
}

export default DiagramGeneratorBase
