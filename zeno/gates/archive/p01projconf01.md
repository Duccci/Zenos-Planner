# Proposal: Project Configuration

**Hash**: #p01projconf01  
**Gate**: gate-01 - Core Infrastructure  
**Requirement**: #r01ts0001, #r01eslint, #r01vitest  
**Status**: completed  
**Created**: 2026-01-04  
**Implemented**: 2026-01-05  
**Archived**: 2026-01-05  
**Archived By**: system

---

## Summary

Establishes the TypeScript development environment with strict mode compilation, ESLint with TypeScript rules, Prettier formatting, and Vitest testing framework. This creates the foundation for all subsequent development work with enforced quality standards.

---

## Context

### Requirements Context

This proposal implements tasks derived from requirements #r01ts0001, #r01eslint, and #r01vitest. Requirements are primarily defined during `zeno init` at project inception and attributed to gates during gate generation. Requirements may be updated or added during rebaseline/rescope operations, but init is the primary source. This proposal breaks down the referenced requirements into individual implementation tasks.

### Why This Change

Gate 01 requires a properly configured TypeScript project before any utility modules can be developed. The development environment must enforce strict typing, consistent formatting, and automated testing from the outset.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p01errlogs02 | blocks | Error handling and logging require this environment |
| #p01fileutil03 | blocks | File utilities require this environment |
| #p01config04 | blocks | Configuration management requires this environment |
| #p01sqlite05 | blocks | Database layer requires this environment |
| #p01scaffold06 | blocks | CLI scaffolding requires this environment |

*No prior dependencies - first proposal in Gate 01.*

---

## Tasks

### Task 1: TypeScript Configuration

**File(s)**: `tsconfig.json`  
**Action**: modify

Update tsconfig.json to enable all strict mode flags and configure proper module resolution for ESM output. Set target to ES2024 for Node.js 24+ compatibility.

**Acceptance**:
- [x] `strict: true` enabled with all subordinate flags
- [x] `moduleResolution: "NodeNext"` for ESM compatibility
- [x] `target: "ES2024"` for Node.js 24+ features
- [x] `engines.node` in package.json updated to `>=24.0.0`
- [x] `outDir: "./dist"` configured
- [x] Build succeeds with `npm run build`

---

### Task 2: ESLint Configuration

**File(s)**: `eslint.config.mjs`  
**Action**: create

Create flat config ESLint setup with @typescript-eslint rules. Configure for strict type-aware linting. Ignore dist and node_modules directories.

**Acceptance**:
- [x] TypeScript-aware rules enabled
- [x] No conflicts with Prettier formatting
- [x] `npm run lint` executes without configuration errors
- [x] Rules enforce explicit return types on exported functions

---

### Task 3: Prettier Configuration

**File(s)**: `.prettierrc`  
**Action**: create

Create Prettier configuration with consistent formatting rules: single quotes, no semicolons (ESM style), 2-space indentation, 100 character line width.

**Acceptance**:
- [x] Configuration file created and valid
- [x] `npm run format` executes successfully
- [x] Formatting rules applied consistently across project

---

### Task 4: Vitest Configuration

**File(s)**: `vitest.config.ts`  
**Action**: create

Configure Vitest with coverage thresholds at 90% for statements, branches, functions, and lines. Enable TypeScript support and configure test file patterns.

**Acceptance**:
- [x] Coverage thresholds set to 90% for all metrics
- [x] Test pattern matches `**/*.test.ts` files
- [x] Coverage provider configured (v8)
- [x] `npm test` executes without configuration errors

---

### Task 5: Package.json Script Verification

**File(s)**: `package.json`  
**Action**: modify

Verify and update npm scripts for build, lint, format, test, and typecheck commands. Ensure all scripts work correctly with the new configurations.

**Acceptance**:
- [x] `npm run build` compiles TypeScript to dist/
- [x] `npm run lint` runs ESLint
- [x] `npm run format` runs Prettier
- [x] `npm test` runs Vitest
- [x] `npm run typecheck` verifies types without emitting

---

### Task 6: Initial Test Structure

**File(s)**: `tests/setup.ts`  
**Action**: create

Create test setup file for Vitest with any global configuration needed. Establish the tests/ directory structure mirroring src/.

**Acceptance**:
- [x] tests/ directory created
- [x] Setup file exports any global test utilities
- [x] Vitest recognizes setup file

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `tsconfig.json` | modify | Enable strict mode and ESM configuration |
| `eslint.config.mjs` | create | Flat config ESLint with TypeScript rules |
| `.prettierrc` | create | Formatting configuration |
| `vitest.config.ts` | create | Test framework configuration with coverage |
| `package.json` | modify | Verify and update npm scripts |
| `tests/setup.ts` | create | Test setup and utilities |
| `src/index.ts` | create | Minimal entry point for build verification |
| `tests/index.test.ts` | create | Initial test to verify test setup |

---

## Implementation Notes

- ESLint 9.x uses flat config format (eslint.config.mjs), not .eslintrc
- Vitest natively supports TypeScript without additional configuration
- Coverage thresholds will cause test failures if not met (intentional for quality enforcement)
- Use `@vitest/coverage-v8` for coverage (added to devDependencies)
- Added `@eslint/js` to devDependencies for flat config support
- Fixed `clean` script for cross-platform compatibility (Windows/Unix)
- Note: `better-sqlite3` requires native compilation; use `npm install --ignore-scripts` if build tools unavailable

---

## Completion Summary

**Tasks Completed**: 6/6  
**Files Modified**: 8  
**Test Coverage**: 100%  
**Commits**: pending

### Artifacts Created
- `tsconfig.json` - Updated with ES2024 target, NodeNext module resolution
- `eslint.config.mjs` - ESLint 9.x flat config with TypeScript rules
- `.prettierrc` - Prettier formatting configuration
- `vitest.config.ts` - Vitest with 90% coverage thresholds
- `package.json` - Updated scripts and dependencies
- `tests/setup.ts` - Test setup with global utilities
- `src/index.ts` - Minimal entry point for verification
- `tests/index.test.ts` - Initial test validating setup

### Quality Metrics
- Coverage: 100% (threshold: 90%)
- Security: 0 vulnerabilities
- Lint errors: 0 (threshold: <0.01%)
- Type errors: 0

---

## Automated Checks

- [x] Linting: PASSED (0 errors)
- [x] Type Check: PASSED (0 errors)
- [x] Tests: PASSED (1/1)
- [x] Coverage: 100% (threshold: 90%)
- [x] Security: 0 vulnerabilities
- [x] Build: PASSED

---

## Rollback

**If rejected or failed**: Delete created config files, revert tsconfig.json and package.json to previous state. No runtime code affected.

