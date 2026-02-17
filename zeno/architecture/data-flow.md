# Data Flow

**Purpose**: End-to-end data flow from user input to project completion

**Generated**: 2026-01-04  
**Status**: Approved

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

## Phases

### Initialization
User describes end state → `zeno init` parses it → checks for existing codebase → deep code analysis if found.

### Gate Generation
Zeno paradox algorithm generates gates → project-level requirements extracted from end state → stored in SQLite.

### Gate Execution
User selects gate → gate requirements decomposed from project reqs + objectives → architecture diagrams generated → repo boundaries detected → proposals generated.

### Proposal Validation
Automated checks (lint/type/test/coverage/security) → if fail: replan with context → if pass: human review → if reject: collect feedback + replan → if approve: LLM executes.

### Implementation & Quality
LLM generates code → run tests → quality gate check (90% coverage, 0 vulns, <0.01% lint) → auto-commit with structured message.

### Gate Completion
All proposals done → create git tag → check for more gates → check for rescope → continue or complete.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-04  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  
**Owner**: jamesonBatworker  
**Reviewers**: jamesonBatworker

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-01-04 | Initial version | jamesonBatworker |

