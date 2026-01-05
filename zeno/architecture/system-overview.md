# System Overview

**Purpose**: High-level system architecture showing major components and relationships

**Generated**: 2026-01-04  
**Status**: Approved

---

## Diagram

```mermaid
graph TB
    subgraph "User Interface Layer"
        CLI[CLI Commands]
        TUI[TUI Dashboard]
        LLM[LLM Integration]
    end
    
    subgraph "Core Engine Layer"
        ZenoEngine[Zeno Engine<br/>Gate Generation]
        GateManager[Gate Manager<br/>Lifecycle Control]
        ReplanEngine[Replan Engine<br/>Rescope Logic]
    end
    
    subgraph "Analysis Layer"
        CodeAnalyzer[Code Analyzer<br/>AST + Metrics]
        RepoDetector[Repo Detector<br/>Boundary Detection]
        DepTracker[Dependency Tracker<br/>Hash-based]
    end
    
    subgraph "Generation Layer"
        ReqGenerator[Requirement Generator<br/>Gate Decomposition]
        MermaidGen[Mermaid Generator<br/>Architecture Diagrams]
        ProposalGen[Proposal Generator<br/>Change Notices]
        PRDGen[PRD Generator<br/>Template-based]
    end
    
    subgraph "Validation Layer"
        AutoChecks[Automated Checks<br/>Coverage/Security/Lint]
        QualityGates[Quality Gates<br/>Threshold Enforcement]
        DepValidator[Dependency Validator<br/>Conflict Detection]
    end
    
    subgraph "Storage Layer"
        SQLite[(SQLite DB<br/>Requirements)]
        FileStore[File Store<br/>Markdown/JSON]
        HashRegistry[Hash Registry<br/>Content-Addressable]
        GitStore[Git Repository<br/>Version Control]
    end
    
    subgraph "Integration Layer"
        GitHooks[Git Hooks<br/>Pre-commit]
        GitOps[Git Operations<br/>Commit/Tag/Branch]
    end
    
    %% User Interface connections
    CLI --> ZenoEngine
    CLI --> GateManager
    CLI --> ReplanEngine
    TUI --> GateManager
    LLM --> CLI
    
    %% Core Engine connections
    ZenoEngine --> CodeAnalyzer
    ZenoEngine --> ReqGenerator
    GateManager --> ReqGenerator
    GateManager --> ProposalGen
    GateManager --> AutoChecks
    ReplanEngine --> ZenoEngine
    
    %% Analysis Layer connections
    CodeAnalyzer --> RepoDetector
    CodeAnalyzer --> DepTracker
    RepoDetector --> DepTracker
    
    %% Generation Layer connections
    ReqGenerator --> MermaidGen
    ReqGenerator --> PRDGen
    ProposalGen --> DepTracker
    MermaidGen --> FileStore
    PRDGen --> FileStore
    
    %% Validation Layer connections
    AutoChecks --> QualityGates
    AutoChecks --> DepValidator
    DepValidator --> DepTracker
    
    %% Storage Layer connections
    ReqGenerator --> SQLite
    ReqGenerator --> HashRegistry
    ProposalGen --> SQLite
    ProposalGen --> FileStore
    DepTracker --> SQLite
    GateManager --> SQLite
    GateManager --> FileStore
    HashRegistry --> SQLite
    
    %% Integration Layer connections
    GateManager --> GitOps
    AutoChecks --> GitHooks
    GitOps --> GitStore
    GitHooks --> GitStore
    
    %% Styling
    classDef engineClass fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef analysisClass fill:#7B68EE,stroke:#5A4AB8,stroke-width:2px,color:#fff
    classDef generationClass fill:#50C878,stroke:#3A9B5C,stroke-width:2px,color:#fff
    classDef validationClass fill:#FF6B6B,stroke:#CC5555,stroke-width:2px,color:#fff
    classDef storageClass fill:#FFA500,stroke:#CC8400,stroke-width:2px,color:#fff
    classDef integrationClass fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    
    class ZenoEngine,GateManager,ReplanEngine engineClass
    class CodeAnalyzer,RepoDetector,DepTracker analysisClass
    class ReqGenerator,MermaidGen,ProposalGen,PRDGen generationClass
    class AutoChecks,QualityGates,DepValidator validationClass
    class SQLite,FileStore,HashRegistry,GitStore storageClass
    class GitHooks,GitOps integrationClass
```

---

## Architecture Layers

The system is organized into seven distinct layers, each with specific responsibilities:

### 1. User Interface Layer
- **CLI Commands**: Primary command-line interface for all operations
- **TUI Dashboard**: Terminal UI for visual project monitoring
- **LLM Integration**: Interface for AI coding assistants (Cursor, Claude, GPT-4)

### 2. Core Engine Layer
- **Zeno Engine**: Implements Zeno's paradox algorithm for gate generation
- **Gate Manager**: Controls gate lifecycle and state transitions
- **Replan Engine**: Handles rescoping and gate regeneration

### 3. Analysis Layer
- **Code Analyzer**: AST parsing, metrics calculation, complexity analysis
- **Repo Detector**: Identifies repository boundaries using coupling metrics
- **Dependency Tracker**: Hash-based cross-repository dependency tracking

### 4. Generation Layer
- **Requirement Generator**: Decomposes gates into hierarchical requirements
- **Mermaid Generator**: Creates architecture diagrams from project state
- **Proposal Generator**: Generates implementation proposals from requirements
- **PRD Generator**: Creates gate-specific PRDs from templates

### 5. Validation Layer
- **Automated Checks**: Runs linting, type checking, tests, coverage, security scans
- **Quality Gates**: Enforces thresholds (90% coverage, 0 vulnerabilities, <0.01% lint errors)
- **Dependency Validator**: Detects conflicts in cross-module dependencies

### 6. Storage Layer
- **SQLite DB**: Structured storage for requirements, gates, proposals, dependencies
- **File Store**: Human-readable artifacts (Markdown, JSON, Mermaid diagrams)
- **Hash Registry**: Content-addressable lookup for all entities
- **Git Repository**: Version control integration

### 7. Integration Layer
- **Git Hooks**: Pre-commit validation and automated checks
- **Git Operations**: Commit automation, tagging, branch management

---

## Design Principles

### Separation of Concerns
Each layer has a single, well-defined responsibility. Layers communicate through clean interfaces.

### Hybrid Storage Strategy
- **SQLite**: For queryable, structured data (requirements, dependencies)
- **Files**: For human-readable artifacts (PRDs, diagrams, proposals)
- **Git**: For version control and collaboration

### LLM-Friendly Design
- Hash-based references reduce context size by 50%+
- Structured data formats optimize AI consumption
- Clear interfaces enable AI-driven automation

### Quality-First Approach
Validation layer enforces quality gates before human review, catching issues early.

---

## Related Documentation

- **Data Flow**: `docs/architecture/data-flow.md` - End-to-end process flow
- **Gate Lifecycle**: `docs/architecture/gate-lifecycle.md` - State machine
- **Gate Roadmap**: `docs/architecture/gate-roadmap.md` - Gate roadmap
- **Project PRD**: `docs/PROJECT_PRD.md` - Full specification

---

**Source**: `zeno/architecture/system-overview.md`  
**Generated by**: Zeno's Planner

