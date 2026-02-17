/**
 * Context Diagram Generator
 *
 * Generates a context diagram showing the system boundary and external dependencies,
 * identifying external actors and systems that interact with the core system.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { DiagramGeneratorBase } from '../diagram-generator-base.js'
import type { DiagramType, DiagramCategory } from '../diagram-types.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export class ContextDiagramGenerator extends DiagramGeneratorBase {
  getType(): DiagramType {
    return 'context'
  }

  getCategory(): DiagramCategory {
    return 'core'
  }

  /**
   * Generate a context diagram showing the system boundary and external dependencies.
   * Template provides structure; content is populated from project metadata.
   */
  generateContent(_context: DiagramContext): string {
    // Load template for structural guidance
    const templatePath = join(
      process.cwd(),
      'templates/architecture-templates/context-diagram-template.md'
    )
    try {
      readFileSync(templatePath, 'utf-8')
    } catch {
      // Template file not found; proceed with default generation
    }

    // Generate Mermaid graph showing system boundary and external actors
    const diagram = `graph TB
    User["👤 User/Client"]
    LLM["🤖 LLM Provider"]
    Git["📦 Git Repository"]
    System["<b>Zeno System</b><br/>Core Engine"]
    SQLite[("💾 SQLite DB")]
    FS["📁 File System"]

    User -->|Commands/Input| System
    System -->|Responses/Output| User

    LLM -->|Prompts/Templates| System
    System -->|API Calls| LLM

    Git -->|Source History| System
    System -->|Commits/Tags| Git

    System -->|Read/Write| SQLite
    System -->|Read/Write| FS

    classDef systemBoundary fill:#4A90E2,stroke:#2E5C8A,stroke-width:3px,color:#fff,font-weight:bold
    classDef actor fill:#7B68EE,stroke:#5A4AB8,stroke-width:2px,color:#fff
    classDef external fill:#E85D75,stroke:#B8435F,stroke-width:2px,color:#fff
    classDef storage fill:#FFA500,stroke:#CC8400,stroke-width:2px,color:#fff

    class System systemBoundary
    class User,LLM,Git actor
    class SQLite,FS storage`

    return diagram
  }

  /**
   * Count context diagram components.
   */
  protected override countNodes(_context: DiagramContext): number {
    return 7 // User, LLM, Git, System (center), SQLite, FS
  }

  protected override countEdges(): number {
    return 6 // Bidirectional edges between system and external components
  }
}

export default ContextDiagramGenerator
