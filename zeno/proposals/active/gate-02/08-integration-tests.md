# Proposal: Implement Integration Tests for Gate Generation Workflow

**Hash**: #g02p08integration  
**Gate**: gate-02 - Zeno Engine & Gate Generation  
**Requirement**: #p02gategen  
**Status**: pending  
**Created**: 2026-01-29

---

## Summary

Implements comprehensive integration tests that validate the end-to-end gate generation workflow. Tests exercise the full system: from project initialization through gate generation, requirement extraction, CLI interaction, and PRD generation. Covers multiple project types (greenfield, existing codebase, various sizes) to ensure robustness. Validates that all components work together correctly and produce expected outputs.

---

## Context

### Requirements Context

This proposal ensures the Gate Generation Algorithm (#p02gategen) works correctly end-to-end. Integration tests validate interactions between code analysis, requirement generation, gate generation engine, template system, and CLI commands.

### Why This Change

Unit tests validate individual components, but integration tests validate that components work together correctly. Gate generation is complex with many interdependencies. Integration tests provide confidence that the system works as intended for real projects.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #g02p01analysis | requires | Uses code analyzer in integration tests |
| #g02p03reqgen | requires | Tests requirement generation workflow |
| #g02p04engine | requires | Tests full gate generation |
| #g02p05templates | requires | Tests PRD generation |
| #g02p06cli | requires | Tests CLI command workflows |

---

## Tasks

### Task 1: Create Test Fixture Projects

**File(s)**: `tests/fixtures/projects/`  
**Action**: create

Create sample test projects in various configurations:
- Greenfield project (no existing code)
- Small existing codebase (5-10 files)
- Medium existing codebase (30-50 files)  
- Complex existing codebase (100+ files, with circular dependencies)

Each fixture includes sample source code, package.json, and expected outputs.

**Acceptance**:
- [ ] Creates greenfield project fixture
- [ ] Creates small codebase fixture (TypeScript)
- [ ] Creates medium codebase fixture (mixed JS/TS)
- [ ] Creates complex codebase fixture (with circular deps)
- [ ] Each fixture has realistic source code
- [ ] Fixtures are reproducible and version-controlled

---

### Task 2: Implement Greenfield Project Integration Test

**File(s)**: `tests/integration/greenfield-project.test.ts`  
**Action**: create

Test full workflow for greenfield project (no existing code):
1. Run `zeno init` with test prompts
2. Verify project initialized correctly
3. Verify gates generated
4. Verify Gate PRDs created
5. Verify AGENTS.md generated
6. Verify database updated correctly

**Acceptance**:
- [ ] Init completes successfully with test data
- [ ] Project configuration saved correctly
- [ ] Gates generated with appropriate count/structure
- [ ] All gate PRDs created in zeno/gates/
- [ ] AGENTS.md created with project overview
- [ ] Database has gates and requirements entries

---

### Task 3: Implement Existing Codebase Integration Test

**File(s)**: `tests/integration/existing-codebase.test.ts`  
**Action**: create

Test full workflow for project with existing codebase:
1. Run `zeno init` pointing to test codebase
2. Verify code analysis runs successfully
3. Verify code metrics calculated correctly
4. Verify gates generated considering existing code
5. Verify gates account for technical debt/complexity
6. Verify requirements extracted from end state + code analysis

**Acceptance**:
- [ ] Code analysis completes for test codebase
- [ ] Metrics (coupling, complexity, LOC) calculated
- [ ] Dependency graph built correctly
- [ ] Gates generated reflect code complexity
- [ ] Requirements include code quality/refactoring needs
- [ ] Integration with existing code identified correctly

---

### Task 4: Implement Gate State Transition Integration Test

**File(s)**: `tests/integration/gate-lifecycle.test.ts`  
**Action**: create

Test gate lifecycle state transitions:
1. Create project and generate gates
2. Verify gates start in `pending` status
3. Run `zeno gates start` on first gate
4. Verify gate status changed to `in_progress`
5. Verify gate-specific requirements generated
6. Run `zeno gates complete` on gate
7. Verify gate status changed to `completed`
8. Verify git tag created (if in git repo)

**Acceptance**:
- [ ] Gate starts in pending status
- [ ] `gates start` transitions to in_progress
- [ ] Gate-specific requirements generated on start
- [ ] `gates complete` transitions to completed
- [ ] Git tag created for completed gate
- [ ] Database reflects state transitions

---

### Task 5: Implement CLI Workflow Integration Test

**File(s)**: `tests/integration/cli-workflow.test.ts`  
**Action**: create

Test complete CLI workflow:
1. Init project via `zeno init` command
2. List gates via `zeno gates list`
3. Show gate details via `zeno gates show <gate>`
4. Start gate via `zeno gates start <gate>`
5. Verify output formatting and error handling

**Acceptance**:
- [ ] `zeno init` completes and creates project files
- [ ] `zeno gates list` shows all gates in table format
- [ ] `zeno gates show` displays full gate details
- [ ] `zeno gates start` handles confirmation prompts
- [ ] Error handling for invalid gates/operations
- [ ] Output formatting is consistent and readable

---

### Task 6: Implement Quality Validation Integration Test

**File(s)**: `tests/integration/quality-validation.test.ts`  
**Action**: create

Test that generated artifacts meet quality thresholds:
1. Verify generated code passes TypeScript strict mode
2. Verify tests achieve 90% coverage
3. Verify linting errors < 0.01%
4. Verify no security vulnerabilities
5. Verify gate PRDs are well-formed Markdown

**Acceptance**:
- [ ] All generated code is TypeScript strict-mode valid
- [ ] Test coverage of generation modules ≥ 90%
- [ ] Linting error rate < 0.01%
- [ ] No npm audit vulnerabilities found
- [ ] Gate PRDs valid Markdown (parse successfully)
- [ ] All hash references valid format

---

### Task 7: Implement Error Handling Integration Test

**File(s)**: `tests/integration/error-handling.test.ts`  
**Action**: create

Test error scenarios and recovery:
1. Invalid project directory (doesn't exist)
2. Invalid end state (empty/invalid input)
3. Unreadable codebase (permission issues - mock)
4. Corrupt database state
5. Invalid gate transitions
6. File system errors during PRD writing

**Acceptance**:
- [ ] Invalid inputs produce helpful error messages
- [ ] Partial failures don't corrupt state
- [ ] Recovery suggestions provided where possible
- [ ] Database remains consistent after errors
- [ ] No unhandled exceptions in error scenarios

---

### Task 8: Write Integration Test Harness

**File(s)**: `tests/integration/harness.ts`  
**Action**: create

Create test harness utilities for integration tests:
- Project fixture setup/teardown
- Mock user input for interactive commands
- Assertion helpers for gates, requirements, files
- Database state inspection utilities
- File system helpers (create temp dirs, cleanup)

**Acceptance**:
- [ ] Fixtures set up correctly for each test
- [ ] Cleanup removes all test artifacts
- [ ] Mock input simulates user interactions
- [ ] Assertion helpers verify expected state
- [ ] No side effects between tests (isolation)

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `tests/fixtures/projects/greenfield/` | create | Greenfield project test fixture |
| `tests/fixtures/projects/small-codebase/` | create | Small codebase fixture |
| `tests/fixtures/projects/medium-codebase/` | create | Medium codebase fixture |
| `tests/fixtures/projects/complex-codebase/` | create | Complex codebase fixture |
| `tests/integration/greenfield-project.test.ts` | create | Greenfield workflow tests |
| `tests/integration/existing-codebase.test.ts` | create | Existing codebase tests |
| `tests/integration/gate-lifecycle.test.ts` | create | Gate state transition tests |
| `tests/integration/cli-workflow.test.ts` | create | CLI command workflow tests |
| `tests/integration/quality-validation.test.ts` | create | Quality threshold tests |
| `tests/integration/error-handling.test.ts` | create | Error scenario tests |
| `tests/integration/harness.ts` | create | Test harness utilities |

---

## Implementation Notes

- Use temporary directories for test projects (clean up after)
- Mock file system operations where needed for error scenarios
- Integration tests should be fast but thorough (balance coverage vs. speed)
- Fixtures should be minimal but realistic
- Tests should validate both happy path and edge cases
- Consider skipping permission-based tests on Windows (or mock appropriately)
- Database should be isolated per test (fresh instance)

---

## Rollback

If rejected or failed: Delete all test files in `tests/integration/` and fixtures in `tests/fixtures/`.
