# Proposal: File System and Hash Utilities

**Hash**: #p01fileutil03  
**Gate**: gate-01 - Core Infrastructure  
**Requirement**: #r01fileutils, #r01hash  
**Status**: completed  
**Created**: 2026-01-04  
**Implemented**: 2026-01-05  
**Archived**: 2026-01-05  
**Archived By**: system

---

## Summary

Implements file system operations with atomic writes and SHA-256 hash utilities for content-addressable storage. These utilities enable configuration management, database operations, and the hash-based reference system central to Zeno.

---

## Context

### Requirements Context

This proposal implements tasks derived from requirements #r01fileutils and #r01hash. Requirements are primarily defined during `zeno init` at project inception and attributed to gates during gate generation. Requirements may be updated or added during rebaseline/rescope operations, but init is the primary source. This proposal breaks down the referenced requirements into individual implementation tasks.

### Why This Change

Configuration files, database storage, and artifact management all require reliable file operations. Hash utilities enable the content-addressable reference system that reduces LLM context size by 50%+.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p01projconf01 | requires | TypeScript environment must be configured |
| #p01errlogs02 | requires | Error types and logging for error handling |
| #p01config04 | blocks | Configuration management uses file utilities |
| #p01sqlite05 | blocks | Database initialization uses file utilities |

---

## Tasks

### Task 1: File System Read Operations

**File(s)**: `src/utils/file.ts`  
**Action**: create

**Acceptance**:
- [x] readFile() returns string content or throws FileSystemError
- [x] readJsonFile() validates against provided Zod schema
- [x] fileExists() returns boolean without throwing
- [x] directoryExists() returns boolean without throwing
- [x] All functions handle missing files gracefully with clear errors

---

### Task 2: File System Write Operations

**File(s)**: `src/utils/file.ts`  
**Action**: modify

**Acceptance**:
- [x] writeFile() uses atomic write (temp file + rename)
- [x] writeJsonFile() serializes with consistent formatting (2-space indent)
- [x] ensureDir() creates parent directories recursively
- [x] Write operations preserve file permissions where possible
- [x] Errors include file path in context

---

### Task 3: File System Path Utilities

**File(s)**: `src/utils/file.ts`  
**Action**: modify

**Acceptance**:
- [x] getRelativePath() computes path relative to workspace root
- [x] resolvePath() handles both relative and absolute inputs
- [x] normalizePath() converts backslashes to forward slashes
- [x] Path functions work correctly on Windows and Unix

---

### Task 4: Hash Generation Utilities

**File(s)**: `src/utils/hash.ts`  
**Action**: create

**Acceptance**:
- [x] fullHash() returns 64-character hex string
- [x] shortHash() returns 16-character hex string
- [x] hashObject() produces identical hash for equivalent objects (sorted keys)
- [x] hashFile() hashes file contents without loading entire file into memory for large files
- [x] All functions use Node.js crypto module

---

### Task 5: Hash Validation Utilities

**File(s)**: `src/utils/hash.ts`  
**Action**: modify

**Acceptance**:
- [x] isValidHash() validates 16-character hex format
- [x] formatHashRef() returns #-prefixed hash
- [x] parseHashRef() extracts hash from "#abc123" format
- [x] Validation handles edge cases (empty, wrong length, non-hex)

---

### Task 6: File and Hash Utility Tests

**File(s)**: `tests/utils/file.test.ts`, `tests/utils/hash.test.ts`  
**Action**: create

**Acceptance**:
- [x] Tests verify atomic write behavior (temp file created, then renamed)
- [x] Tests verify error handling for missing files/directories
- [x] Tests verify hash determinism (same input = same output)
- [x] Tests verify cross-platform path handling
- [x] Coverage meets 90% threshold for both modules

---

## Completion Summary

**Tasks Completed**: 6/6  
**Files Created**: 4  
**Test Coverage**: 97.86%  
**Commits**: pending

### Artifacts Created
- `src/utils/file.ts` - File operations with atomic writes, JSON/Zod, path utilities
- `src/utils/hash.ts` - SHA-256 hashing and validation utilities
- `tests/utils/file.test.ts` - 30 unit tests
- `tests/utils/hash.test.ts` - 27 unit tests

### Quality Metrics
- Coverage: 97.86% (threshold: 90%)
- Security: 0 vulnerabilities
- Lint errors: 0 (threshold: <0.01%)
- Type errors: 0

---

## Automated Checks

- [x] Linting: PASSED (0 errors)
- [x] Type Check: PASSED (0 errors)
- [x] Tests: PASSED (110/110)
- [x] Coverage: 97.86% (threshold: 90%)
- [x] Security: 0 vulnerabilities
- [x] Build: PASSED

---

## Rollback

**If rejected or failed**: Delete src/utils/file.ts, src/utils/hash.ts, and corresponding test files.

