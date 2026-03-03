/**
 * Context Diagram Generator
 *
 * Generates a context diagram showing the system boundary and external dependencies.
 * ASPIRATIONAL: Shows desired system boundary based on PRD vision and target interactions.
 * Identifies external actors (users, LLMs, Git, etc.) and their relationships to Zeno.
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
   * Generate a context diagram showing system boundary and external dependencies.
   * Based on PRD vision of how Zeno interacts with external systems.
   */
  generateContent(context: DiagramContext): string {
    // Try to find documented context diagram
    try {
      const contextPath = join(process.cwd(), 'zeno', 'architecture', 'context-diagram.md')
      const contextContent = readFileSync(contextPath, 'utf-8')
      const diagram = this.extractMermaidFromMarkdown(contextContent)
      if (diagram) {
        return diagram
      }
    } catch {
      // File not found; proceed to generation
    }

    // Generate aspirational context diagram based on PRD
    return this.generateAspirationaContextDiagram(context)
  }

  /**
   * Extract Mermaid diagram from markdown documentation.
   */
  private extractMermaidFromMarkdown(markdown: string): string | null {
    const match = /```mermaid\n([\s\S]*?)\n```/.exec(markdown)
    return match?.[1] ?? null
  }

  /**
   * Generate aspirational context diagram based on PRD vision.
   * Shows Zeno's system boundary and interactions with external actors and systems.
   */
  private generateAspirationaContextDiagram(_context: DiagramContext): string {
    const diagram = `graph TB
    subgraph "External Actors & Systems"
        HumanUser["Human Developer<br/>(via Cursor IDE)"]
        LLMEngine["🤖 LLM Engine<br/>(Claude/GPT/Local)"]
        GitSystem["📦 Git & GitHub<br/>Version Control"]
        FileSystem["📁 File System<br/>Project Source"]
    end
    
    subgraph "Zeno's Planner System"
        direction TB
        CLI["CLI Interface<br/>zeno command"]
        MCP["MCP Server<br/>LLM Tool Interface"]
        Core["Core Engine<br/>Gate Generation & Decomposition"]
        DB[("SQLite Database<br/>Requirements/Repos/Proposals")]
    end
    
    subgraph "Project Artifacts"
        PRD["PROJECT_PRD.md<br/>Vision & Decisions"]
        GatesByPRD["Gate Definitions<br/>Objectives & Reqs"]
        Architecture["Architecture Diagrams<br/>Aspirational Design"]
    end
    
    %% External -> Zeno
    HumanUser -->|interactive CLI commands| CLI
    HumanUser -->|reviews diagrams & PRD| PRD
    LLMEngine -->|MCP tool calls| MCP
    GitSystem -->|source code & history| Core
    FileSystem -->|project metadata| Core
    
    %% Zeno internal flow
    CLI -->|generates/manages| Core
    MCP -->|serves tools to| LLMEngine
    Core -->|reads/writes| DB
    Core -->|generates| GatesByPRD
    Core -->|generates| Architecture
    
    %% Zeno -> External
    Core -->|commits/tags| GitSystem
    Core -->|creates/updates| PRD
    Core -->|writes| FileSystem
    
    %% Feedback loops
    LLMEngine -->|uses context from| Architecture
    LLMEngine -->|uses requirements from| DB
    HumanUser -->|approves proposals| Core
    
    classDef external fill:#FF6B6B,stroke:#CC5555,stroke-width:2px,color:#fff
    classDef zenoBoundary fill:#4A90E2,stroke:#2E5C8A,stroke-width:3px,color:#fff
    classDef artifacts fill:#50E3C2,stroke:#2FA284,stroke-width:2px,color:#fff
    classDef actor fill:#F5A623,stroke:#D68910,stroke-width:2px,color:#fff
    
    class HumanUser,LLMEngine,GitSystem,FileSystem external
    class CLI,MCP,Core,DB zenoBoundary
    class PRD,GatesByPRD,Architecture artifacts`

    return diagram
  }

  /**
   * Count context diagram nodes for complexity analysis.
   */
  protected override countNodes(_context: DiagramContext): number {
    // Context diagram shows 8-10 external/internal entities
    return 10
  }

  protected override countEdges(_context: DiagramContext): number {
    // Approximately 12-15 interactions
    return 13
  }
}

export default ContextDiagramGenerator
