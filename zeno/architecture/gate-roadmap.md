# Gate Roadmap Diagram

**Purpose**: Gate roadmap showing parallel relationships and gate dependencies

**Generated**: 2026-01-04  
**Last Updated**: 2026-01-31  
**Status**: Approved

---

## Diagram

```mermaid
graph TB
    Start([Project Start]) --> G1[Gate 1<br/>Core Infrastructure<br/>Completed]
    
    G1 --> G2[Gate 2<br/>Zeno Engine & Gate Generation<br/>Completed]
    
    G2 --> G2_5[Gate 2.5<br/>MCP Server & LLM Tool Integration<br/>Completed]
    
    G2_5 --> G3[Gate 3<br/>Requirements & Database Layer<br/>Completed]
    
    G3 --> G4[Gate 4<br/>Solitary Gate<br/>Completed]
    
    G4 --> G5[Gate 5<br/>Architecture & Diagram Generation<br/>Pending]
    G4 --> G6[Gate 6<br/>Multi-Repo & Subproject Detection<br/>Pending]
    
    G5 --> G7[Gate 7<br/>Proposal Generation & Management<br/>Pending]
    G6 --> G7
    
    G7 --> G8[Gate 8<br/>Automated Validation & Quality Gates<br/>Pending]
    G7 --> G9[Gate 9<br/>Human Approval & Rejection<br/>Pending]
    
    G8 --> G10[Gate 10<br/>Git Integration & Commit Automation<br/>Pending]
    G9 --> G10
    
    G10 --> G11[Gate 11<br/>Rescope & Replan Engine<br/>Pending]
    
    G11 --> G12[Gate 12<br/>Status & Reporting<br/>Pending]
    
    G12 --> End([MVP Complete])
    
    End -.-> G13[Gate 13<br/>Subagent Orchestration<br/>Post-MVP]
    G13 -.-> G14[Gate 14<br/>Documentation Cleanup<br/>Post-MVP]
    
    %% Styling
    classDef completed fill:#27AE60,stroke:#1E8449,stroke-width:3px,color:#fff,font-weight:bold
    classDef inProgress fill:#F39C12,stroke:#C87F0A,stroke-width:3px,color:#fff,font-weight:bold
    classDef pending fill:#4A90E2,stroke:#2E5C8A,stroke-width:3px,color:#fff,font-weight:bold
    classDef deferred fill:#95A5A6,stroke:#7F8C8D,stroke-width:2px,color:#fff,font-style:italic
    classDef startEndStyle fill:#9B59B6,stroke:#7D3C98,stroke-width:3px,color:#fff,font-weight:bold
    
    class G1,G2,G2_5,G3,G4 completed
    class G5,G6,G7,G8,G9,G10,G11,G12 pending
    class G13,G14 deferred
    class Start,End startEndStyle
```

---

## Description

The gate roadmap displays the MVP gate sequence (Gates 05-12) plus two deferred post-MVP gates (13-14). Gates 01-04 are archived as completed.

**Gate Summary:**
- **Gates 1-4**: Core Infrastructure, Zeno Engine, MCP Server, Requirements DB, Solitary (Completed/Archived)
- **Gates 5-6**: Architecture & Multi-Repo (diagrams, LLM-driven boundary detection) - **Parallel**
- **Gate 7**: Proposal Generation & Management (RFC 2119 requirement updates in SQLite)
- **Gates 8-9**: Validation & Approval (agent-driven quality checks and human review) - **Parallel**
- **Gate 10**: Git Integration & Worktree Automation (commit automation, isolated parallel development)
- **Gate 11**: Rescope & Replan Engine (handle mid-project scope changes)
- **Gate 12**: Status & Reporting (MCP status tools and `zeno status` CLI)
- **Gate 13**: Subagent Orchestration & Parallel Execution (post-MVP)
- **Gate 14**: Documentation Cleanup (post-MVP)

**Key Architectural Insights:**
- Gates 1-4 established infrastructure and core data structures (archived)
- Gates 5-10 implement full execution pipeline (generation → validation → approval → commit)
- Gates 11-12 add rescope adaptability and status reporting
- Gate 13 (subagent orchestration) is deferred to post-MVP for reconsideration
- Multiple parallel opportunities (Gates 5-6, 8-9) enable concurrent development

---

## Parallel Gates

Gates that can be worked on simultaneously (independent execution paths):

### Gates 5 & 6 (Post-Gate 4)
- **Gate 5**: Architecture & Diagram Generation (Mermaid/Graphviz, LLM-driven selection via MCP)
- **Gate 6**: Multi-Repo & Subproject Detection (LLM-driven boundary recommendation)

These gates are independent and can proceed in parallel after Gate 4 completes. Both require database and requirements API but have no direct dependencies on each other.

### Gates 8 & 9 (Post-Gate 7)
- **Gate 8**: Automated Validation & Quality Gates (shell-based tool invocation + agent-driven assessment)
- **Gate 9**: Human Approval & Rejection Workflow (approve/reject with feedback + MCP exposure)

Validation and approval workflows are independent systems. Validation feeds into approval but both can be developed simultaneously after Gate 7 provides proposal structure.

---

## Gate Dependencies & Critical Path

**Critical Path** (longest sequential chain):
Gate 1 → Gate 2 → Gate 2.5 → Gate 3 → Gate 4 → Gate 5/6 → Gate 7 → Gate 8/9 → Gate 10 → Gate 11 → Gate 12

This path determines minimum project timeline. Parallel opportunities (Gates 5-6, 8-9) can reduce overall time but don't affect critical path.

**Key Dependency Notes:**
- **Gate 2.5** enables: All downstream gates via MCP tool interface (LLM-native execution)
- **Gate 4 (Solitary)** consolidated MCP tooling as a prerequisite for execution pipeline
- **Gate 7** depends on: Gates 5-6 (proposal generation needs architecture diagrams and repository structure)
- **Gate 10** depends on: Gates 8-9 (git automation depends on validated, approved proposals)
- **Gate 11** depends on: Gate 10 (rescoping needs git history for impact analysis)
- **Gate 12** depends on: Gate 11 (status reporting surfaces rescope state)

---

## Related Documentation

- **Project PRD**: `zeno/PROJECT_PRD.md` - Complete project specification
- **Individual Gate PRDs**: `zeno/gates/gate-XX-name.md` - Detailed requirements per gate
  - `gate-05-architecture-diagram-generation.md` - Mermaid & Graphviz rendering
  - `gate-06-multi-repo-subproject-detection.md` - LLM-driven boundary detection
  - `gate-07-proposal-generation-management.md` - RFC 2119 requirement updates
  - `gate-08-automated-validation-quality-gates.md` - Agent-driven quality checks
  - `gate-09-human-approval-rejection-workflow.md` - Approval process and feedback
  - `gate-10-git-integration-commit-automation.md` - Worktree management and merging
  - `gate-11-rescope-replan-engine.md` - Scope change handling
  - `gate-12-status-reporting.md` - MCP status tools and CLI reporting
  - `gate-13-subagent-orchestration-parallel-execution.md` - Multi-agent coordination (post-MVP)
  - `gate-14-documentation-polish.md` - Documentation cleanup (post-MVP)
- **Archived Gates**: `zeno/gates/archive/` - Completed gates (01-04, solitary)
- **AGENTS.md**: AI agent instructions (root level and project-specific)
- **Architecture Diagrams**: `zeno/architecture/*.md` - System design diagrams

---

**Source**: `zeno/architecture/gate-roadmap.md`  
**Generated by**: Zeno's Planner  
**Last Updated**: 2026-02-13





