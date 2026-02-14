# Gate 12: Status & Reporting

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 12 of 12  
**Hash**: #g12status

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements project status reporting via `zeno status` CLI command and MCP tools. Zeno is primarily consumed as an MCP server by LLMs, so the primary interface for status is structured data returned by MCP tools. The CLI command provides a simple text summary for human verification. No TUI, no interactive dashboard, no rich terminal rendering—just queryable status data.

## Objectives

### CLI Status Command

- [ ] Implement `zeno status` command (text summary: project name, gate progress, active proposals, recent activity)
- [ ] Display gate summary table (gate number, name, status, requirement count)
- [ ] Show active proposal count and worktree status
- [ ] Display rescope state (if any active rescope pending approval)

### MCP Status Tools

- [ ] Expose `project_status` MCP tool (returns structured project overview: gates, requirements, proposals)
- [ ] Expose `gate_summary` MCP tool (returns gate list with status, completion metrics)
- [ ] Expose `requirement_summary` MCP tool (returns requirement counts by status, gate, priority)
- [ ] Expose `proposal_summary` MCP tool (returns active proposals with validation status)

### Status Data Aggregation

- [ ] Query SQLite for gate completion metrics (total, completed, in_progress, pending)
- [ ] Query requirement status distribution per gate
- [ ] Query proposal status distribution (pending, approved, rejected)
- [ ] Compute project health indicators (blocked gates, overdue proposals, orphaned requirements)

### Testing & Quality

- [ ] Write unit tests for status aggregation queries
- [ ] Write tests for CLI output formatting
- [ ] Write tests for MCP tool responses (schema validation)
- [ ] Achieve 90% test coverage for status module

## Context

### What Was Completed Before This Gate

Gates 01-11 established:
- Full planning, execution, rescope workflow
- All core Zeno capabilities for project management

### What This Gate Enables

- **MVP Completion**: Final gate for MVP release
- **LLM Visibility**: MCP tools enable LLMs to query project state and make informed decisions
- **Human Verification**: CLI command provides quick sanity check

### Scope Boundaries

**In Scope**:
- `zeno status` CLI command (plain text output)
- MCP tools for structured status queries
- SQLite-based status aggregation
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- TUI / interactive dashboard
- Rich terminal rendering (ink, blessed, or similar)
- Web-based dashboard
- Real-time updates / file watching
- Dependency graph visualization
- Keyboard navigation / search
- Performance benchmarking with large datasets
- Export functionality

## Requirements

1. **Project Overview** - LLMs and humans can query current project state
2. **Gate Tracking** - Gate completion status queryable via MCP
3. **Requirement Tracking** - Requirement status distribution queryable via MCP
4. **Proposal Tracking** - Active proposal status queryable via MCP

## Technical Decisions

### 1. No TUI Framework
- **Choice**: Plain text CLI output + structured MCP responses only
- **Rationale**: Zeno is an MCP server consumed by LLMs. Interactive TUI adds complexity with no value for the primary consumer. Humans can use `zeno status` for quick checks.

### 2. Data Aggregation
- **Choice**: Direct SQLite queries, aggregated at query time
- **Rationale**: Project sizes are small enough that real-time aggregation is fast. No materialized views needed.

## Architecture & Dependencies

### Core Components
- `StatusAggregator` - Queries SQLite for gate, requirement, proposal metrics
- `StatusFormatter` - Formats aggregated data for CLI text output

### MCP Tools
- `project_status` - Full project overview (gates, requirements, proposals, health)
- `gate_summary` - Gate list with status and completion metrics
- `requirement_summary` - Requirement counts by status, gate, priority
- `proposal_summary` - Active proposals with validation status

## Implementation Steps

1. Implement `StatusAggregator` with SQLite queries
2. Implement `StatusFormatter` for CLI text output
3. Wire up `zeno status` CLI command
4. Expose `project_status` MCP tool
5. Expose `gate_summary`, `requirement_summary`, `proposal_summary` MCP tools
6. Write comprehensive tests

## Gate Completion Criteria

- [ ] `zeno status` displays project overview with gate progress table
- [ ] `project_status` MCP tool returns structured project overview
- [ ] `gate_summary` MCP tool returns gate list with status metrics
- [ ] `requirement_summary` MCP tool returns requirement distribution
- [ ] `proposal_summary` MCP tool returns active proposal status
- [ ] All aggregation queries handle edge cases (empty project, no gates, no proposals)
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for status module
- [ ] Zero lint errors, zero type errors
