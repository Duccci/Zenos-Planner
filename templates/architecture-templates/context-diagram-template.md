# Context Diagram

**Purpose**: System boundary and external interactions  
**Generated**: [DATE]  
**Status**: [Draft/Approved/Implemented]

---

## Diagram

[Generate a Mermaid graph or DOT diagram showing the target system as the central node with all external actors, systems, and services. Show data flow directions and protocols. Use DOT for >7 external entities.]

```mermaid
graph TB
    User[User/Client]
    System[Target System]
    ExtAPI[External API]
    DB[(Database)]
    FS[File System]

    User -->|HTTP/REST| System
    System -->|Queries| DB
    System -->|Read/Write| FS
    System -->|API Calls| ExtAPI
    ExtAPI -->|Responses| System
    System -->|Results| User

    classDef system fill:#4A90E2,stroke:#2E5C8A,stroke-width:3px,color:#fff,font-weight:bold
    classDef external fill:#7B68EE,stroke:#5A4AB8,stroke-width:2px,color:#fff
    classDef storage fill:#FFA500,stroke:#CC8400,stroke-width:2px,color:#fff

    class System system
    class User,ExtAPI external
    class DB,FS storage
```

---

## Boundary

**Inside**: [Components the system owns and controls]  
**Outside**: [External actors and dependencies]

### External Actors

- **[Actor]**: [Type, role, and data exchanged]

### External Systems

- **[System]**: [Purpose, protocol, and failure handling]

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
