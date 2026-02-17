/**
 * Complexity Analyzer
 *
 * Scores diagrams and selects a rendering backend (mermaid | graphviz).
 */
import type { ComplexityThresholds, ComplexityScore, RenderingBackend } from './diagram-types.js'

export class ComplexityAnalyzer {
  thresholds: ComplexityThresholds

  constructor(thresholds?: ComplexityThresholds) {
    this.thresholds = thresholds ?? {
      maxMermaidNodes: 5,
      maxMermaidEdges: 8,
      nestingDepthMultiplier: 2,
      svgCollapseThresholdBytes: 50000,
    }
  }

  score(nodeCount: number, edgeCount: number, nestingDepth: number): ComplexityScore {
    const totalScore = nodeCount + edgeCount + nestingDepth * this.thresholds.nestingDepthMultiplier
    return { nodeCount, edgeCount, nestingDepth, totalScore }
  }

  /**
   * Select rendering backend. Simple rule: prefer Mermaid when node and edge counts are within thresholds,
   * otherwise fall back to Graphviz for more complex graphs.
   */
  selectBackend(score: ComplexityScore, thresholds?: ComplexityThresholds): RenderingBackend {
    const t = thresholds ?? this.thresholds
    if (score.nodeCount <= t.maxMermaidNodes && score.edgeCount <= t.maxMermaidEdges)
      return 'mermaid'
    return 'graphviz'
  }
}

export default ComplexityAnalyzer
