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
   * Reads existing context-diagram.md if available and extracts mermaid content;
   * otherwise generates an aspirational context diagram.
   */
  generateContent(_context: DiagramContext): string {
    // Try to read existing context diagram file
    const templatePath = join(
      process.cwd(),
      'templates/architecture-templates/context-diagram-template.md'
    )
    try {
      const raw = readFileSync(templatePath, 'utf-8')
      const extracted = this.extractMermaidFromMarkdown(raw)
      if (extracted) return extracted
    } catch {
      // File not found or unreadable; fall through to aspirational diagram
    }

    // Generate aspirational Mermaid context diagram with subgraph boundary
    const diagram = `graph TB
    subgraph External Actors
      User["👤 User/Client"]
      LLM["🤖 LLM Provider"]
      Git["📦 Git Repository"]
    end

    subgraph Zeno System
      Core["⚙️ Core Engine"]
      CLI["📝 CLI Interface"]
      MCP["🔌 MCP Server"]
    end

    subgraph Storage
      SQLite[("💾 SQLite DB")]
      FS["📁 File System"]
      Cache["🗄️ Cache Layer"]
    end

    User -->|Commands/Input| CLI
    User -->|MCP Calls| MCP
    CLI -->|Delegates| Core
    MCP -->|Invokes| Core

    LLM -->|Prompts/Templates| MCP
    Core -->|API Calls| LLM

    Git -->|Source History| Core
    Core -->|Commits/Tags| Git

    Core -->|Read/Write| SQLite
    Core -->|Read/Write| FS
    Core -->|Cache Ops| Cache

    classDef systemBoundary fill:#4A90E2,stroke:#2E5C8A,stroke-width:3px,color:#fff,font-weight:bold
    classDef actor fill:#7B68EE,stroke:#5A4AB8,stroke-width:2px,color:#fff
    classDef storage fill:#FFA500,stroke:#CC8400,stroke-width:2px,color:#fff

    class Core,CLI,MCP systemBoundary
    class User,LLM,Git actor
    class SQLite,FS,Cache storage`

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
   * Count context diagram components.
   */
  protected override countNodes(_context: DiagramContext): number {
    return 10 // User, LLM, Git, Core, CLI, MCP, SQLite, FS, Cache + boundary
  }

  protected override countEdges(): number {
    return 13 // All directed edges between system components and external actors
  }
}

export default ContextDiagramGenerator
