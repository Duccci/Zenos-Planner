# Gate 12: Dashboard & Visualization

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 12 of 13  
**Hash**: #g12dashboard

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements project status dashboard and TUI (Terminal User Interface) providing real-time visibility into project progress, gate completion, requirement implementation status, and proposal workflow. This gate delivers interactive dashboard with gate progress visualization, requirement tree visualization, proposal status board, dependency graph viewer, and real-time status updates. Dashboard becomes the primary interface for monitoring project health, enabling stakeholders to see at a glance which gates are complete, what's in progress, what's blocked, and where dependencies exist. TUI-based implementation maintains Zeno's lightweight philosophy while providing interactive exploration of project state.

## Objectives

### Dashboard Core Features
- [ ] Implement `zeno status` command (project overview with key metrics)
- [ ] Create project health summary (gates complete, in progress, pending, rejected)
- [ ] Display overall project progress percentage (based on gates completed)
- [ ] Show critical path (longest dependency chain to project completion)
- [ ] Display project timeline (created, last updated, estimated completion)

### TUI Implementation
- [ ] Create `zeno dashboard` TUI with ink or blessed
- [ ] Build interactive gate list view (click to expand gate details)
- [ ] Implement requirement tree visualization (hierarchical view with expand/collapse)
- [ ] Create proposal status board (pending, in_progress, approved, rejected)
- [ ] Build dependency graph viewer (visual representation of gate/requirement dependencies)

### Gate Progress Visualization
- [ ] Display gate status with visual indicators (pending, in_progress, completed, rejected)
- [ ] Show gate dependencies and blocks
- [ ] Display gate completion percentage (based on requirement implementation)
- [ ] Show gate timeline (start, planned completion, actual completion)
- [ ] Create gate details view (objectives, requirements, proposals)

### Requirement Status Visualization
- [ ] Display requirement tree (hierarchical parent-child relationships)
- [ ] Show requirement status (pending, implemented, tested)
- [ ] Display requirement coverage per gate
- [ ] Show requirement dependencies and blockers
- [ ] Create requirement details view (full description, acceptance criteria)

### Proposal Status Board
- [ ] Display all active proposals with status
- [ ] Show proposal validation results (pass/fail by check)
- [ ] Display proposal approval status
- [ ] Show proposal blockers (validation failures, dependencies)
- [ ] Create proposal timeline (created, submitted for approval, approved)

### Dependency Graph Visualization
- [ ] Create interactive dependency graph viewer (gates, requirements, proposals)
- [ ] Support zooming and panning
- [ ] Highlight critical path
- [ ] Show blocking relationships (what's preventing progress)
- [ ] Create cycle detection visualization (highlight circular dependencies)

### Real-Time Status Updates
- [ ] Implement status refresh (periodic updates without full re-render)
- [ ] Show file modification timestamps (know when state last changed)
- [ ] Display active proposals (which proposals currently in worktrees)
- [ ] Show blocked work (what's waiting on what)

### Performance & UX
- [ ] Keep TUI responsive (no blocking operations)
- [ ] Implement lazy loading (don't load entire project on startup)
- [ ] Create keyboard navigation (vi-style shortcuts)
- [ ] Build search functionality (find gates, requirements, proposals)
- [ ] Implement filter options (show only pending, in_progress, etc.)

### Testing & Quality
- [ ] Write unit tests for dashboard data aggregation
- [ ] Write tests for TUI rendering (snapshot tests)
- [ ] Test performance with large projects (10k+ requirements)
- [ ] Test keyboard navigation
- [ ] Achieve 90% test coverage for dashboard module

## Context

### What Was Completed Before This Gate

Gate 01-11 established:
- Full planning, execution, and rescope workflow
- All core Zeno capabilities

### What This Gate Enables

- **Stakeholder visibility**: Project status visible at a glance
- **Operational monitoring**: Detect bottlenecks and blockers quickly
- **Planning optimization**: Visual dependency graph informs better scheduling
- **Team communication**: Dashboard serves as single source of truth for project status

### Scope Boundaries

**In Scope**:
- TUI-based dashboard (ink or blessed framework)
- Project status overview (`zeno status` command)
- Gate progress visualization
- Requirement tree visualization with hierarchy
- Proposal status board
- Dependency graph viewer (interactive)
- Real-time status updates (refresh on demand)
- Keyboard navigation and search
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Web-based dashboard (TUI-only for MVP)
- Mobile app or responsive design
- Metrics/analytics (beyond progress tracking)
- Notifications or alerting
- Export functionality (beyond CLI output)
- Customizable dashboards
- Theme/style customization

## Requirements

This gate addresses visibility and monitoring requirements from project initialization:

1. **At-a-Glance Progress** - Project status visible without detailed analysis
2. **Dependency Understanding** - Visual graph shows what's blocking what
3. **Stakeholder Transparency** - Non-technical stakeholders understand progress
4. **Operational Monitoring** - Teams identify bottlenecks quickly
5. **Interactive Exploration** - Users drill down into details without leaving TUI

## Technical Decisions

### 1. TUI Framework Selection
- **Choice**: Use ink or blessed for TUI framework
- **Alternatives Considered**: Web UI, curses/blessed, custom terminal rendering
- **Rationale**: TUI keeps project lightweight, runs in any terminal, no web server required.
- **Trade-offs**: Gained portability; less visually rich than web UI

### 2. Data Aggregation Strategy
- **Choice**: Query SQLite for state, aggregate in memory for display
- **Alternatives Considered**: Pre-aggregated materialized views, streaming from files
- **Rationale**: Queries enable filtering and searching. In-memory aggregation keeps TUI responsive.
- **Trade-offs**: Gained flexibility; added aggregation complexity

### 3. Real-Time Updates
- **Choice**: Periodic refresh on user action or timer-based refresh (configurable)
- **Alternatives Considered**: File watching, event subscriptions, streaming
- **Rationale**: Simple to implement, maintains responsiveness, no background processes.
- **Trade-offs**: Gained simplicity; updates not instant

## Architecture & Dependencies

### Dashboard Data
- `DashboardAggregator` - Aggregates gate, requirement, proposal status
- `HealthMetricsCalculator` - Computes overall project health

### TUI Components
- `GateListView` - Interactive gate list with expansion
- `RequirementTreeView` - Hierarchical requirement display
- `ProposalBoardView` - Status board for proposals
- `DependencyGraphView` - Interactive dependency visualization

### Supporting Services
- `StatusFormatter` - Formats status data for display
- `KeyboardHandler` - Handles keyboard input and navigation

## Implementation Steps

1. Design TUI layout and component structure
2. Implement `zeno status` command (text-based)
3. Create TUI framework setup (ink/blessed)
4. Implement gate list view
5. Build requirement tree view
6. Create proposal status board
7. Implement dependency graph viewer
8. Add keyboard navigation and search
9. Implement real-time refresh
10. Write comprehensive tests

## Gate Completion Criteria

- [ ] `zeno status` displays project overview with key metrics
- [ ] TUI dashboard renders correctly and is navigable
- [ ] Gate progress visualization shows status, dependencies, completion %
- [ ] Requirement tree displays hierarchy with expand/collapse
- [ ] Proposal status board shows all proposals with current status
- [ ] Dependency graph viewer renders and is interactive
- [ ] Keyboard navigation works intuitively (vi-style shortcuts)
- [ ] Search functionality finds gates, requirements, proposals
- [ ] Real-time refresh updates display without blocking
- [ ] Performance acceptable with large projects (10k+ requirements)
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for dashboard module
- [ ] Zero lint errors, zero type errors
- [ ] Documentation updated for dashboard commands and TUI navigation
