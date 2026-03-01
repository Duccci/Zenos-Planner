# Lifecycle: [Entity/Process Name]

**Purpose**: State machine showing the complete lifecycle of [entity/process]  
**Generated**: [DATE]  
**Status**: [Draft/Approved/Implemented]

---

## Diagram

[Generate a Mermaid stateDiagram-v2 or DOT diagram showing all states, transitions, and decision points. Add notes for key states. Use DOT for >6 states.]

```mermaid
stateDiagram-v2
    [*] --> State1: trigger
    State1 --> State2: event
    State1 --> State3: alternate
    State2 --> State4: success
    State2 --> State5: failure
    State5 --> State2: retry
    State3 --> State4: converge
    State4 --> [*]: complete

    note right of State2
        Key details about this state
    end note
```

---

## States

[1-2 sentences per state describing purpose and transitions.]

- **[State Name]**: [What happens and valid transitions]
- **[State Name]**: [What happens and valid transitions]

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
