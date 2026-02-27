/**
 * Component Diagram Generator
 *
 * Generates component diagrams showing detailed module structure with interfaces,
 * internal components, and provided/required ports.
 *
 * Note: Templates for this diagram type are served to LLMs via template_get / arch_catalogue
 * MCP tools, not read server-side by the generator.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { DiagramGeneratorBase } from '../diagram-generator-base.js'
import type { DiagramType, DiagramCategory } from '../diagram-types.js'
import type { ComplexityAnalyzer } from '../complexity-analyzer.js'

export class ComponentDiagramGenerator extends DiagramGeneratorBase {
  constructor(
    protected componentName?: string,
    complexityAnalyzer?: ComplexityAnalyzer
  ) {
    super(complexityAnalyzer)
  }

  getType(): DiagramType {
    return 'component'
  }

  getCategory(): DiagramCategory {
    return 'conditional'
  }

  /**
   * Generate a component diagram showing detailed module structure.
   */
  generateContent(_context: DiagramContext): string {
    const componentName = this.componentName ?? 'System'

    // Generate Mermaid component diagram
    const diagram = `graph TB
    subgraph ${componentName}["${componentName} Component"]
        Interface["[interface]<br/>Service API"]
        Parser["Parser<br/>Module"]
        Validator["Validator<br/>Module"]
        Processor["Processor<br/>Module"]
    end

    External["External<br/>System"]
    
    External -->|request| Interface
    Interface --> Parser
    Parser --> Validator
    Validator --> Processor
    Processor -->|response| External

    classDef interface fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef component fill:#7B68EE,stroke:#5A4AB8,stroke-width:2px,color:#fff
    classDef external fill:#E85D75,stroke:#B8435F,stroke-width:2px,color:#fff

    class Interface interface
    class Parser,Validator,Processor component
    class External external`

    return diagram
  }

  /**
   * Count internal components for complexity analysis.
   */
  protected override countNodes(): number {
    return 5 // External + Interface + 3 internal modules
  }

  protected override countEdges(): number {
    return 5 // Connections between modules
  }

  protected override countNestingDepth(): number {
    return 2 // One level of nesting (subgraph)
  }
}

export default ComponentDiagramGenerator
