# Gate Lifecycle

**Purpose**: Complete state machine for gate and proposal lifecycles with implementation status

**Last Updated**: 2026-02-23  
**Status**: Design document reflecting target end state through Gate 14

**Implementation Readiness**:
- Complete (Gates 1-5): Initialization, generation, architecture
- InProgress (Gate 6): Repository detection
- Planned (Gates 7-14): Proposals through completion

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

## States

- **Initialized → ProjectReqsGenerated → GatesGenerated**: Project created, requirements extracted from end state, gates generated via paradox algorithm
- **GateSelected → AnalyzingCode / GeneratingGateRequirements**: User picks gate; code analysis runs if existing codebase, then gate requirements decomposed
- **GeneratingArchitecture → DetectingRepos → RepoApproval**: Diagrams created, repo boundaries detected with confidence scores, human approves/rejects split
- **GeneratingProposals → AutomatedChecks**: Proposals created from requirements, validated (lint/type/test/coverage/security)
- **ChecksPassed → HumanApproval → Approved/Rejected**: Passing proposals presented for human review
- **Implementing → Testing → QualityGateCheck**: LLM executes code, tests run, quality thresholds enforced (90% coverage, 0 vulns, <0.01% lint)
- **CommitProposal → GateComplete → ReleaseGate**: Auto-commit, git tag on gate release
- **RescopeDetected → RegeneratingGates**: End state changed mid-project, future gates regenerated
- **ReplanSubtasks**: Universal recovery state — handles check failures, rejections, test failures, quality failures

---

---

**Document Version**: 2.0.0  
**Last Updated**: 2026-02-23  
**Status**: Target architecture (design document through Gate 14); implementation follows this flow  
**Owner**: jamesonBatworker  

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 2.0.0 | 2026-02-23 | Updated to forward-looking target design with status indicators for Gates 1-14. Added implementation readiness notes. | jamesonBatworker |
| 1.0.0 | 2026-01-04 | Initial gate lifecycle diagram (Gates 1-5 path) | jamesonBatworker |

---

## Related Documents

- [`system-overview.md`](system-overview.md) — Component architecture with implementation status
- [`data-flow.md`](data-flow.md) — Workflow paths (happy path, error recovery, rescope, subagent orchestration)
- [`../mcp-workflows.md`](../mcp-workflows.md) — State machine contracts for MCP handlers (gate/proposal transitions)
- [`../PROJECT_PRD.md`](../PROJECT_PRD.md) — Technical decisions and design rationale

