# Proposal: Error Handling and Logging System

**Hash**: #p01errlogs02  
**Gate**: gate-01 - Core Infrastructure  
**Requirement**: #r01errors, #r01logging  
**Status**: completed  
**Created**: 2026-01-04  
**Implemented**: 2026-01-05  
**Archived**: 2026-01-05  
**Archived By**: system

---

## Summary

Implements the foundational error handling system with typed error hierarchy and a logging system with configurable levels. These utilities are required by all other modules and must be implemented early to support debugging during development.

---

## Context

### Requirements Context

This proposal implements tasks derived from requirements #r01errors and #r01logging. Requirements are primarily defined during `zeno init` at project inception and attributed to gates during gate generation. Requirements may be updated or added during rebaseline/rescope operations, but init is the primary source. This proposal breaks down the referenced requirements into individual implementation tasks.

### Why This Change

All subsequent modules require consistent error handling and logging. Establishing these patterns early ensures uniform error reporting and debug capabilities across the codebase.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p01projconf01 | requires | TypeScript environment must be configured |
| #p01fileutil03 | blocks | File utilities will use these error types |
| #p01sqlite05 | blocks | Database operations will use these error types |

---

## Tasks

### Task 1: Error Base Class and Hierarchy

**File(s)**: `src/utils/errors.ts`  
**Action**: create

Implement ZenoError base class extending Error with additional properties: code (string identifier), context (object), and cause (optional Error). Create specialized error classes: FileSystemError, DatabaseError, ConfigError, GitError, ValidationError, HashError.

**Acceptance**:
- [x] ZenoError extends Error with code, context, cause properties
- [x] Each specialized error class has appropriate default code prefix
- [x] Error messages are human-readable and include context
- [x] Stack traces preserved correctly
- [x] Errors are serializable for logging

---

### Task 2: Error Utility Functions

**File(s)**: `src/utils/errors.ts`  
**Action**: modify

Add utility functions: isZenoError() type guard, formatError() for user display, wrapError() for converting unknown errors to ZenoError.

**Acceptance**:
- [x] isZenoError() correctly identifies ZenoError instances
- [x] formatError() produces clean CLI-friendly output
- [x] wrapError() handles Error, string, and unknown types
- [x] All utilities are exported

---

### Task 3: Logger Implementation

**File(s)**: `src/utils/logger.ts`  
**Action**: create

Implement singleton logger with levels: debug, info, warn, error. Use chalk for colored output. Support log level filtering via environment variable (ZENO_LOG_LEVEL). Include timestamps in debug mode.

**Acceptance**:
- [x] logger.debug(), logger.info(), logger.warn(), logger.error() methods
- [x] Colors applied: gray (debug), blue (info), yellow (warn), red (error)
- [x] ZENO_LOG_LEVEL environment variable controls minimum level
- [x] Default level is 'info' if not set
- [x] Timestamps shown in debug output

---

### Task 4: Logger Formatting Utilities

**File(s)**: `src/utils/logger.ts`  
**Action**: modify

Add formatting helpers: logSection() for visual section headers, logTable() for tabular data, logHash() for styled hash references.

**Acceptance**:
- [x] logSection() creates visually distinct headers
- [x] logTable() aligns columnar data
- [x] logHash() applies consistent styling to hash references
- [x] All formatters respect current log level

---

### Task 5: Error and Logger Tests

**File(s)**: `tests/utils/errors.test.ts`, `tests/utils/logger.test.ts`  
**Action**: create

Write unit tests for error hierarchy and logger functionality. Test error inheritance, serialization, and all logger methods with level filtering.

**Acceptance**:
- [x] Tests cover all error types and inheritance
- [x] Tests verify error serialization
- [x] Tests verify log level filtering
- [x] Tests verify color output (can mock chalk)
- [x] Coverage meets 90% threshold for both modules

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/utils/errors.ts` | create | Error base class and specialized errors |
| `src/utils/logger.ts` | create | Logging system with levels and formatting |
| `tests/utils/errors.test.ts` | create | Error handling tests |
| `tests/utils/logger.test.ts` | create | Logger tests |

---

## Completion Summary

**Tasks Completed**: 5/5  
**Files Created**: 4  
**Test Coverage**: 95.94%  
**Commits**: pending

### Artifacts Created
- `src/utils/errors.ts` - ZenoError base class with 6 specialized error types
- `src/utils/logger.ts` - Leveled logger with chalk colors and formatting utilities
- `tests/utils/errors.test.ts` - 32 unit tests for error handling
- `tests/utils/logger.test.ts` - 20 unit tests for logger

### Quality Metrics
- Coverage: 95.94% (threshold: 90%)
- Security: 0 vulnerabilities
- Lint errors: 0 (threshold: <0.01%)
- Type errors: 0

---

## Implementation Notes

- Logger uses process.env.ZENO_LOG_LEVEL for configuration (no file-based config yet)
- Error codes follow pattern: CATEGORY_SPECIFIC (e.g., FS_READ_FAILED, DB_QUERY_FAILED)
- Console methods used directly for output (simple approach for MVP)
- Chalk 5.x is ESM-only; imports work correctly with NodeNext module resolution

---

## Automated Checks

- [x] Linting: PASSED (0 errors)
- [x] Type Check: PASSED (0 errors)
- [x] Tests: PASSED (53/53)
- [x] Coverage: 95.94% (threshold: 90%)
- [x] Security: 0 vulnerabilities
- [x] Build: PASSED

---

## Rollback

**If rejected or failed**: Delete src/utils/errors.ts, src/utils/logger.ts, and corresponding test files. No other modules depend on these yet.

