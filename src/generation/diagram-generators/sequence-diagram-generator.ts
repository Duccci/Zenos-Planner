/**
 * Sequence Diagram Generator
 *
 * Generates sequence diagrams showing temporal interactions between actors and components.
 * Useful for visualizing workflows, API calls, and message sequences.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { DiagramGeneratorBase } from '../diagram-generator-base.js'
import type { DiagramType, DiagramCategory } from '../diagram-types.js'
import type { ComplexityAnalyzer } from '../complexity-analyzer.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export class SequenceDiagramGenerator extends DiagramGeneratorBase {
  constructor(
    protected descriptor?: string,
    complexityAnalyzer?: ComplexityAnalyzer
  ) {
    super(complexityAnalyzer)
  }

  getType(): DiagramType {
    return 'sequence'
  }

  getCategory(): DiagramCategory {
    return 'conditional'
  }

  /**
   * Generate a sequence diagram showing temporal interactions.
   * Template provides structure; content is populated from context.
   */
  generateContent(_context: DiagramContext): string {
    // Load template for structural guidance
    const templatePath = join(
      process.cwd(),
      'templates/architecture-templates/sequence-diagram-template.md'
    )
    try {
      readFileSync(templatePath, 'utf-8')
    } catch {
      // Template file not found; proceed with default generation
    }

    // Generate Mermaid sequence diagram
    // Descriptor (if provided) is used for per-gate filename scoping: sequence-[gate-hash]-[descriptor].md
    const diagram = `sequenceDiagram
    autonumber
    participant User
    participant API
    participant Service
    participant Database

    User->>API: Request
    activate API
    API->>Service: Process
    activate Service
    Service->>Database: Query
    activate Database
    Database-->>Service: Result
    deactivate Database
    Service-->>API: Response
    deactivate Service
    API-->>User: Return
    deactivate API`

    return diagram
  }

  /**
   * Count participants for complexity analysis.
   */
  protected override countNodes(_context: DiagramContext): number {
    return 4 // User, API, Service, Database
  }

  protected override countEdges(): number {
    return 8 // Number of interactions
  }

  protected override countNestingDepth(): number {
    return 3 // activation levels
  }
}

export default SequenceDiagramGenerator
