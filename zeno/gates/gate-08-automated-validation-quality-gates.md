# Gate 08: Automated Validation & Quality Gates

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 8 of 13  
**Hash**: #g08validate

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements comprehensive automated validation framework that enforces quality gates before human approval. This gate integrates linting (ESLint), type checking (TypeScript compiler), testing (Vitest), code coverage (c8, threshold: 90%), and security scanning (0 vulnerabilities) into a unified validation orchestrator. Delivers validation report generation with clear pass/fail status, automated checks for all proposal types, and human-understandable results. Quality gates act as automated gatekeepers, catching issues early and ensuring proposals only reach human review when they meet minimum standards, reducing reviewer burden and preventing defective code from being approved.

## Objectives

### Linting & Code Quality Checks
- [ ] Integrate ESLint for code quality (syntax, style, best practices)
- [ ] Create custom ESLint rules for Zeno conventions
- [ ] Calculate linting error rate (threshold: <0.01%, max 1 error per 10k lines)
- [ ] Build linting report generator (format errors for human review)
- [ ] Implement automatic fixable linting issues (auto-fix mode)

### Type Checking & TypeScript Validation
- [ ] Integrate TypeScript compiler API for type checking
- [ ] Enforce strict mode compilation (no implicit any, strict null checks)
- [ ] Create type error report generator
- [ ] Track compilation errors and warnings
- [ ] Support incremental type checking (only check changed files)

### Test Execution & Coverage
- [ ] Integrate Vitest for test execution
- [ ] Create test result parser (pass/fail/skip counts)
- [ ] Integrate c8 for code coverage reporting
- [ ] Enforce coverage threshold (90% minimum)
- [ ] Calculate per-file and aggregate coverage metrics
- [ ] Generate coverage report with failing files highlighted

### Security Vulnerability Scanning
- [ ] Integrate npm audit or similar for dependency vulnerabilities
- [ ] Set security threshold: 0 known CVEs (fail on any high/critical vulnerability)
- [ ] Create vulnerability report with remediations
- [ ] Track vulnerability severity (critical, high, medium, low)
- [ ] Support dependency update recommendations

### Dependency Conflict Detection
- [ ] Implement circular dependency detection (prevent cycles in codebase)
- [ ] Create cross-repo dependency validation
- [ ] Track dependency version conflicts
- [ ] Detect peer dependency mismatches
- [ ] Build conflict resolution suggestions

### Automated Validation Orchestrator
- [ ] Create unified validation runner (executes all checks sequentially or in parallel)
- [ ] Build check result aggregation (combine all check outputs)
- [ ] Implement validation timeout handling
- [ ] Create partial failure reporting (some checks fail, others pass)
- [ ] Support check skip flags (allow users to skip certain checks temporarily)

### Validation Reporting & Commands
- [ ] Implement `zeno proposal validate <hash>` command (run all checks on proposal)
- [ ] Create structured validation report (JSON and human-readable formats)
- [ ] Build validation summary dashboard (X checks passed, Y checks failed)
- [ ] Implement detailed error/warning output with file locations
- [ ] Create actionable suggestions for fixing failures

### Integration with Proposal Workflow
- [ ] Link validation to proposal status (validation required before approval)
- [ ] Create validation cache (avoid re-running unchanged checks)
- [ ] Implement incremental validation (only re-validate changed files/requirements)
- [ ] Build validation audit trail (track check results per proposal version)
- [ ] Support manual validation override (for emergency approvals, tracked in audit log)

### Testing & Quality
- [ ] Write unit tests for each validator (linting, type checking, coverage, security)
- [ ] Write integration tests for validation orchestrator
- [ ] Test validation report generation and formatting
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
- **Gate 12 (Subagent Orchestration)**: Validation results inform orchestration decisions
- **LLM-driven workflows**: `/zeno-apply` workflow uses validation before requesting approval
- **Agent feedback loops**: LLMs can iterate on failed validations without human intervention

### Scope Boundaries

**In Scope**:
- ESLint integration with custom rules for Zeno conventions
- TypeScript strict mode type checking
- Vitest test execution and result parsing
- c8 code coverage reporting with 90% threshold enforcement
- npm audit security scanning (threshold: 0 CVEs for high/critical)
- Circular and cross-repo dependency detection
- Unified validation orchestrator combining all checks
- `zeno proposal validate <hash>` command
- Structured validation reports (JSON, human-readable)
- Validation caching and incremental checking
- Actionable error messages with fix suggestions
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Custom linting rule development (beyond Zeno conventions)
- Performance profiling (no performance gates in MVP)
- Code complexity metrics (cyclomatic complexity, cognitive complexity)
- Code duplication detection
- License compliance checking
- SBOM (Software Bill of Materials) generation
- Automated code generation or fixes (beyond lint auto-fixes)
- Security vulnerability remediation (recommendations only)

## Requirements

This gate addresses quality assurance requirements from project initialization:

1. **Automated Quality Gates** - Proposals automatically validated against quality thresholds before human review
2. **Clear Feedback** - LLMs receive structured validation results enabling iteration without human intervention
3. **Zero Technical Debt** - Quality thresholds (90% coverage, 0 vulnerabilities, <0.01% lint errors) enforced before approval
4. **Audit Trail** - All validation results tracked for compliance and learning
5. **Fast Feedback Loop** - Validation completes quickly enabling rapid iteration

## Technical Decisions

### 1. Validation Threshold Enforcement
- **Choice**: Non-configurable MVP thresholds: 90% coverage, 0 CVEs (high/critical), <0.01% lint error rate
- **Alternatives Considered**: Configurable thresholds, warning-only mode, gradual enforcement
- **Rationale**: Enforce high quality from the start, prevent technical debt accumulation. Fixed thresholds simplify MVP.
- **Trade-offs**: Gained consistency and quality; lost per-project customization (deferred to v2)

### 2. Unified Validation Orchestrator
- **Choice**: Single orchestrator combining all validators, fail-fast on first critical failure
- **Alternatives Considered**: Independent validators run in isolation, parallel execution, weighted pass/fail
- **Rationale**: Fail-fast prevents wasting time on subsequent checks when fundamental issues exist. Single orchestrator simplifies result aggregation.
- **Trade-offs**: Gained clarity; slightly slower on highly parallel systems (mitigated by parallelization where safe)

### 3. Incremental Validation
- **Choice**: Cache validation results, only re-run checks for changed files
- **Alternatives Considered**: Full re-validation every time, pure streaming with no caching
- **Rationale**: Speeds up validation for large proposals by avoiding redundant checks on unchanged code.
- **Trade-offs**: Gained performance; added cache invalidation complexity

## Architecture & Dependencies

### Validators
- `ESLintValidator` - Checks code style and conventions
- `TypeScriptValidator` - Type checks with strict mode
- `VitestValidator` - Runs tests and parses results
- `CoverageValidator` - Checks code coverage (c8 integration)
- `SecurityValidator` - Scans for vulnerabilities (npm audit)
- `DependencyValidator` - Detects circular and cross-repo dependency issues

### Validation Orchestration
- `ValidationOrchestrator` - Coordinates all validators
- `ValidationCache` - Caches results for unchanged code
- `ValidationReportGenerator` - Creates human and machine-readable reports

### Validation Integration
- `ProposalValidator` - Validates entire proposals (calls orchestrator)
- `IncrementalValidator` - Only validates changed files

## Implementation Steps

1. Integrate ESLint with custom rule definitions
2. Integrate TypeScript compiler API for strict mode checking
3. Integrate Vitest and test result parsing
4. Integrate c8 for coverage reporting
5. Integrate npm audit for security scanning
6. Build dependency conflict detection
7. Create validation orchestrator
8. Implement `zeno proposal validate` command
9. Build validation report generation
10. Implement caching and incremental validation
11. Write comprehensive tests

## Gate Completion Criteria

- [ ] ESLint validation correctly identifies style and convention violations
- [ ] TypeScript type checking works in strict mode, catches all type errors
- [ ] Vitest test execution runs and reports test results correctly
- [ ] Coverage threshold (90%) enforced, reports failing files
- [ ] Security scanning detects vulnerabilities, threshold 0 enforced
- [ ] Linting error rate calculated correctly (<0.01% threshold)
- [ ] Validation orchestrator runs all checks and aggregates results
- [ ] `zeno proposal validate <hash>` executes all validators and generates report
- [ ] Validation reports are structured (JSON) and human-readable
- [ ] Caching prevents re-validation of unchanged files
- [ ] Validation results stored with proposal for audit trail
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for validation module
- [ ] Zero lint errors, zero type errors
- [ ] Documentation updated for validation workflow and thresholds
