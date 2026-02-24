# Data Flow

**Purpose**: End-to-end data flow from user input to project completion, including error recovery and rescope paths

**Last Updated**: 2026-02-23  
**Status**: Approved (Initialized path complete; Error Recovery, Subagent Orchestration, and Rescope paths in Gates 9-11)

---

## Diagram

```mermaid
flowchart TD
    Start([User: Describe End State]) --> Init[zeno init]
    
    Init --> ParseEndState[Parse End State<br/>Natural Language]
    
    ParseEndState --> AnalyzeExisting{Existing<br/>Codebase?}
    
    AnalyzeExisting -->|Yes| DeepAnalysis[Deep Code Analysis<br/>AST + Dependencies + Metrics]
    AnalyzeExisting -->|No| ZenoAlgo[Zeno's Paradox Algorithm]
    
    DeepAnalysis --> ExtractStartState[Extract Start State<br/>Current Architecture]
    ExtractStartState --> ZenoAlgo
    
    ZenoAlgo --> GenerateGates[Generate Gates<br/>Iterative Halving]
    
    GenerateGates --> GenProjectReqs[Generate Project Requirements<br/>Cross-cutting from End State]
    
    GenProjectReqs --> StoreProjectReqs[(Store Project Requirements<br/>SQLite level=project)]
    
    StoreProjectReqs --> StoreGates[(Store Gates<br/>SQLite + Files)]
    
    StoreGates --> SelectGate{User Selects Gate}
    
    SelectGate --> DecomposeReqs[Decompose into Gate Requirements<br/>From Project Reqs + Gate Objectives]
    
    DecomposeReqs --> InheritReqs[Inherit/Transfer Requirements<br/>From Project or Other Gates]
    
    InheritReqs --> StoreReqs[(Store Gate Requirements<br/>SQLite level=gate)]
    
   StoreReqs --> GenArchitecture[Generate Architecture<br/>Mermaid/DOT Diagrams]
    
   GenArchitecture --> StoreArch[(Store Diagrams<br/>.md + SVG)]
    
    StoreArch --> DetectRepos[Detect Repository Boundaries<br/>Coupling + Domain + Size]
    
    DetectRepos --> CalcConfidence[Calculate Confidence Scores]
    
    CalcConfidence --> RepoApproval{User Approves<br/>Repo Split?}
    
    RepoApproval -->|No| AdjustBoundaries[Adjust Boundaries]
    AdjustBoundaries --> DetectRepos
    
    RepoApproval -->|Yes| ScaffoldRepos[Scaffold Repositories<br/>package.json + tsconfig]
    
    ScaffoldRepos --> StoreRepos[(Store Repo Metadata<br/>SQLite)]
    
    StoreRepos --> BuildDepGraph[Build Dependency Graph<br/>Cross-Repo]
    
    BuildDepGraph --> StoreDepGraph[(Store Dependencies<br/>Hash-based)]
    
    StoreDepGraph --> GenProposals[Generate Proposals<br/>Per Requirement]
    
    GenProposals --> StoreProposals[(Store Proposals<br/>SQLite + Markdown)]
    
    StoreProposals --> AutoChecks[Automated Checks<br/>Lint + Type + Test + Coverage]
    
    AutoChecks --> CheckResults{All Checks<br/>Pass?}
    
    CheckResults -->|No| StoreFailed[(Store Failed Results)]
    StoreFailed --> Replan[Replan with Context<br/>Error Messages]
    Replan --> GenProposals
    
    CheckResults -->|Yes| HumanReview{Human<br/>Approval?}
    
    HumanReview -->|Reject| CollectFeedback[Collect Feedback]
    CollectFeedback --> Replan
    
    HumanReview -->|Approve| UpdateStatus[(Update Proposal Status<br/>Approved)]
    
    UpdateStatus --> LLMExecute[LLM Executes in Cursor<br/>Generate Code]
    
    LLMExecute --> RunTests[Run Tests]
    
    RunTests --> TestResults{Tests<br/>Pass?}
    
    TestResults -->|No| Replan
    
    TestResults -->|Yes| QualityCheck[Quality Gate Check<br/>Coverage/Security/Lint]
    
    QualityCheck --> QualityResults{Thresholds<br/>Met?}
    
    QualityResults -->|No| Replan
    
    QualityResults -->|Yes| GitCommit[Auto-commit with Hooks<br/>Structured Message]
    
    GitCommit --> UpdateGateStatus{All Proposals<br/>Complete?}
    
    UpdateGateStatus -->|No| SelectGate
    
    UpdateGateStatus -->|Yes| GateRelease[Create Git Tag<br/>Gate Release]
    
    GateRelease --> MoreGates{More<br/>Gates?}
    
    MoreGates -->|Yes| CheckRescope{End State<br/>Changed?}
    
    CheckRescope -->|Yes| RescopeGate[Generate Rescope Gate]
    RescopeGate --> RegenerateGates[Regenerate Future Gates]
    RegenerateGates --> SelectGate
    
    CheckRescope -->|No| SelectGate
    
    MoreGates -->|No| Complete([Project Complete])
    
    %% Styling
    classDef storageStyle fill:#FFA500,stroke:#CC8400,stroke-width:2px,color:#fff
    classDef processStyle fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef decisionStyle fill:#FF6B6B,stroke:#CC5555,stroke-width:2px,color:#fff
    classDef llmStyle fill:#50C878,stroke:#3A9B5C,stroke-width:2px,color:#fff
    
    class StoreGates,StoreProjectReqs,StoreReqs,StoreArch,StoreRepos,StoreDepGraph,StoreProposals,StoreFailed,UpdateStatus storageStyle
    class DeepAnalysis,ZenoAlgo,GenerateGates,GenProjectReqs,DecomposeReqs,InheritReqs,GenArchitecture,DetectRepos,ScaffoldRepos,BuildDepGraph,GenProposals,AutoChecks,QualityCheck,GitCommit,GateRelease processStyle
    class AnalyzeExisting,SelectGate,RepoApproval,CheckResults,HumanReview,TestResults,QualityResults,UpdateGateStatus,MoreGates,CheckRescope decisionStyle
    class LLMExecute,RunTests llmStyle
```

---

## Workflow Paths

### Path 1: Happy Path (Sequential Single-Agent)

**Current Implementation** (Gates 1-5): User describes end state → Zeno generates gates → LLM executes proposals sequentially

```mermaid
flowchart TD
    Start([User: End State]) --> Init["zeno init<br/>(Parse + Analyze)"]
    Init --> GenGates[Generate Gates<br/>Zeno Algorithm]
    GenGates --> SelectGate["User: Start Gate<br/>zeno gates start"]
    SelectGate --> GenReqs[Generate Requirements<br/>Gate-Level]
    GenReqs --> GenDiagrams[Generate Diagrams<br/>Mermaid/DOT]
    GenDiagrams --> GenProposals[Generate Proposals<br/>Per Requirement]
    GenProposals --> Validate["Validate<br/>zeno proposal validate"]
    Validate --> UserApprove{User<br/>Approves?}
    UserApprove -->|Yes| Implement[LLM Implements<br/>Code Generation]
    UserApprove -->|No| Reject["Reject + Replan<br/>zeno proposal reject"]
    Implement --> Tests[Run Tests<br/>Test Suite]
    Tests --> QualityCheck[Quality Checks<br/>Coverage/Security/Lint]
    QualityCheck --> Commit["Auto-Commit<br/>Structured Message"]
    Commit --> MoreProposals{More Proposals<br/>in Gate?}
    MoreProposals -->|Yes| SelectGate
    MoreProposals -->|No| CompleteGate["zeno gates complete"]
    CompleteGate --> MoreGates{More Gates?}
    MoreGates -->|Yes| SelectGate
    MoreGates -->|No| Success([Project Complete])
    Reject --> Replan["Re-generate + Re-plan<br/>Error Context"]
    Replan --> GenProposals
    
    style Start fill:#90EE90
    style Success fill:#90EE90
```

---

### Path 2: Error Recovery (Validation Failures)

**Future Implementation** (Gates 8-9): When automated checks or human review fail, capture context and replan

```mermaid
flowchart TD
    Validate["Validate Proposal<br/>Lint/Type/Test/Coverage"]
    Validate --> ValidatePass{Quality<br/>Thresholds<br/>Met?}
    ValidatePass -->|No| Capture["Capture Errors<br/>- Error Messages<br/>- Stack Traces<br/>- File Context"]
    Capture --> Notify["Notify User<br/>Display Failure Details"]
    Notify --> Replan["Replan Proposal<br/>- Error Context passed to LLM<br/>- Alternative approaches<br/>- Adjusted requirements"]
    Replan --> GenAlt["Generate Alternative<br/>Proposals"]
    GenAlt --> ValidateAlt["Validate New Proposals<br/>Loop again"]
    ValidatePass -->|Yes| UserReview["Proceed to<br/>Human Review"]
    
    style Capture fill:#FFB6C1
    style Replan fill:#FFB6C1
```

---

### Path 3: Human Rejection & Replan

**Future Implementation** (Gate 9): User reviews proposal and rejects with feedback

```mermaid
flowchart TD
    HumanReview["Human Reviews<br/>Proposal + Code"]
    HumanReview --> Decision{Approve?}
    Decision -->|Approve| Implement["Implement Proposal<br/>LLM Executes"]
    Decision -->|Reject| Feedback["Provide Feedback<br/>- Design concerns<br/>- Alternative approaches<br/>- Constraints"]
    Feedback --> Store["Store Rejection<br/>- Proposal marked rejected<br/>- Feedback attached<br/>- Requirements reopened"]
    Store --> Replan["Replan with Context<br/>- Use feedback to guide<br/>- Regenerate proposals<br/>- Alternative decomposition"]
    Replan --> NewProposals["Generate New Proposals<br/>Addressing feedback"]
    NewProposals --> HumanReview
    
    style Feedback fill:#FFB6C1
    style Replan fill:#FFB6C1
    style Implement fill:#90EE90
```

---

### Path 4: Parallel Multi-Agent Execution (Subagent Orchestration)

**Planned Implementation** (Gate 13): Orchestrator creates git worktrees for independent proposals, dispatches to specialized agents

```mermaid
flowchart TD
    Gate["Gate Started<br/>Multiple Proposals"]
    Gate --> Analyze["Orchestrator Analyzes<br/>Dependency Graph"]
    Analyze --> Partition["Identify Parallel Work<br/>- Independent proposals<br/>- Can execute in parallel"]
    Partition --> CreateWT["Create Git Worktrees<br/>Per Proposal<br/>.local/worktrees/{hash}"]
    CreateWT --> Dispatch["Dispatch Subagents<br/>- Agent A: Proposal 1<br/>- Agent B: Proposal 2<br/>- Agent C: Proposal 3"]
    Dispatch --> Develop["Agents Develop<br/>Isolated Worktrees<br/>No Branch Switching"]
    Develop --> Validate["Agents Validate<br/>zeno proposal validate<br/>in worktree context"]
    Validate --> Monitor["Orchestrator Monitors<br/>Track Progress via<br/>Zeno Status Queries"]
    Monitor --> AllDone{All Agents<br/>Complete?}
    AllDone -->|No| Validate
    AllDone -->|Yes| Consolidate["Consolidate Results<br/>- Merge worktree branches<br/>- Handle conflicts<br/>- Respect dependencies"]
    Consolidate --> HumanApprove["Request Human Approval<br/>Unified consolidated work"]
    HumanApprove --> Merge["Merge to Main<br/>- Orchestrator coordinates<br/>- Cleanup worktrees"]
    
    style Develop fill:#87CEEB
    style Dispatch fill:#87CEEB
    style Monitor fill:#87CEEB
```

---

### Path 5: Rescope Mid-Project

**Planned Implementation** (Gate 11): User changes end state mid-project; regenerate future gates

```mermaid
flowchart TD
    CurrentGate["Currently at Gate 5<br/>3 gates complete<br/>9 gates planned"]
    CurrentGate --> UserChanges["User: End State Changed<br/>New constraint or goal"]
    UserChanges --> Analyze["Analyze Current State<br/>- What's complete (Gates 1-5)<br/>- What's in progress<br/>- What's planned"]
    Analyze --> RescopeAnalysis["Deep Rescope Analysis<br/>- New req implications<br/>- Architecture impact<br/>- Dependency shifts"]
    RescopeAnalysis --> GenNewPath["Generate New Gate Path<br/>From Gate 5 → Completion<br/>With new constraints"]
    GenNewPath --> CreateRescopeGate["Create Rescope Gate<br/>- Gate 5.5: Rescope Delta<br/>- Document changes<br/>- Identify affected modules"]
    CreateRescopeGate --> UpdateReqs["Update Requirements<br/>- Modify existing<br/>- Add new<br/>- Mark deprecated"]
    UpdateReqs --> RegenerateGates["Regenerate Gates 6-14<br/>Using new end state"]
    RegenerateGates --> PresentDiff["Present to User<br/>- What changed<br/>- Why gates shifted<br/>- Impact on timeline"]
    PresentDiff --> UserApprove{Approve<br/>New Path?}
    UserApprove -->|Yes| Continue["Continue from Gate 6<br/>New plan"]
    UserApprove -->|No| Iterate["Refine Constraints<br/>Try Different Rescope"]
    
    style RescopeAnalysis fill:#DDA0DD
    style CreateRescopeGate fill:#DDA0DD
    style RegenerateGates fill:#DDA0DD
```

---

## Data Locations & State Management

| Artifact | Location | Format | Updated By | When |
|----------|----------|--------|------------|------|
| Project metadata | `.zeno/project-overview.json` | JSON | `zeno init`, `zeno gates start`, `zeno gates complete` | Gate creation, start, completion |
| Gate PRDs | `zeno/gates/gate-XX-*.md` | Markdown | `zeno gates start` (generates) | Gate generation |
| Requirements | `.zeno/requirements.db` | SQLite | `zeno req` commands, gate/proposal workflows | Requirement generation/updates |
| Proposals | `zeno/proposals/gate-XX/*.md` | Markdown | `zeno proposal` commands, LLM implementations | Proposal generation/implementation |
| Diagrams | `zeno/architecture/*.md` (Mermaid/SVG) | Markdown/SVG | `zeno arch generate` | Architecture generation |
| Completed gates | `zeno/gates/archive/` | Markdown | `zeno gates complete` (archives proposals) | Gate completion |
| Git history | `.git/` | Git objects | Git hooks, auto-commit on validation pass | Code changes, quality gate pass |
| Worktree state | `.local/worktrees/{hash}/` | File system | `zeno proposal start`, `zeno proposal approve` | Proposal execution (transient) |

---

## Implementation Phases

| Phase | Gates | Status | Key Capability |
|-------|-------|--------|-----------------|
| **Initialization** | 1-5 | Complete | Project init + gate generation + diagram generation + requirement decomposition |
| **Multi-Repo** | 6 | InProgress | Repository boundary detection and scaffolding |
| **Proposals** | 7 | Planned | Proposal generation and artifact validation |
| **Validation** | 8 | Planned | Automated checks (lint, type, test, coverage, security) |
| **Approval** | 9 | Planned | Human approval workflow, rejection handling, error recovery replan |
| **Git Integration** | 10 | Planned | Git hooks, auto-commit, worktree management, conflict detection |
| **Rescope** | 11 | Planned | Mid-project end state changes, gate regeneration, delta analysis |
| **Dashboard** | 12 | Planned | Web UI, progress visualization, gate/proposal status |
| **Subagent Orch** | 13 | Planned | Cursor workflows, parallel agent execution, merge coordination |
| **Documentation** | 14 | Planned | Final docs, performance tuning, quality assessment |

---

**Document Version**: 2.0.0  
**Last Updated**: 2026-02-23  
**Status**: Approved (Happy path implemented; error recovery and rescope paths in design phase)  
**Owner**: jamesonBatworker  

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 2.0.0 | 2026-02-23 | Added error recovery, human rejection, subagent orchestration, and rescope workflow paths. Reorganized as forward-looking design with implementation phases. | jamesonBatworker |
| 1.0.0 | 2026-01-04 | Initial simplified data flow diagram (Gates 1-5 path) | jamesonBatworker |

