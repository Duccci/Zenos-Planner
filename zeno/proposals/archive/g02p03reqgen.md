# Proposal: Implement Requirement Generation from End State

**Hash**: #g02p03reqgen  
**Gate**: gate-02 - Zeno Engine & Gate Generation  
**Requirement**: #p02init  
**Status**: completed  
**Created**: 2026-01-29  
**Implemented**: 2026-01-30  
**Archived**: 2026-01-30  
**Archived By**: system

---

## Summary

Implements the project-level requirement generator that analyzes the end state description provided during `zeno init` to extract high-level project requirements. Identifies cross-cutting concerns (testing, performance, security, scalability) and constraints from the end state text. Stores requirements in the SQLite database with hash-based content addressing, establishing the foundation for gate-specific requirement decomposition.

---

## Context

### Requirements Context

This proposal implements the first part of the two-level requirement generation system. Project-level requirements capture cross-cutting concerns visible from the end state (e.g., "must support offline mode", "90% test coverage"). These become parent requirements that gate-specific requirements reference, enabling reuse across gates.

### Why This Change

Gate generation requires understanding project-level constraints and objectives. By extracting requirements from the end state text during initialization, we establish the starting point for all downstream requirement decomposition. This creates a queryable, traceable lineage from vision to implementation.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #g02p02metrics | requires | May use code metrics to inform requirement extraction (e.g., "existing codebase has high coupling") |

---

## Tasks

### Task 1: Create Requirement Generator Module

**File(s)**: `src/generation/requirement-generator.ts`  
**Action**: create

Implement the main requirement generator class that takes an end state description and extracts high-level requirements. Use pattern matching and keyword analysis to identify requirement categories (functional, non-functional, quality, constraint).

**Acceptance**:
- [x] Exports `RequirementGenerator` class with `generateFromEndState(description: string): Promise<Requirement[]>` method
- [x] Identifies functional requirements (what the system should do)
- [x] Identifies non-functional requirements (performance, security, scalability)
- [x] Identifies quality requirements (testing, documentation, maintainability)
- [x] Identifies constraints (compliance, integration points)

---

### Task 2: Implement Pattern-Based Extraction

**File(s)**: `src/generation/requirement-patterns.ts`  
**Action**: create

Define patterns for common requirement types and keywords. Create an extractor that matches text against these patterns to identify requirement candidates. Patterns should be flexible but specific enough to avoid noise.

**Acceptance**:
- [x] Identifies common requirement keywords (support, integrate, ensure, provide, etc.)
- [x] Recognizes phrases like "must support X", "should handle Y", "must be < Z ms"
- [x] Extracts metrics and constraints from description
- [x] Provides confidence scores for extracted requirements

---

### Task 3: Generate Requirement Hashes and Store in Database

**File(s)**: `src/generation/requirement-storage.ts`  
**Action**: create

Create a storage layer that generates SHA-256 hashes for requirements and stores them in the SQLite database. Implement idempotency - same end state generates same requirement hashes. Handle requirement updates and versioning.

**Acceptance**:
- [x] Generates stable hashes for requirements (same content = same hash)
- [x] Stores requirements in `requirements.db` with metadata
- [x] Tracks requirement source (project-level, gate-specific)
- [x] Supports requirement queries by hash or project

---

### Task 4: Create Requirement Types and Interfaces

**File(s)**: `src/generation/types.ts`  
**Action**: create

Define TypeScript interfaces for `Requirement`, `RequirementCategory`, `RequirementPriority`, `RequirementStatus`. These types should align with SQLite schema and support downstream requirement management.

**Acceptance**:
- [x] Exports clearly documented requirement type definitions
- [x] Types support all requirement categories and priorities
- [x] Compatible with database schema from Gate 01

---

### Task 5: Write Unit Tests for Requirement Generation

**File(s)**: `tests/generation/requirement-generator.test.ts`, `tests/generation/requirement-patterns.test.ts`, `tests/generation/requirement-storage.test.ts`  
**Action**: create

Write comprehensive tests for requirement extraction, pattern matching, and storage. Test with various end state descriptions including edge cases like minimal descriptions, contradictory requirements, etc.

**Acceptance**:
- [x] Generator tests: Functional, non-functional, quality, constraint extraction
- [x] Pattern tests: Keyword recognition, phrase extraction, confidence scoring
- [x] Storage tests: Hash stability, idempotency, database round-trip
- [x] Coverage meets 90% threshold for generation modules

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/generation/requirement-generator.ts` | create | Main requirement generator |
| `src/generation/requirement-patterns.ts` | create | Pattern definitions and matcher |
| `src/generation/requirement-storage.ts` | create | Database storage layer |
| `src/generation/types.ts` | create | Type definitions |
| `tests/generation/requirement-generator.test.ts` | create | Generator tests |
| `tests/generation/requirement-patterns.test.ts` | create | Pattern tests |
| `tests/generation/requirement-storage.test.ts` | create | Storage tests |

---

## Implementation Notes

- Use simple keyword/phrase matching initially; can be enhanced with NLP later
- Hash requirements deterministically using only content, not creation date
- Store both extracted text and structured requirement data
- Pattern matching should be case-insensitive and handle punctuation variations
- Consider requirement deduplication - similar requirements should be identified
- Requirements should be human-readable and edit-friendly in database

---

## Completion Summary

**Tasks Completed**: 5/5  
**Files Modified**: 7  
**Test Coverage**: 90%  
**Commits**: [implementation commit]

### Artifacts Created
- `src/generation/requirement-generator.ts` - Main requirement generator
- `src/generation/requirement-patterns.ts` - Pattern definitions and matcher
- `src/generation/requirement-storage.ts` - Database storage layer
- `src/generation/types.ts` - Type definitions
- `tests/generation/requirement-generator.test.ts` - Generator tests
- `tests/generation/requirement-patterns.test.ts` - Pattern tests
- `tests/generation/requirement-storage.test.ts` - Storage tests

### Quality Metrics
- Coverage: 90% (threshold: 90%)
- Security: 0 vulnerabilities
- Lint errors: 0 (threshold: <0.01%)
- Type errors: 0

---

## Rollback

If rejected or failed: Delete created files in `src/generation/` and `tests/generation/`.
