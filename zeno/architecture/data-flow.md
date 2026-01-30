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

## Flow Phases

### Phase 1: Initialization
1. User describes end state in natural language
2. `zeno init` parses and validates end state
3. Check if existing codebase or greenfield project

### Phase 2: Analysis (Existing Codebases Only)
1. Deep code analysis: AST parsing, dependency extraction, metrics calculation
2. Extract start state: current architecture, module structure, complexity
3. Feed start state into Zeno algorithm

### Phase 3: Gate Generation & Project Requirements
1. Zeno's paradox algorithm generates gate sequence
2. Each gate closes half remaining distance to end state
3. Project-level requirements generated from end state (cross-cutting concerns, constraints)
4. Project requirements stored in SQLite with `level=project`
5. Gates stored in SQLite (metadata) + Files (PRDs)

### Phase 4: Gate Execution Loop
For each gate:

#### 4a. Gate Requirement Generation
1. User selects gate to work on
2. Gate-specific requirements generated by decomposing:
   - Applicable project-level requirements (inherited)
   - Gate objectives and planned capabilities (generated)
   - Requirements transferred from other gates (if rescoped)
3. Gate requirements stored in SQLite with `level=gate` and source tracking

#### 4b. Architecture Generation
1. Diagrams generated from requirements (Mermaid for simple, DOT/SVG for complex)
2. Diagrams stored as `.md` files with embedded Mermaid or SVG (version controlled)

#### 4c. Repository Detection
1. Analyze coupling metrics, domain boundaries, module size
2. Calculate confidence scores for repo split recommendations
3. Human approval required for multi-repo splits
4. If rejected: adjust boundaries and re-detect
5. If approved: scaffold repositories with package.json, tsconfig, etc.

#### 4d. Dependency Tracking
1. Build cross-repository dependency graph
2. Store dependencies with hash-based references
3. Enable conflict detection across repos

### Phase 5: Proposal Workflow
1. Generate implementation proposals from requirements
2. Store proposals in SQLite + Markdown files
3. Run automated checks: lint, type, test, coverage, security
4. If checks fail: store results, replan with error context, regenerate
5. If checks pass: present to human for approval

### Phase 6: Human Approval
1. Human reviews proposals and automated check results
2. If rejected: collect feedback, replan, regenerate proposals
3. If approved: update proposal status, proceed to implementation

### Phase 7: Implementation
1. LLM executes approved proposals in Cursor
2. Generate code according to proposal specifications
3. Run test suite
4. If tests fail: replan and regenerate
5. If tests pass: run quality gate checks

### Phase 8: Quality Validation
1. Check coverage (90%+), security (0 vulnerabilities), linting (<0.01% errors)
2. If thresholds not met: replan and improve quality
3. If thresholds met: auto-commit with structured message

### Phase 9: Gate Completion
1. Check if all proposals for gate are complete
2. If incomplete: return to gate execution loop
3. If complete: create git tag for gate release

### Phase 10: Project Continuation
1. Check if more gates remain
2. If no more gates: project complete
3. If more gates: check for rescope
   - If end state changed: generate rescope gate, regenerate future gates
   - If no rescope: continue to next gate

---

## Storage Operations

### SQLite Database
- Gates (metadata, status, sequence)
- Requirements (hierarchical, hashed)
- Proposals (status, check results, approval)
- Dependencies (cross-repo, hash-based)
- Repositories (metadata, boundaries)
- Hash Registry (content-addressable lookup)

### File System
- Gate PRDs (`.zeno/gates/gate-XX-name.md`)
- Architecture diagrams (`zeno/architecture/*.md`)
- Proposals (`zeno/proposals/active/gate-XX/<name>.md`, archived: `zeno/proposals/completed/<hash>.md`)
- Project PRD (`docs/PROJECT_PRD.md`)
- Configuration (`.zeno/config.json`)

### Git Repository
- All files version controlled
- Structured commit messages on proposal approval
- Git tags on gate releases
- Pre-commit hooks for validation

---

## Feedback Loops

### Automated Check Failure Loop
```
GenProposals → AutoChecks → CheckResults (No) → StoreFailed → Replan → GenProposals
```

### Human Rejection Loop
```
HumanReview (Reject) → CollectFeedback → Replan → GenProposals → ... → HumanReview
```

### Test Failure Loop
```
RunTests → TestResults (No) → Replan → GenProposals → ... → RunTests
```

### Quality Failure Loop
```
QualityCheck → QualityResults (No) → Replan → GenProposals → ... → QualityCheck
```

### Repository Boundary Loop
```
DetectRepos → CalcConfidence → RepoApproval (No) → AdjustBoundaries → DetectRepos
```

### Rescope Loop
```
CheckRescope (Yes) → RescopeGate → RegenerateGates → SelectGate
```

---

## Data Transformations

| Input | Process | Output |
|-------|---------|--------|
| End State (text) | Parse + Validate | Structured Goal |
| Existing Codebase | AST Analysis | Start State |
| Start + End State | Zeno Algorithm | Gate Sequence |
| End State | Requirement Extraction | Project Requirements |
| Gate + Project Reqs | Decomposition | Gate Requirements Tree |
| Requirements | Generation | Mermaid Diagrams |
| Requirements | Analysis | Repository Boundaries |
| Requirements | Generation | Proposals |
| Proposals | Validation | Check Results |
| Approved Proposals | LLM Execution | Code |
| Code | Testing | Test Results |
| Code | Analysis | Quality Metrics |

---

## Related Documentation

- **System Overview**: `docs/architecture/system-overview.md` - Component architecture
- **Gate Lifecycle**: `docs/architecture/gate-lifecycle.md` - State machine
- **Gate Roadmap**: `docs/architecture/gate-roadmap.md` - Gate roadmap
- **Project PRD**: `docs/PROJECT_PRD.md` - Full specification

---

**Source**: `zeno/architecture/data-flow.md`  
**Generated by**: Zeno's Planner

