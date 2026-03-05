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
 * Context provided to diagram generators for content generation
 */
export interface DiagramContext {
  projectName: string
  projectDescription?: string
  projectType?: string
  prdContent?: string
  metadata?: Record<string, unknown>
  gates?: {
    id: string
    number?: number
    name: string
    status: string
  }[]
  requirements?: {
    id: string
    type: string
    status: string
  }[]
  existingDiagrams?: DiagramMetadata[]
}

/**
 * Output from diagram generation, including both raw content and metadata
 */
export interface DiagramOutput {
  markdown: string
  renderingBackend: RenderingBackend
  diagramType: DiagramType
  category: DiagramCategory
  filePath?: string
  svgContent?: string
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

      // Check if Graphviz is available when requested
      if (selectedBackend === 'graphviz') {
        const graphvizRenderer = new GraphvizRenderer()
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

      // Wrap content in markdown structure with type identifier
      const markdown = this.wrapMarkdown(content, selectedBackend)

      return {
        markdown,
        renderingBackend: selectedBackend,
        diagramType: this.getType(),
        category: this.getCategory(),
      }
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to generate diagram ${this.getType()}: ${err}`)
      throw error
    }
  }

  /**
   * Wrap raw diagram content in markdown structure appropriate to the backend.
   * Mermaid gets markdown code fence; Graphviz is handled by GraphvizRenderer.
   */
  protected wrapMarkdown(content: string, backend: RenderingBackend): string {
    if (backend === 'mermaid') {
      return ['```mermaid', content, '```'].join('\n')
    }
    // Graphviz content is returned as-is; rendering happens at output time
    return content
  }
}

export default DiagramGeneratorBase
