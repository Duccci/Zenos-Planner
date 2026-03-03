/**
 * System Overview Diagram Generator
 *
 * Generates a high-level system architecture diagram showing the ASPIRATIONAL (target)
 * architecture based on PROJECT_PRD.md vision, with implementation status indicators.
 *
 * Key Principle: Shows DESIRED architecture (what should be built), not current implementation.
 * Uses status indicators (🟢 done, 🟡 in-progress, 🔵 planned) to show progress toward vision.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { DiagramGeneratorBase } from '../diagram-generator-base.js'
import type { DiagramType, DiagramCategory } from '../diagram-types.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export class SystemOverviewGenerator extends DiagramGeneratorBase {
  getType(): DiagramType {
    return 'system-overview'
  }

  getCategory(): DiagramCategory {
    return 'core'
  }

  /**
   * Generate a system overview diagram showing aspirational architecture from PRD.
   * Reads PRD vision and gate status to generate a forward-looking target architecture diagram.
   */
  generateContent(_context: DiagramContext): string {
    // If PRD content is available, try to extract the target architecture diagram from it
    if (_context.prdContent) {
      const diagram = this.extractDiagramFromPRD(_context.prdContent)
      if (diagram) {
        return diagram
      }
    }

    // Fallback: Try to load the documented system-overview.md which contains the aspirational architecture
    try {
      const overviewPath = join(process.cwd(), 'zeno', 'architecture', 'system-overview.md')
      const overviewContent = readFileSync(overviewPath, 'utf-8')
      const diagram = this.extractMermaidFromMarkdown(overviewContent)
      if (diagram) {
        return diagram
      }
    } catch {
      // File not found; proceed to generation
    }

    // Fallback: Generate aspirational architecture based on PRD vision and gates
    return this.generateAspirationaArchitecture(_context)
  }

  /**
   * Extract Mermaid diagram from PRD content section.
   */
  private extractDiagramFromPRD(prdContent: string): string | null {
    // Look for Mermaid code block in PRD
    const match = /```mermaid\n([\s\S]*?)\n```/.exec(prdContent)
    return match?.[1] ?? null
  }

  /**
   * Extract Mermaid diagram from existing markdown architecture doc.
   */
  private extractMermaidFromMarkdown(markdown: string): string | null {
    // Look for Mermaid code block
    const match = /```mermaid\n([\s\S]*?)\n```/.exec(markdown)
    return match?.[1] ?? null
  }

  /**
   * Generate a generic aspirational architecture diagram driven by context gates.
   * Falls back to a minimal 4-layer generic structure when no gate data is available.
   * Does not embed project-specific names or gate references.
   */
  private generateAspirationaArchitecture(context: DiagramContext): string {
    const gates = context.gates ?? []
    const lines: string[] = ['graph TB']

    if (gates.length > 0) {
      // Build status indicators from actual gate data
      const statusIndicator = (status: string): string => {
        if (status === 'completed') return '🟢'
        if (status === 'in_progress') return '🟡'
        return '🔵'
      }

      // Group gates into rough quarters as layers
      const layerSize = Math.ceil(gates.length / 4)
      const layers = [
        gates.slice(0, layerSize),
        gates.slice(layerSize, layerSize * 2),
        gates.slice(layerSize * 2, layerSize * 3),
        gates.slice(layerSize * 3),
      ].filter((l) => l.length > 0)

      const layerColors = ['#4A90E2', '#7B68EE', '#F5A623', '#E85D75']
      const layerNames = ['Foundation', 'Core', 'Extension', 'Integration']

      for (let li = 0; li < layers.length; li++) {
        const layer = layers[li]
        if (!layer) continue
        lines.push(`    subgraph "Layer ${String(li + 1)}: ${layerNames[li] ?? 'Other'}"`)
        for (const gate of layer) {
          const ind = statusIndicator(gate.status)
          const nodeId = `G${String(gate.number)}`
          lines.push(`        ${nodeId}["${ind} ${gate.name}"]`)
        }
        lines.push('    end')
        lines.push('')
      }

      // Connect layers sequentially
      for (let li = 0; li < layers.length - 1; li++) {
        const curLayer = layers[li]
        const nextLayer = layers[li + 1]
        if (!curLayer || !nextLayer) continue
        const lastOfCur = curLayer[curLayer.length - 1]
        const firstOfNext = nextLayer[0]
        if (lastOfCur && firstOfNext) {
          lines.push(`    G${String(lastOfCur.number)} --> G${String(firstOfNext.number)}`)
        }
      }
      lines.push('')

      // Styling
      for (let li = 0; li < layers.length; li++) {
        const layer = layers[li]
        const color = layerColors[li] ?? '#888'
        if (!layer) continue
        const nodeIds = layer.map((g) => `G${String(g.number)}`).join(',')
        lines.push(
          `    classDef layer${String(li)} fill:${color},stroke:#333,stroke-width:2px,color:#fff`
        )
        lines.push(`    class ${nodeIds} layer${String(li)}`)
      }
    } else {
      // Generic 4-layer fallback — no project-specific names
      lines.push(
        '    subgraph "Interface Layer"\n        UI["User Interface"]\n        API["API / MCP Server"]\n    end',
        '    subgraph "Core Layer"\n        Engine["Core Engine"]\n        Manager["Lifecycle Manager"]\n    end',
        '    subgraph "Data Layer"\n        DB[("Database")]\n        Files["File Store"]\n    end',
        '    UI --> Engine',
        '    API --> Engine',
        '    Engine --> Manager',
        '    Manager --> DB',
        '    Manager --> Files',
        '',
        '    classDef interface fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff',
        '    classDef core fill:#7B68EE,stroke:#5A4AB8,stroke-width:2px,color:#fff',
        '    classDef data fill:#E85D75,stroke:#B8435F,stroke-width:2px,color:#fff',
        '    class UI,API interface',
        '    class Engine,Manager core',
        '    class DB,Files data'
      )
    }

    return lines.join('\n')
  }

  /**
   * Count components for complexity analysis.
   */
  protected override countNodes(context: DiagramContext): number {
    return context.gates?.length ?? 4
  }

  protected override countEdges(context: DiagramContext): number {
    return (context.gates?.length ?? 4) * 2
  }
}

export default SystemOverviewGenerator
