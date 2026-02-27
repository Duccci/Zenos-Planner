/**
 * Sequence Diagram Generator
 *
 * Generates sequence diagrams showing temporal interactions between actors and components.
 * Useful for visualizing workflows, API calls, and message sequences.
 *
 * Note: Templates for this diagram type are served to LLMs via template_get / arch_catalogue
 * MCP tools, not read server-side by the generator.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { DiagramGeneratorBase } from '../diagram-generator-base.js'
import type { DiagramType, DiagramCategory } from '../diagram-types.js'
import type { ComplexityAnalyzer } from '../complexity-analyzer.js'

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
   */
  generateContent(_context: DiagramContext): string {
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
