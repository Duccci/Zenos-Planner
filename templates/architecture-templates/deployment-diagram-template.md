# Deployment Diagram

**Purpose**: Runtime deployment architecture and infrastructure  
**Environment**: [dev/staging/production]  
**Generated**: [DATE]  
**Status**: [Draft/Approved/Implemented]

---

## Diagram

[Generate a Mermaid graph or DOT diagram showing physical/virtual nodes, containers, services, and relationships. Include network boundaries, load balancers, databases, and external services. Use DOT for >8 components.]

```mermaid
graph TB
    subgraph "Production"
        subgraph "DMZ"
            LB[Load Balancer]
        end
        subgraph "Application Tier"
            App1[App Server 1]
            App2[App Server 2]
        end
        subgraph "Data Tier"
            DB[(Database)]
            Cache[(Cache)]
        end
    end

    Client[Client] -->|HTTPS| LB
    LB --> App1
    LB --> App2
    App1 --> DB
    App2 --> DB
    App1 --> Cache
    App2 --> Cache

    classDef lb fill:#FF6B6B,stroke:#CC5555,stroke-width:2px,color:#fff
    classDef app fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef data fill:#FFA500,stroke:#CC8400,stroke-width:2px,color:#fff

    class LB lb
    class App1,App2 app
    class DB,Cache data
```

---

## Infrastructure

[1-2 sentences per component: type, technology, and scaling strategy.]

- **[Component]**: [Type, specs, redundancy]

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
