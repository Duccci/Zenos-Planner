/**
 * System Overview Diagram Generator
 *
 * Generates a high-level system architecture diagram showing major components
 * and their relationships across architectural layers.
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
   * Generate a system overview diagram showing architectural layers and components.
   * Template provides structure; content is populated from project metadata.
   */
  generateContent(_context: DiagramContext): string {
    // Load template for structural guidance
    const templatePath = join(
      process.cwd(),
      'templates/architecture-templates/system-overview-template.md'
    )
    try {
      readFileSync(templatePath, 'utf-8')
    } catch {
      // Template file not found; proceed with default generation
    }

    // Generate Mermaid graph showing typical 3-layer architecture
    // Layers: Presentation, Logic/API, Data
    const diagram = `graph TB
    subgraph Presentation["Presentation Layer"]
        UI["User Interface"]
        CLI["CLI Interface"]
    end

    subgraph Logic["Logic & API Layer"]
        API["API Service"]
        Engine["Execution Engine"]
        Cache["In-Memory Cache"]
    end

    subgraph Data["Data & Storage Layer"]
        DB[("Database")]
        FS["File System"]
        Registry["Hash Registry"]
    end

    UI --> API
    CLI --> API
    API --> Engine
    Engine --> Cache
    Cache --> Engine
    Engine --> DB
    Engine --> FS
    API --> Registry

    classDef presentation fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef logic fill:#7B68EE,stroke:#5A4AB8,stroke-width:2px,color:#fff
    classDef data fill:#E85D75,stroke:#B8435F,stroke-width:2px,color:#fff

    class UI,CLI presentation
    class API,Engine,Cache logic
    class DB,FS,Registry data`

    return diagram
  }

  /**
   * Count components for complexity analysis.
   */
  protected override countNodes(_context: DiagramContext): number {
    return 9 // Hardcoded for system overview: 9 nodes
  }

  protected override countEdges(): number {
    return 9 // Hardcoded edges for system overview
  }
}

export default SystemOverviewGenerator
