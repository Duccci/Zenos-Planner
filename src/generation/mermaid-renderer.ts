/**
 * Mermaid Diagram Renderer
 *
 * Handles rendering of Mermaid diagram syntax by wrapping in markdown code fences
 * and validating basic structural correctness.
 */

import { logger } from '../utils/logger.js'

/**
 * Result of Mermaid syntax validation
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Renderer for Mermaid diagrams
 */
export class MermaidRenderer {
  /**
   * Render Mermaid syntax by wrapping in markdown code fence.
   * The raw syntax is assumed to be valid; this just applies formatting.
   */
  render(mermaidSyntax: string): string {
    return ['```mermaid', mermaidSyntax, '```'].join('\n')
  }

  /**
   * Validate Mermaid syntax for common structural issues.
   * Lightweight validation that catches obvious problems without full parsing.
   *
   * Checks:
   * - Content is not empty
   * - Contains a diagram type keyword (graph, sequenceDiagram, stateDiagram, etc.)
   * - Balanced brackets
   */
  validateSyntax(mermaidSyntax: string): ValidationResult {
    const errors: string[] = []

    // Check for empty content
    const trimmed = mermaidSyntax.trim()
    if (!trimmed) {
      errors.push('Mermaid diagram content is empty')
      return { valid: false, errors }
    }

    // Check for diagram type keyword
    const diagramKeywords = [
      'graph',
      'sequenceDiagram',
      'classDiagram',
      'stateDiagram',
      'erDiagram',
      'journey',
      'flowchart',
    ]

    const hasKeyword = diagramKeywords.some(
      (kw) => trimmed.startsWith(kw) || trimmed.includes(`\n${kw}`)
    )

    if (!hasKeyword) {
      errors.push(
        `Mermaid diagram must start with a diagram type keyword (${diagramKeywords.join(', ')}) or contain one on a new line`
      )
    }

    // Check for balanced brackets
    const roundBrackets =
      (trimmed.match(/\(/g) ?? []).length === (trimmed.match(/\)/g) ?? []).length
    const squareBrackets =
      (trimmed.match(/\[/g) ?? []).length === (trimmed.match(/\]/g) ?? []).length
    const curlyBrackets =
      (trimmed.match(/\{/g) ?? []).length === (trimmed.match(/\}/g) ?? []).length

    if (!roundBrackets) {
      errors.push('Unbalanced parentheses in Mermaid diagram')
    }
    if (!squareBrackets) {
      errors.push('Unbalanced square brackets in Mermaid diagram')
    }
    if (!curlyBrackets) {
      errors.push('Unbalanced curly braces in Mermaid diagram')
    }

    if (errors.length > 0) {
      logger.debug(`Mermaid validation errors: ${errors.join('; ')}`)
      return { valid: false, errors }
    }

    return { valid: true, errors: [] }
  }
}

export default MermaidRenderer
