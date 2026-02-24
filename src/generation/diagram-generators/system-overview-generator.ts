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
    const match = prdContent.match(/```mermaid\n([\s\S]*?)\n```/)
    return match && match[1] ? match[1] : null
  }

  /**
   * Extract Mermaid diagram from existing markdown architecture doc.
   */
  private extractMermaidFromMarkdown(markdown: string): string | null {
    // Look for Mermaid code block
    const match = markdown.match(/```mermaid\n([\s\S]*?)\n```/)
    return match && match[1] ? match[1] : null
  }

  /**
   * Generate aspirational architecture diagram based on gates and project vision.
   * Shows target system design with implementation status indicators.
   */
  private generateAspirationaArchitecture(context: DiagramContext): string {
    // Build status indicators for gates
    const statusMap = new Map<number, string>()
    if (context.gates) {
      for (const gate of context.gates) {
        let indicator = '🔵' // Default: planned
        if (gate.status === 'completed') {
          indicator = '🟢' // Implemented
        } else if (gate.status === 'in_progress') {
          indicator = '🟡' // In progress
        }
        statusMap.set(gate.number, indicator)
      }
    }

    // Generate aspirational architecture layers based on Zeno's target design
    // (14-gate system: Core, Analysis, Generation, Storage, Integration, Validation, Execution)
    const diagram = `graph TB
    User["👤 User/LLM<br/>(via Cursor/CLI)"]
    
    subgraph "User Interface Layer"
        CLI["🟢 CLI Commands"]
        MCP["🟢 MCP Server<br/>LLM Tool Interface"]
        Dashboard["🔵 Dashboard<br/>Gate 12"]
    end
    
    subgraph "Orchestration Layer"
        SubagentOrch["🔵 Subagent Orchestrator<br/>Gate 13"]
        WorktreeOrch["🟡 Worktree Manager<br/>Gate 10"]
    end
    
    subgraph "Core Engine Layer"
        ZenoEngine["🟢 Zeno Engine<br/>Gate Generation"]
        GateManager["🟢 Gate Manager<br/>Lifecycle Control"]
        ReplanEngine["🟡 Replan Engine<br/>Gate 11"]
        ProposalApproval["🟡 Approval Engine<br/>Gate 9"]
    end
    
    subgraph "Analysis & Generation Layer"
        CodeAnalyzer["🟢 Code Analyzer<br/>AST + Metrics"]
        RepoDetector["🟡 Repo Detector<br/>Gate 6"]
        DepTracker["🟢 Dependency Tracker<br/>Hash-based"]
        DiagramGen["🟢 Diagram Generator<br/>Gate 5"]
        ProposalGen["🟡 Proposal Generator<br/>Gate 7"]
    end
    
    subgraph "Validation Layer"
        AutoChecks["🟡 Automated Checks<br/>Gate 8"]
        QualityGates["🟡 Quality Gates<br/>Coverage/Security/Lint"]
    end
    
    subgraph "Storage Layer"
        SQLite["🟢 SQLite DB<br/>4-Table Schema"]
        FileStore["🟢 File Store<br/>Markdown/JSON"]
        GitStore["🟢 Git Repository<br/>Version Control"]
    end
    
    subgraph "Integration Layer"
        GitIntegration["🟡 Git Integration<br/>Gate 10"]
        HumanApproval["🟡 Human Approval<br/>Gate 9"]
    end
    
    %% User interactions
    User --> MCP
    User --> CLI
    User --> Dashboard
    
    %% UI to Core
    MCP --> ZenoEngine
    CLI --> ZenoEngine
    
    %% Orchestration
    ZenoEngine --> SubagentOrch
    ZenoEngine --> WorktreeOrch
    
    %% Core to Analysis
    GateManager --> CodeAnalyzer
    GateManager --> RepoDetector
    GateManager --> DepTracker
    GateManager --> DiagramGen
    
    %% Generation to Storage
    DiagramGen --> FileStore
    ProposalGen --> SQLite
    CodeAnalyzer --> SQLite
    
    %% Validation to Core
    AutoChecks --> ProposalApproval
    QualityGates --> AutoChecks
    
    %% Storage connections
    ZenoEngine --> SQLite
    ZenoEngine --> FileStore
    ZenoEngine --> GitStore
    
    %% Integration
    ProposalApproval --> GitIntegration
    WorktreeOrch --> GitIntegration
    HumanApproval --> ProposalApproval
    
    classDef ui_layer fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef core_layer fill:#7B68EE,stroke:#5A4AB8,stroke-width:2px,color:#fff
    classDef analysis_layer fill:#F5A623,stroke:#D68910,stroke-width:2px,color:#fff
    classDef storage_layer fill:#E85D75,stroke:#B8435F,stroke-width:2px,color:#fff
    classDef validation_layer fill:#50E3C2,stroke:#2FA284,stroke-width:2px,color:#fff
    
    class CLI,MCP,Dashboard ui_layer
    class ZenoEngine,GateManager,ReplanEngine,ProposalApproval,SubagentOrch,WorktreeOrch core_layer
    class CodeAnalyzer,RepoDetector,DepTracker,DiagramGen,ProposalGen,AutoChecks,QualityGates analysis_layer
    class SQLite,FileStore,GitStore storage_layer
    class GitIntegration,HumanApproval validation_layer`

    return diagram
  }

  /**
   * Count components for complexity analysis. Aspirational architecture has ~20 major components.
   */
  protected override countNodes(context: DiagramContext): number {
    // Count gates as a proxy for system complexity
    return context.gates?.length ?? 14 // Default to 14-gate system
  }

  protected override countEdges(context: DiagramContext): number {
    return (context.gates?.length ?? 14) * 2 // Estimate 2x edges per gate
  }
}

export default SystemOverviewGenerator
