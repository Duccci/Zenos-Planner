# Requirements & Database Layer

**Status**: completed
**Completed**: 2026-02-07

## Overview

Implements the requirements database and CRUD layer that powers Zeno's project management capabilities. Delivers gate-specific requirement generation, SQLite CRUD operations with transaction support, hash registry for content-addressable storage, dependency tracking with confidence scores, and CLI commands for querying and managing requirements.

## Consolidated Proposals Summary

*This section consolidates information from all 10 archived proposals for this gate.*

### Requirements Fulfilled

| Hash | Name | Fulfilled By |
| ---- | ---- | ------------ |
| #p04reqmgmt | Requirements Management System | #p04g03storage |
| #p04deptrack | Dependency Tracking | #p04g02hash, #p04g04depgraph |
| #p04decomp | Requirement Decomposition | #p04g05reqgen |
| #g04reqdb01 | Requirements Database Layer (gate) | All proposals |

### Lessons Learned

- **Key Decisions**:
  - Clean database regeneration preferred over complex migration for non-critical backwards compatibility
  - Status column removed: database presence equals approval semantics (Technical Decision 1)
  - Hash computed from semantic content only (type, priority, description, acceptance_criteria) for determinism
  - Transfer updates gate_id, source, and source_gate_id recursively for all descendants
  - No business logic in CLI layer (thin wrapper pattern established in Gate 03)
- **Challenges Resolved**:
  - Null/undefined type conversion in dependency graph fixed during schema migration
  - Circular dependency detection via DFS with recursion stack tracking, transaction rollback on detection
  - Hash collision handling via versioned suffixes (`_v2`, `_v3`)
  - WAL checkpoint on graceful shutdown prevents file accumulation
- **Test Dependencies**:
  - MCP tool integration tests and CLI command integration tests deferred from proposal #p04g09test (tasks 5 & 6)
  - Coverage thresholds configured in vitest.config.ts for CI enforcement

### Next Dependencies

Proposals/gates unblocked by this gate:

- **Gate 05 (Architecture & Diagram Generation)**: Requires dependency graphs and requirement data via `req_list`, `req_deps`
- **Gate 06 (Multi-Repo & Subproject Detection)**: Requires requirement queries via MCP tools
- **Gate 07 (Proposal Generation & Management)**: Requires requirement storage and retrieval via MCP tools
- **Gate 11 (Rescope & Replan Engine)**: Requires `req_transfer` MCP tool

### High-Level Delta

**Summary**:

**#p04g01dbmig** - Database Schema Migration: Removed status column from requirements table per approval semantics design. Database regenerated with 14-column schema, idempotent migration script created.

**#p04g02hash** - Hash Implementation: SHA-256 hash generation (first 16 chars) with collision detection and versioning (`_v2`, `_v3` suffixes). Integrated into requirement storage for content-addressable references.

**#p04g03storage** - Requirement Storage Layer: Complete CRUD operations with better-sqlite3 transactions. Hierarchical queries (children, ancestors, by level), circular dependency validation, cascade deletion.

**#p04g04depgraph** - Dependency Graph Utilities: Graph building integrated with requirement storage, ASCII tree and Mermaid rendering, DFS cycle detection with transaction rollback on violation.

**#p04g05reqgen** - Requirement Generator: Pattern-based extraction with confidence scoring (>0.8 auto-approve, 0.5-0.8 review, <0.5 reject). Gate-specific generation from PRDs, recursive decomposition with depth limits (max 3), child confidence = parent x 0.9.

**#p04g06mcptools** - MCP Tool Integration: Exposed req_list, req_show, req_deps, req_transfer via function-registry. Transfer logic with recursive descendant updates in transaction. Schema validation on all inputs/outputs.

**#p04g07cli** - CLI Commands: Thin wrappers for req list, req show, req deps, req transfer. All delegate to function-registry via invokeCommand(). Table/tree formatted output.

**#p04g08cleanup** - Database Cleanup Utilities: WAL checkpoint, stale file cleanup (.db-shm, .db-wal), PRAGMA integrity/foreign_key checks. CLI commands: db cleanup, db validate, db checkpoint.

**#p04g09test** - Comprehensive Testing: 130+ new test cases across 5 files. Coverage: 90%+ for src/generation/*, src/storage/*, src/utils/hash.ts. Unit (90.8%) and integration (9.2%) tests. Coverage thresholds in vitest.config.ts.

**#p04g10affprop** - Track Affected Proposals: findProposalsReferencingRequirement() scans proposals for requirement hash references. Integrated into transferRequirement() for impact analysis.

**Artifacts Created**:

- `src/storage/migrations/002_remove_status_column.sql` - Idempotent migration
- `src/generation/requirement-storage.ts` - Complete CRUD with transactions, transfer, graph building
- `src/generation/requirement-generator.ts` - Pattern-based extraction, decomposition, confidence scoring
- `src/generation/requirement-patterns.ts` - Pattern library for requirement extraction
- `src/generation/dependency-graph.ts` - Graph utilities, ASCII tree, Mermaid rendering
- `src/generation/proposals-discovery.ts` - Proposal impact scanning
- `src/utils/hash.ts` - generateRequirementHash(), detectHashCollision()
- `src/storage/database-cleanup.ts` - WAL checkpoint, stale cleanup, integrity validation
- `src/integration/requirements-registry.ts` - MCP tool wiring via function-registry
- `src/cli/commands/req.ts` - CLI thin wrappers (list, show, deps, transfer)
- `src/cli/commands/db.ts` - Database maintenance CLI commands
- `tests/generation/dependency-graph.test.ts` - 52 tests
- `tests/generation/requirement-generator.test.ts` - 30+ tests
- `tests/generation/requirement-storage.test.ts` - Comprehensive CRUD/transfer tests
- `tests/generation/proposals-discovery.test.ts` - Proposal scanning tests
- `tests/integration/requirement-lifecycle.test.ts` - 18 end-to-end tests
- `tests/integration/requirements-registry.test.ts` - Registry wiring tests
- `tests/storage/database-cleanup.test.ts` - 15 cleanup/validation tests
- `tests/utils/hash.test.ts` - 29 hash tests
- `tests/cli/commands/req.test.ts` - CLI command tests
- `vitest.config.ts` - Module-specific coverage thresholds

**Quality Metrics**:

- Total Tests: 974 passing (115 test files)
- New Tests: 130+ test cases across gate-04 modules
- Coverage: 90%+ for core modules (generation, storage, utils/hash)
- TypeScript: Strict mode, no errors
- Lint: No errors
- Total Proposals: 10 (all completed)
