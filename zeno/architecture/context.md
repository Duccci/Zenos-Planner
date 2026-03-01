```mermaid
graph TB
    subgraph "External Actors & Systems"
        HumanUser["👤 Human Developer<br/>(via Cursor IDE)"]
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
    classdef actor fill:#F5A623,stroke:#D68910,stroke-width:2px,color:#fff
    
    class HumanUser,LLMEngine,GitSystem,FileSystem external
    class CLI,MCP,Core,DB zenoBoundary
    class PRD,GatesByPRD,Architecture artifacts
```