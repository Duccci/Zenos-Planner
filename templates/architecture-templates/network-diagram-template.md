# Network Diagram

**Purpose**: Network topology and communication patterns  
**Scope**: [Entire system/Specific subsystem]  
**Generated**: [DATE]  
**Status**: [Draft/Approved/Implemented]

---

## Diagram

[Generate a Mermaid graph or DOT diagram showing network topology, subnets, firewalls, and communication paths. Include IP ranges, ports, and protocols. Use DOT for >8 network nodes.]

```mermaid
graph TB
    subgraph "DMZ - 10.0.1.0/24"
        FW[Firewall]
        LB[Load Balancer]
    end

    subgraph "App Subnet - 10.0.2.0/24"
        App1[App Server]
        App2[App Server]
    end

    subgraph "Data Subnet - 10.0.3.0/24"
        DB[(Database)]
        Cache[(Cache)]
    end

    Internet[Internet] -->|HTTPS:443| FW
    FW --> LB
    LB -->|HTTP:8080| App1
    LB -->|HTTP:8080| App2
    App1 -->|TCP:5432| DB
    App2 -->|TCP:5432| DB
    App1 -->|TCP:6379| Cache

    classDef dmz fill:#FF6B6B,stroke:#CC5555,stroke-width:2px,color:#fff
    classDef app fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef data fill:#FFA500,stroke:#CC8400,stroke-width:2px,color:#fff

    class FW,LB dmz
    class App1,App2 app
    class DB,Cache data
```

---

## Zones

[1-2 sentences per zone: CIDR, purpose, and access level.]

- **[Zone]** (`CIDR`): [Purpose, ingress/egress rules]

### Firewall Rules

| Source | Destination | Port | Protocol | Purpose |
|--------|-------------|------|----------|---------|
| [Source] | [Dest] | [Port] | [TCP/UDP] | [Why] |

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
