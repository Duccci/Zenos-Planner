# Gate Lifecycle

**Purpose**: State machine showing the complete lifecycle of gates and proposals

**Generated**: 2026-01-04  
**Status**: Approved

---

## Diagram

```mermaid
stateDiagram-v2
    [*] --> Initialized: zeno init
    
    Initialized --> ProjectReqsGenerated: Generate project-level requirements
    
    ProjectReqsGenerated --> GatesGenerated: Zeno Engine generates gates
    
    GatesGenerated --> GateSelected: User selects gate
    
    GateSelected --> AnalyzingCode: Code analysis (if existing)
    GateSelected --> GeneratingGateRequirements: Direct (if greenfield)
    
    AnalyzingCode --> GeneratingGateRequirements: Analysis complete
    
    GeneratingGateRequirements --> GeneratingArchitecture: Gate requirements created
    
    GeneratingArchitecture --> DetectingRepos: Architecture diagrams ready
    
    DetectingRepos --> RepoApproval: Repos detected with confidence scores
    
    RepoApproval --> GeneratingProposals: Approved
    RepoApproval --> DetectingRepos: Rejected - adjust boundaries
    
    GeneratingProposals --> AutomatedChecks: Proposals created
    
    AutomatedChecks --> ChecksPassed: All checks pass
    AutomatedChecks --> ChecksFailed: Some checks fail
    
    ChecksFailed --> ReplanSubtasks: Analyze failures
    ReplanSubtasks --> GeneratingProposals: Regenerate with context
    
    ChecksPassed --> HumanApproval: Present for review
    
    HumanApproval --> Approved: User approves (zeno proposal approve)
    HumanApproval --> Rejected: User rejects (zeno proposal reject)
    
    Rejected --> ReplanSubtasks: Collect feedback
    
    Approved --> Implementing: LLM executes proposals
    
    Implementing --> Testing: Code complete
    
    Testing --> TestsPassed: Tests pass
    Testing --> TestsFailed: Tests fail
    
    TestsFailed --> ReplanSubtasks: Fix issues
    
    TestsPassed --> QualityGateCheck: Validate thresholds
    
    QualityGateCheck --> QualityPassed: Coverage 90%+, Security 0, Lint <0.01%
    QualityGateCheck --> QualityFailed: Thresholds not met
    
    QualityFailed --> ReplanSubtasks: Improve quality
    
    QualityPassed --> CommitProposal: Auto-commit with git hooks
    
    CommitProposal --> GateComplete: All proposals done
    
    GateComplete --> ReleaseGate: Create git tag (zeno gates complete)
    
    ReleaseGate --> NextGate: More gates remaining
    ReleaseGate --> ProjectComplete: Final gate
    
    NextGate --> GateSelected: Continue
    
    GateSelected --> RescopeDetected: End state changed
    RescopeDetected --> RegeneratingGates: Create rescope gate
    RegeneratingGates --> GatesGenerated: Future gates updated
    
    ProjectComplete --> [*]
    
    note right of GeneratingProposals
        Proposal Generation:
        - Template-based creation
        - Dependency tracking
        - Hash-based references
        - Store in SQLite + Markdown
    end note
    
    note right of AutomatedChecks
        Automated Checks:
        - Linting (<0.01% error rate)
        - Type checking
        - Unit tests
        - Coverage (90%+)
        - Security (0 vulnerabilities)
        - Dependency conflicts
    end note
    
    note right of HumanApproval
        Approval Workflow:
        - Review proposals + results
        - Commands: approve/reject
        - Feedback collection
        - Audit trail in database
    end note
    
    note right of QualityGateCheck
        Quality Thresholds:
        - Code Coverage: 90%
        - Security Vulnerabilities: 0
        - Linting Error Rate: <0.01%
    end note
    
    note right of CommitProposal
        Git Integration:
        - Pre-commit hooks
        - Structured commit messages
        - Proposal status updates
        - Tag creation on gate release
    end note
```

---

## State Descriptions

### Initialization Phase
- **Initialized**: Project created with `zeno init`, end state defined
- **ProjectReqsGenerated**: High-level project requirements extracted from end state (cross-cutting concerns, constraints)
- **GatesGenerated**: Zeno's paradox algorithm generates gate sequence

### Gate Execution Phase
- **GateSelected**: User chooses next gate to work on
- **AnalyzingCode**: Deep analysis of existing codebase (AST, metrics, dependencies)
- **GeneratingGateRequirements**: Gate decomposed into specific requirements by:
  - Inheriting applicable project-level requirements
  - Generating new requirements from gate objectives
  - Accepting transferred requirements from other gates (if rescoped)
- **GeneratingArchitecture**: Diagrams created from requirements (Mermaid/DOT)
- **DetectingRepos**: Repository boundaries detected using coupling metrics

### Approval Checkpoints
- **RepoApproval**: Human validates repository split recommendations
  - Approved → Continue to proposals
  - Rejected → Adjust boundaries and re-detect

### Proposal Workflow
- **GeneratingProposals**: Implementation proposals created from requirements
- **AutomatedChecks**: Validation suite runs (lint, type, test, coverage, security)
- **ChecksPassed/ChecksFailed**: Automated validation results
- **HumanApproval**: Human reviews and approves/rejects proposals
- **Approved/Rejected**: Human decision point

### Implementation Phase
- **Implementing**: LLM executes approved proposals
- **Testing**: Test suite runs
- **TestsPassed/TestsFailed**: Test results
- **QualityGateCheck**: Final quality threshold validation
- **QualityPassed/QualityFailed**: Quality gate results

### Completion Phase
- **CommitProposal**: Auto-commit with structured message
- **GateComplete**: All proposals for gate finished
- **ReleaseGate**: Git tag created for gate release
- **NextGate**: Move to next gate
- **ProjectComplete**: All gates finished

### Adaptive Phase
- **RescopeDetected**: End state changed mid-project
- **RegeneratingGates**: Future gates regenerated from current position
- **ReplanSubtasks**: Failure analysis and proposal regeneration

---

## Feedback Loops

### Automated Check Loop
```
GeneratingProposals → AutomatedChecks → ChecksFailed → ReplanSubtasks → GeneratingProposals
```
Handles validation failures without human intervention.

### Human Rejection Loop
```
HumanApproval → Rejected → ReplanSubtasks → GeneratingProposals → ... → HumanApproval
```
Incorporates human feedback into regenerated proposals.

### Test Failure Loop
```
Testing → TestsFailed → ReplanSubtasks → GeneratingProposals → ... → Testing
```
Fixes implementation issues discovered during testing.

### Quality Failure Loop
```
QualityGateCheck → QualityFailed → ReplanSubtasks → GeneratingProposals → ... → QualityGateCheck
```
Improves code quality to meet thresholds.

### Rescope Loop
```
GateSelected → RescopeDetected → RegeneratingGates → GatesGenerated → GateSelected
```
Adapts to changing project goals.

---

## Quality Thresholds (Non-Configurable in MVP)

All proposals must meet these thresholds before human approval:

- **Code Coverage**: 90% minimum
- **Security Vulnerabilities**: 0 allowed
- **Linting Error Rate**: <0.01% (1 error per 10,000 lines)
- **Type Checking**: 0 TypeScript errors (strict mode)

---

## Human Approval Gates

Human approval required at:

1. **Repository Boundaries**: Validate multi-repo split recommendations
2. **Proposals**: Approve implementation approach before execution
3. **Gate Completion**: Confirm gate release and tagging

---

## Related Documentation

- **System Overview**: `docs/architecture/system-overview.md` - Component architecture
- **Data Flow**: `docs/architecture/data-flow.md` - End-to-end process
- **Gate Roadmap**: `docs/architecture/gate-roadmap.md` - Gate roadmap
- **Project PRD**: `docs/PROJECT_PRD.md` - Quality threshold rationale

---

**Source**: `zeno/architecture/gate-lifecycle.md`  
**Generated by**: Zeno's Planner

