/**
 * Gate Roadmap Diagram Generator
 *
 * Generates a roadmap diagram showing gate sequence and parallel relationships,
 * illustrating the progression of gates from start to completion.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { DiagramGeneratorBase } from '../diagram-generator-base.js'
import type { DiagramType, DiagramCategory } from '../diagram-types.js'

export class GateRoadmapGenerator extends DiagramGeneratorBase {
  getType(): DiagramType {
    return 'gate-roadmap'
  }

  getCategory(): DiagramCategory {
    return 'core'
  }

  /**
   * Generate a roadmap diagram showing gateway sequence and parallel relationships.
   * Template provides structure; content is populated from project metadata.
   */
  generateContent(context: DiagramContext): string {
    // Build gate roadmap from context
    // Note: templates are served to LLMs via template_get/arch_catalogue MCP tools
    const gates = context.gates ?? []

    // Generate a simple sequential roadmap; in practice this would analyze dependencies
    // and show parallel gates side-by-side. For MVP, assume linear progression.
    const mermaidLines = ['graph LR']

    if (gates.length === 0) {
      // Default roadmap if no gates provided
      mermaidLines.push('    G1["Gate 1<br/>Planning"]')
      mermaidLines.push('    G2["Gate 2<br/>Design"]')
      mermaidLines.push('    G3["Gate 3<br/>Implementation"]')
      mermaidLines.push('    G4["Gate 4<br/>Testing"]')
      mermaidLines.push('    G1 --> G2')
      mermaidLines.push('    G2 --> G3')
      mermaidLines.push('    G3 --> G4')
    } else {
      // Generate nodes and edges from context gates
      for (let i = 0; i < gates.length; i++) {
        const gate = gates[i]
        if (!gate) continue
        const nodeId = `G${String(i + 1)}`
        const label = `${gate.name}<br/><small>${gate.status}</small>`
        mermaidLines.push(`    ${nodeId}["${label}"]`)
      }

      // Connect gates sequentially
      for (let i = 0; i < gates.length - 1; i++) {
        const source = String(i + 1)
        const target = String(i + 2)
        mermaidLines.push(`    G${source} --> G${target}`)
      }
    }

    // Add styling
    mermaidLines.push('')
    mermaidLines.push(
      '    classDef pending fill:#FFA500,stroke:#CC8400,stroke-width:2px,color:#000'
    )
    mermaidLines.push(
      '    classDef in_progress fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff'
    )
    mermaidLines.push(
      '    classDef completed fill:#50E3C2,stroke:#2FA284,stroke-width:2px,color:#000'
    )

    return mermaidLines.join('\n')
  }

  /**
   * Count gates for complexity analysis.
   */
  protected override countNodes(context: DiagramContext): number {
    return Math.max(context.gates?.length ?? 4, 4) // Minimum 4 gates, or actual count
  }

  protected override countEdges(context: DiagramContext): number {
    return Math.max((context.gates?.length ?? 4) - 1, 3) // n-1 edges for n gates
  }
}

export default GateRoadmapGenerator
