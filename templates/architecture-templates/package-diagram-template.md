# Package/Module Diagram

**Purpose**: Code organization and module dependencies  
**Language**: [Primary language]  
**Generated**: [DATE]  
**Status**: [Draft/Approved/Implemented]

---

## Diagram

[Generate a Mermaid graph or DOT diagram showing directory/package structure and import relationships. Group by architectural layer. Use DOT for >10 modules.]

```mermaid
graph TB
    subgraph "Application Layer"
        API[api/]
        CLI[cli/]
    end

    subgraph "Business Logic"
        Services[services/]
        Domain[domain/]
    end

    subgraph "Infrastructure"
        Database[database/]
        External[external/]
    end

    subgraph "Shared"
        Utils[utils/]
        Types[types/]
    end

    API --> Services
    CLI --> Services
    Services --> Domain
    Services --> Database
    Services --> External
    Domain --> Types
    Services --> Utils

    classDef app fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef biz fill:#50C878,stroke:#3A9B5C,stroke-width:2px,color:#fff
    classDef infra fill:#FFA500,stroke:#CC8400,stroke-width:2px,color:#fff
    classDef shared fill:#7B68EE,stroke:#5A4AB8,stroke-width:2px,color:#fff

    class API,CLI app
    class Services,Domain biz
    class Database,External infra
    class Utils,Types shared
```

---

## Modules

[1-2 sentences per module: path, purpose, and key exports.]

- **[Module]** (`src/path/`): [Purpose and public API]

### Dependency Rules
- [Allowed direction]: [Layer] -> [Layer]
- [Forbidden]: [Layer] -> [Layer] (reason)

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
