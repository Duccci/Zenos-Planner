# Data Flow

**Purpose**: End-to-end data flow from user input to project completion  
**Generated**: [DATE]  
**Status**: [Draft/Approved/Implemented]

---

## Diagram

[Generate a Mermaid flowchart or DOT diagram showing the complete data flow. Include process steps, decision points, storage operations, and feedback loops. Use DOT for >5 total nodes.]

```mermaid
flowchart TD
    Start([User Input]) --> Process1[Process Step]
    Process1 --> Decision1{Decision?}
    Decision1 -->|Yes| Process2[Path A]
    Decision1 -->|No| Process3[Path B]
    Process2 --> Store[(Storage)]
    Process3 --> Store
    Store --> End([Complete])

    classDef storage fill:#FFA500,stroke:#CC8400,stroke-width:2px,color:#fff
    classDef process fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef decision fill:#FF6B6B,stroke:#CC5555,stroke-width:2px,color:#fff

    class Store storage
    class Process1,Process2,Process3 process
    class Decision1 decision
```

---

## Phases

[1-2 sentences per phase describing key steps and data transformations.]

### [Phase Name 1]

[What happens and what data moves]

### [Phase Name 2]

[What happens and what data moves]

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
