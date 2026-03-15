# Gate Roadmap

**Purpose**: Gate sequence, dependencies, and parallel work opportunities
**Generated**: [DATE]
**Status**: [Draft/Approved/Implemented]

---

## Diagram

[Generate a Mermaid graph or DOT diagram showing all gates from project start to completion. Show sequential dependencies with arrows and parallel gates branching from common points. Use DOT for >8 gates.]

```mermaid
graph TB
    subgraph Phase1["Phase 1 — MVP"]
        G1[Gate 1: Name]
        G2[Gate 2: Name]
        G3[Gate 3: Name]
    end
    subgraph Phase2["Phase 2 — Post-MVP"]
        G4[Gate 4: Name]
        G5[Gate 5: Name]
        G6[Gate 6: Name]
    end

    Start([Project Start]) --> G1
    G1 --> G2
    G2 --> G3
    G3 --> G4
    G3 --> G5
    G4 --> G6
    G5 --> G6
    G6 --> End([Complete])

    classDef gate fill:#4A90E2,stroke:#2E5C8A,stroke-width:3px,color:#fff,font-weight:bold
    classDef terminal fill:#9B59B6,stroke:#7D3C98,stroke-width:3px,color:#fff

    class G1,G2,G3,G4,G5,G6 gate
    class Start,End terminal
```

---

## Sequencing

**Phases**: [Group gates by delivery milestone — e.g. Phase 1 (MVP): gates 1-4; Phase 2 (Post-MVP): gates 5-7; or named milestones like 'May Demo', 'Beta', 'GA'. Deferred/Backup gates noted separately.]
**Parallel Gates**: [Identify gates that can run simultaneously and why]
**Critical Path**: [Longest sequential chain through the roadmap]

---

**Document Version**: [MAJOR.MINOR.PATCH]
**Last Updated**: [YYYY-MM-DD]
**Versioning**: SemVer; bump on any change (minimum: PATCH).
**Owner**: [git.user.name]
**Reviewers**: [git.user.name]

### Change Log

| Version | Date         | Summary         | Author          |
|---------|--------------|-----------------|-----------------|
| 1.0.0   | [YYYY-MM-DD] | Initial version | [git.user.name] |
