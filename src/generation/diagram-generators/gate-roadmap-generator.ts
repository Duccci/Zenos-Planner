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
      // Minimal placeholder — no gates available yet
      mermaidLines.push('    G1["Gate 01"]')
      mermaidLines.push('    G2["Gate 02"]')
      mermaidLines.push('    G3["Gate 03"]')
      mermaidLines.push('    G4["Gate 04"]')
      mermaidLines.push('    G1 --> G2')
      mermaidLines.push('    G2 --> G3')
      mermaidLines.push('    G3 --> G4')
    } else {
      // Generate nodes and edges from context gates
      const nodesByStatus: Record<string, string[]> = {}
      for (let i = 0; i < gates.length; i++) {
        const gate = gates[i]
        if (!gate) continue
        const nodeId = `G${String(i + 1)}`
        // Reconstruct the "Gate NN:" prefix using sequence number or gate id fallback
        const seq = gate.number ?? (Number(/gate-(\d+)/.exec(gate.id)?.[1]) || i + 1)
        const numPrefix = `Gate ${String(seq).padStart(2, '0')}`
        const label = `${numPrefix}: ${gate.name}<br/><small>${gate.status}</small>`
        mermaidLines.push(`    ${nodeId}["${label}"]`)
        // Track node ids by status for class assignment
        const status = gate.status.replace(/[^a-zA-Z0-9_]/g, '_')
        nodesByStatus[status] ??= []
        nodesByStatus[status].push(nodeId)
      }

      // Connect gates sequentially
      for (let i = 0; i < gates.length - 1; i++) {
        const source = String(i + 1)
        const target = String(i + 2)
        mermaidLines.push(`    G${source} --> G${target}`)
      }

      // Assign status classes so classDef colors are actually applied
      mermaidLines.push('')
      for (const [status, ids] of Object.entries(nodesByStatus)) {
        mermaidLines.push(`    class ${ids.join(',')} ${status}`)
      }
    }

    // Add styling — must match system-wide convention from gate-roadmap-template.md:
    // pending=blue (#4A90E2), in_progress=amber (#FFC107), completed=green (#4CAF50)
    mermaidLines.push('')
    mermaidLines.push(
      '    classDef pending fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff'
    )
    mermaidLines.push(
      '    classDef in_progress fill:#FFC107,stroke:#F57F17,stroke-width:2px,color:#000'
    )
    mermaidLines.push(
      '    classDef completed fill:#4CAF50,stroke:#2E7D32,stroke-width:2px,color:#fff'
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
