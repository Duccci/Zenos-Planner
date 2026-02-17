# System Overview

**Purpose**: High-level system architecture showing major components and relationships  
**Generated**: [DATE]  
**Status**: [Draft/Approved/Implemented]

---

## Diagram

[Generate a Mermaid graph or DOT diagram showing 3-5 architectural layers with 2-4 components per layer. Use subgraphs for layers. Apply consistent styling. Use DOT for >5 total components.]

```mermaid
graph TB
    subgraph "[Layer Name]"
        Component1[Component Name]
        Component2[Component Name]
    end

    subgraph "[Layer Name]"
        Component3[Component Name]
        Component4[Component Name]
    end

    Component1 --> Component3
    Component2 --> Component3

    classDef layer1 fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef layer2 fill:#7B68EE,stroke:#5A4AB8,stroke-width:2px,color:#fff

    class Component1,Component2 layer1
    class Component3,Component4 layer2
```

---

## Layers

[1-2 sentences per layer describing components and responsibilities.]

### [Layer Name]
[Components and what they handle]

### [Layer Name]
[Components and what they handle]

---

**Document Version**: [MAJOR.MINOR.PATCH]  
**Last Updated**: [YYYY-MM-DD]  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  
**Owner**: [git.user.name]  
**Reviewers**: [git.user.name]

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | [YYYY-MM-DD] | Initial version | [git.user.name] |
