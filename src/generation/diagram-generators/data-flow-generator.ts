/**
 * Data Flow Diagram Generator
 *
 * Generates a diagram showing end-to-end data processing paths through
 * system components, illustrating how data transforms as it moves through the system.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { DiagramGeneratorBase } from '../diagram-generator-base.js'
import type { DiagramType, DiagramCategory } from '../diagram-types.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export class DataFlowGenerator extends DiagramGeneratorBase {
  getType(): DiagramType {
    return 'data-flow'
  }

  getCategory(): DiagramCategory {
    return 'core'
  }

  /**
   * Generate a data flow diagram showing end-to-end data processing paths.
   * Template provides structure; content is populated from project metadata.
   */
  generateContent(_context: DiagramContext): string {
    // Load template for structural guidance
    const templatePath = join(
      process.cwd(),
      'templates/architecture-templates/data-flow-template.md'
    )
    try {
      const raw = readFileSync(templatePath, 'utf-8')
      const extracted = this.extractMermaidFromMarkdown(raw)
      if (extracted) return extracted
    } catch {
      // Template file not found; proceed with default generation
    }

    // Generate Mermaid flowchart showing data flow through system
    const diagram = `flowchart TD
    User["User Input"]
    Parser["Input Parser"]
    Validator["Data Validator"]
    Processor["Data Processor"]
    Cache["Cache Layer"]
    DB[("Persistent Storage")]
    Output["Output Generator"]
    ProjectComplete["ProjectComplete"]

    User -->|Raw Data| Parser
    Parser -->|Parsed Data| Validator
    Validator -->|Valid Data| Processor
    Processor -->|Intermediate| Cache
    Cache -->|Check| Processor
    Processor -->|Processed Data| DB
    DB -->|Query Result| Cache
    Processor -->|Final Data| Output
    Output -->|Result| ProjectComplete

    classDef input fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef process fill:#7B68EE,stroke:#5A4AB8,stroke-width:2px,color:#fff
    classDef storage fill:#E85D75,stroke:#B8435F,stroke-width:2px,color:#fff
    classDef output fill:#50E3C2,stroke:#2FA284,stroke-width:2px,color:#fff

    class User,Parser,Validator process
    class Processor,Cache,Output process
    class DB storage
    class ProjectComplete output`

    return diagram
  }

  /**
   * Extract mermaid content from a markdown string.
   */
  private extractMermaidFromMarkdown(markdown: string): string | null {
    const match = /```mermaid\n([\s\S]*?)```/.exec(markdown)
    return match?.[1] != null ? match[1].trimEnd() : null
  }

  /**
   * Count data flow nodes for complexity analysis.
   */
  protected override countNodes(context: DiagramContext): number {
    if (context.gates?.length !== undefined) {
      return context.gates.length
    }
    return 9 // Default for data flow
  }

  protected override countEdges(context: DiagramContext): number {
    if (context.gates?.length !== undefined) {
      return Math.round(context.gates.length * 1.5)
    }
    return 10 // Default edges for data flow
  }
}

export default DataFlowGenerator
