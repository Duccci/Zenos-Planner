# Gate 08: Automated Validation & Quality Gates

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 8 of 12  
**Hash**: #g08validate

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements automated validation that enforces quality gates before human approval. Rather than hardcoding each validator, this gate creates a lightweight validation orchestrator that invokes existing tooling (ESLint, tsc, Vitest, npm audit) and leverages agent scripts from `agents/pipeline-agents/00-quality-assurance/` for configurable, LLM-driven quality assessment. The `quality-gate-controller` and `validation-depth-controller` agents define quality criteria and validation intensity; Zeno orchestrates their invocation via MCP. Quality gates catch issues early, ensuring proposals meet minimum standards before reaching human review.

## Objectives

### Validation Orchestrator
- [ ] Create unified validation runner (invokes checks and aggregates results)
- [ ] Invoke ESLint for code quality (via shell, standard rules — no custom Zeno rules)
- [ ] Invoke TypeScript compiler for strict mode type checking (via shell)
- [ ] Invoke Vitest for test execution and result parsing (via shell)
- [ ] Invoke coverage tool (c8) for coverage reporting with 90% threshold
- [ ] Invoke npm audit for dependency vulnerability scanning (threshold: 0 high/critical)
- [ ] Aggregate pass/fail results into structured validation report

### Agent-Driven Quality Assessment
- [ ] Expose validation results via MCP tool for LLM/agent consumption
- [ ] Leverage `quality-gate-controller` agent for configurable quality criteria
- [ ] Leverage `validation-depth-controller` agent for validation intensity scaling
- [ ] Agent scripts determine which checks run and at what depth — Zeno orchestrates execution
- [ ] No hardcoded ESLint rule definitions or custom validator classes

### Validation Reporting
- [ ] Implement `zeno proposal validate <hash>` command (run all checks on proposal)
- [ ] Create structured validation report (pass/fail per check, error details)
- [ ] Provide actionable error messages with file locations
- [ ] Return machine-readable results for LLM iteration

### Shared Conflict Detection Module
- [ ] Implement file-level conflict detection as a shared module (consumed by Gates 06, 10)
- [ ] Detect circular dependencies via requirement/proposal dependency graph
- [ ] Consolidate conflict detection logic (single implementation, not duplicated per gate)

### Testing & Quality
- [ ] Write unit tests for validation orchestrator
- [ ] Write tests for validation report generation
- [ ] Test threshold enforcement (coverage, linting, security)
- [ ] Achieve 90% test coverage for validation module

## Context

### What Was Completed Before This Gate

Gate 01-07 established:
- Core infrastructure and CLI framework
- Gate and requirement generation systems
- MCP server and function registry
- Requirements database and architecture diagrams
- Multi-repo support and proposal generation

### What This Gate Enables

- **Gate 9 (Human Approval)**: Only validated proposals reach human review
- **Gate 10 (Git Integration)**: Validated proposals committed to git with safety assurance

### Scope Boundaries

**In Scope**:
- Validation orchestrator wrapping existing tools (ESLint, tsc, Vitest, c8, npm audit)
- Agent-driven quality assessment via `quality-gate-controller` and `validation-depth-controller`
- `zeno proposal validate <hash>` command
- Structured validation reports (machine and human readable)
- Shared conflict detection module
- Threshold enforcement: 90% coverage, 0 CVEs (high/critical), <0.01% lint error rate
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Custom ESLint rule development
- Hardcoded validator classes per check type
- Validation caching and incremental checking (premature optimization)
- Performance profiling or complexity metrics
- Code duplication detection
- License compliance or SBOM generation

## Requirements

1. **Automated Quality Gates** — Proposals validated against quality thresholds before human review
2. **Clear Feedback** — LLMs receive structured validation results enabling iteration
3. **Agent-Configurable** — Quality criteria and validation depth configured via agent scripts, not hardcoded
4. **Shared Conflict Detection** — Single conflict detection module used across gates

## Technical Decisions

### 1. Shell-Based Tool Invocation
- **Choice**: Invoke ESLint, tsc, Vitest, c8, npm audit via shell commands and parse output
- **Alternatives Considered**: TypeScript compiler API, programmatic ESLint API, custom validator classes
- **Rationale**: Shell invocation is simple, leverages existing tool installations, and keeps Zeno lightweight. No need to import these tools as dependencies — they're project development tools.
- **Trade-offs**: Gained simplicity; parsing shell output is less reliable than programmatic APIs (acceptable for MVP)

### 2. Agent-Driven Quality Configuration
- **Choice**: Leverage `quality-gate-controller` and `validation-depth-controller` agents from `agents/pipeline-agents/00-quality-assurance/`
- **Alternatives Considered**: Hardcoded validator classes, configurable YAML quality profiles
- **Rationale**: Agent scripts already define quality criteria and validation intensity scaling. Zeno exposes validation results via MCP; agents assess and configure. Keeps Zeno as an orchestrator, not a quality engine.
- **Trade-offs**: Gained configurability and LLM-driven assessment; depends on agent quality

### 3. Non-Configurable MVP Thresholds
- **Choice**: Fixed thresholds for MVP: 90% coverage, 0 CVEs (high/critical), <0.01% lint error rate
- **Rationale**: Enforce high quality from the start. Configurable thresholds deferred to post-MVP.

## Implementation Steps

1. Create validation orchestrator (shell command runner + result aggregator)
2. Implement ESLint, tsc, Vitest, c8, npm audit invocations
3. Build structured validation report format
4. Implement `zeno proposal validate` command
5. Expose validation results via MCP tool
6. Implement shared conflict detection module
7. Write comprehensive tests

## Gate Completion Criteria

- [ ] Validation orchestrator invokes all checks and aggregates results
- [ ] ESLint, TypeScript, Vitest, coverage, and security checks all execute correctly
- [ ] Validation report clearly shows pass/fail per check with error details
- [ ] Coverage threshold (90%) enforced, failing files reported
- [ ] Security scanning detects vulnerabilities, threshold 0 enforced
- [ ] `zeno proposal validate <hash>` runs all checks and reports results
- [ ] Validation results exposed via MCP tool for agent consumption
- [ ] Shared conflict detection module works for file-level overlap detection
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for validation module
- [ ] Zero lint errors, zero type errors
- [ ] Validation reports are structured (JSON) and human-readable
- [ ] Caching prevents re-validation of unchanged files
- [ ] Validation results stored with proposal for audit trail
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for validation module
- [ ] Zero lint errors, zero type errors
- [ ] Documentation updated for validation workflow and thresholds
