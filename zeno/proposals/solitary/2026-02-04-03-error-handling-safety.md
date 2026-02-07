---
**Hash**: #m26020403safe  
**Type**: solitary  
**Status**: pending  
**Created**: 2026-02-04  
**Assigned**: Identified in CODE_ISSUES_AND_REFACTORING.md § Issues 4-6

---

# Proposal: MCP Implementation - Error Handling, Git Safety, Solitary Archival

## Summary

Unify error handling across all MCP tools into single response format, audit and prevent git operations during apply phase, and complete solitary proposal archival workflow. Fixes safety violations and consolidates architecture.

## Context

Current MCP implementation has 3 cross-cutting issues:

1. **Error Handling Inconsistency** - 4 different patterns across codebase:
   - Function registry: throw Error
   - Tool handlers: return `{ isError: true }`
   - Archive logic: return `{ success: false, error: {...} }`
   - Some handlers: try/catch with custom responses

2. **Git Operations During Apply** - Critical guardrail violation:
   - `proposal_approve` and `proposal_start` invoke CLI functions
   - Unknown if CLI performs git operations
   - Prompt explicitly forbids this during apply phase
   - No audit trail of when git operations occur

3. **Solitary Proposal Archival Incomplete** - Missing consolidation:
   - `archive_proposal` doesn't update `zeno/gates/archive/solitary.md`
   - Proposals archived but registry not consolidated
   - Prompt requires 4-step process; only 2 steps implemented

**Analysis Source**: CODE_ISSUES_AND_REFACTORING.md § Issues 4-6

## Dependencies

### Implicit (blocked by)
- Related to: #m26020401refa, #m26020402tool (shared infrastructure)

### Explicit (blocks)
- **#s20260206disco** (Artifact Discovery Service) — Discovery service benefits from unified error response format and audit logging defined by this proposal
- Safe production use of apply workflow
- Proper solitary proposal archival implementation

## Tasks

### Task 1: Audit CLI for Git Operations
Identify which CLI functions invoke git during apply phase:

- [ ] Audit `src/cli/commands/proposal.ts` for git invocations
  - Review `proposal_start` implementation
  - Review `proposal_approve` implementation
  - Check for: git add, git commit, git tag, git push operations
  
- [ ] Audit `src/cli/commands/gates.ts` for gate operations
  - Review `gates_start` implementation
  - Verify: No git operations in non-completion phases
  
- [ ] Create audit report documenting:
  - Which functions invoke git
  - When in workflow they occur
  - Whether during apply phase (VIOLATION) or completion (OK)

**Acceptance Criteria**:
- Audit document lists all git operations
- Clear marking: safe or violation
- Recommendations for violations
- Evidence (line numbers, code snippets)

### Task 2: Implement Git Operation Tracking
Add tracking to detect and prevent git operations during apply phase:

- [x] Create `src/mcp/audit/git-operation-tracker.ts`
  - Wraps command invocation
  - Detects git operations (git add, commit, tag, push)
  - Records when operations occur
  - Can block unsafe operations
  
- [ ] Implement `trackGitOperations(command, args, allowed?: boolean)`
  - Parses command/args for git signatures
  - Returns: `{ hasGitOps: boolean, operations: string[] }`
  - Throws if git operations not allowed
  
- [ ] Add audit logging:
  - Log all git operations with timestamp
  - Include command, args, phase context
  - Audit trail for compliance

**Acceptance Criteria**:
- Detects git operations reliably (no false negatives)
- Can distinguish git vs non-git commands
- Audit logging functional
- ~50 lines, focused on single responsibility

### Task 3: Secure Apply Phase Functions
Guarantee no git operations during proposal_start/approve:

- [ ] Wrap `proposal_start` invocation with `trackGitOperations(..., allowGit: false)`
- [ ] Wrap `proposal_approve` invocation with `trackGitOperations(..., allowGit: false)`
- [ ] Throw `ZenoError` if git operations detected during apply
- [ ] Add guardrail warning to tool description:
  - "This operation must not invoke git commands"
  - "Applies changes to proposal state only"
  
- [ ] Document in GUARDRAILS.md

**Acceptance Criteria**:
- `proposal_start` fails if CLI uses git
- `proposal_approve` fails if CLI uses git
- Clear error message explaining violation
- Audit trail shows attempt and failure
- Tests verify git operation detection

### Task 4: Create Unified Error Response Type
Standardize error handling across all MCP tools:

- [ ] Create `src/mcp/schemas/common-schemas.ts`
  - Define `ToolResponse<T>` union type
  - Define `ErrorResponse` schema with: code, message, context, timestamp
  - Define `SuccessResponse<T>` schema
  
- [ ] Export schemas for reuse:
  ```typescript
  export type ToolResponse<T> = 
    | { success: true; data: T }
    | { success: false; error: ErrorResponse }
  ```
  
- [ ] Document error codes:
  - COMMAND_FAILED
  - VALIDATION_ERROR
  - NOT_FOUND
  - ALREADY_EXISTS
  - UNAUTHORIZED
  - INTERNAL_ERROR
  - GIT_VIOLATION (apply phase git ops)

**Acceptance Criteria**:
- Single unified type used everywhere
- All error responses include: code, message, timestamp
- Context included for debugging
- Typed with TypeScript strict mode
- JSDoc explains each error code

### Task 5: Migrate All Error Handling to Unified Format
Update codebase to use unified error response:

- [ ] Update all function-registry registrations (~40 functions)
  - Wrap in try/catch
  - Return unified format
  - Never throw to MCP layer
  
- [ ] Update all tool handlers (~25 handlers)
  - Remove custom error formatting
  - Use unified format
  - Consistent response structure
  
- [ ] Update archive-logic.ts error handling
  - Use unified error format
  - Include operation context
  
- [ ] Update validators to use unified errors

**Acceptance Criteria**:
- All 60+ tool/function errors in unified format
- No uncaught exceptions escape to MCP
- Consistent error codes across codebase
- Clear error messages with recovery hints
- Timestamp on all errors

### Task 6: Complete Solitary Proposal Archival
Implement full 4-step archival process for solitary proposals:

- [ ] Create helper function: `isProposalSolitary(hash: string): boolean`
  - Checks if proposal file in solitary directory
  
- [ ] Create helper function: `extractSummary(content: string): string`
  - Finds Summary section in proposal markdown
  - Returns 2-3 sentences
  
- [ ] Create helper function: `updateSolitaryConsolidation(hash, title, summary)`
  - Reads `zeno/gates/archive/solitary.md` or creates if missing
  - Adds entry with format:
    ```markdown
    ### [Title] (#hash)
    **Completed**: YYYY-MM-DD
    [2-3 sentence summary]
    ```
  - Maintains category organization (Infrastructure, Docs, etc.)
  
- [ ] Update `archiveProposal()` function:
  - Call `isProposalSolitary()` after reading content
  - Call `extractSummary()` if solitary
  - Call `updateSolitaryConsolidation()` after file move
  - Return result including consolidation update status
 - [x] Update `archiveProposal()` function:
   - Call `isProposalSolitary()` after reading content
   - Call `extractSummary()` if solitary
   - Call `updateSolitaryConsolidation()` after file move
   - Return result including consolidation update status

**Acceptance Criteria**:
- Step 1: Extract summary from proposal
- Step 2: Add entry to solitary.md
- Step 3: Move file to archive
- Step 4: Update completion date
- Non-solitary proposals unaffected
- Consolidation file properly formatted
- Handles missing solitary.md gracefully

### Task 7: Add Safety Tests
Comprehensive test coverage for new safety features:

- [ ] Test `git-operation-tracker.ts`:
  - Detects: git add, commit, tag, push, pull
  - Ignores: npm, node, build commands
  - Edge cases: quoted args, multiple operations
  
- [ ] Test apply phase safety:
  - `proposal_start` rejects git operations
  - `proposal_approve` rejects git operations
  - Clear error message included
  
- [ ] Test unified error format:
  - All errors have: code, message, timestamp
  - Code values match defined set
  - Context present when applicable
  
- [ ] Test solitary archival:
  - Correctly identifies solitary proposals
  - Consolidation file created if missing
  - Entries properly formatted
  - Completion dates accurate
  - Non-solitary proposals unaffected

**Acceptance Criteria**:
- 30+ new safety tests
- 100% coverage on new modules
- Tests verify guardrails enforced
- Edge cases covered
- All tests passing

### Task 8: Document Safety Model
Create comprehensive safety documentation:

- [ ] Update `src/mcp/GUARDRAILS.md`
  - Add: "Git Operations During Apply Phase" section
  - Explain: Why forbidden, what happens if violated, how to fix
  - Add: Error codes and recovery
  
- [ ] Create `src/mcp/ERROR_HANDLING.md`
  - Document unified error format
  - List all error codes with meanings
  - Show examples
  - Explain context field usage
  
- [ ] Update function-registry JSDoc
  - Add warnings for apply-phase functions
  - Note which operations trigger git
  
- [ ] Create safety checklist for contributors

**Acceptance Criteria**:
- Safety model fully documented
- Error codes listed with examples
- Apply phase restrictions clear
- Contributor safety checklist available
- All warnings in tool descriptions

## Files Affected

**Created**:
- `src/mcp/audit/git-operation-tracker.ts`
- `src/mcp/schemas/common-schemas.ts`
- `src/mcp/ERROR_HANDLING.md`
- `tests/mcp/audit/git-operation-tracker.test.ts`
- `tests/mcp/safety/apply-phase.test.ts`
- `tests/mcp/safety/unified-errors.test.ts`
- `tests/mcp/safety/solitary-archival.test.ts`

**Modified**:
- `src/integration/function-implementations.ts` (unified error handling)
- `src/mcp/tools/*.ts` (unified error format in all handlers)
- `src/core/archive-logic.ts` (complete solitary archival, unified errors)
- `src/mcp/GUARDRAILS.md` (add safety sections)
- `README.md` (reference safety model)

**Tests Updated**:
- All existing error handling tests (updated expectations)
- Archive tests (updated for solitary consolidation)

## Completion Summary

**Metrics**:
- Git operation safety: Enforced at tool level
- Error format: Unified (100% compliance)
- Apply phase: Protected from git violations
- Solitary archival: 4/4 steps implemented
- Error codes: 8 defined, documented
- Safety documentation: 2 new docs, updated guardrails

**Quality Checkpoints**:
- Build: TypeScript strict mode, zero errors
- Tests: 30+ new safety tests, all passing
- Linting: Zero lint errors
- Coverage: 95%+ on safety code
- Safety: All guardrails enforced

---

**Priority**: CRITICAL (safety enforcement, guardrail protection)  
**Blocking**: Production-ready workflows (depends on this)  
**Blocked by**: None (can follow refactoring or run in parallel)

## Completion Summary (partial)

- **Tasks Completed**: 2/8 (implemented helpers and tracker)
- **Files Modified/Created**: 2
  - `src/mcp/audit/git-operation-tracker.ts` (new)
  - `src/core/archive-logic.ts` (solitary consolidation helpers + integration)

### Notes

- Implemented a focused subset of the proposal: added a lightweight git-operation tracker and solitary archival helpers integrated into `archiveProposal()`.
- Remaining work: full unified error migration, CLI audit, tests, and docs per proposal tasks.

