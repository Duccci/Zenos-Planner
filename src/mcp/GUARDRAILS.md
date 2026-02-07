# Zeno Workflow Guardrails

This document describes the validation guardrails that enforce constraints during proposal and gate operations. Guardrails prevent errors, enforce best practices, and maintain project quality.

## Overview

Guardrails are implemented as modular validators that run at specific workflow stages:

- **Dependency Validator**: Ensures dependencies form a valid DAG, prevents circular dependencies
- **Scope Validator**: Ensures file modifications stay within declared scope
- **Quality Validator**: Enforces quality thresholds (coverage, type errors, lint errors, security)
- **Apply Phase Validator**: Prevents git operations during proposal apply, enforces scope and quality

## Validator Architecture

All validators follow a common pattern:

```typescript
interface ValidationResult {
  allowed: boolean          // Whether operation should proceed
  errors?: string[]         // Blocking errors
  warnings?: string[]       // Non-blocking warnings
}
```

### Common Principles

1. **Errors are blocking**: Operation fails if `allowed === false`
2. **Warnings are informational**: Operation proceeds but user is notified
3. **Strict mode**: Warnings become errors when `strict: true`
4. **Context-driven**: Validators receive all needed data via context objects

## Dependency Validator

**File**: `src/mcp/validators/dependency-validator.ts`

### Purpose

Validates proposal/gate dependencies to ensure:
- No circular dependencies (DAG enforcement)
- Dependencies belong to same or earlier gates
- All referenced dependencies exist

### Input

```typescript
interface DependencyValidationContext {
  node: DependencyNode           // Current proposal/gate
  allNodes: Map<string, DependencyNode>  // All proposals/gates
}

interface DependencyNode {
  hash: string
  dependencies: string[]
  gateId?: string
  gateSequence?: number
}
```

### Rules

1. **Circular Dependency Detection**: Uses DFS to detect cycles
   - Error: `Circular dependency detected: A → B → C → A`

2. **Gate Ordering**: Dependencies must be in same or earlier gates
   - Error: `Dependency X (gate-04) is in a later gate than Y (gate-03)`

3. **Missing Dependencies**: Warn if dependency not found
   - Warning: `Dependency #abc123 not found in system`

### Example

```typescript
import { validateDependencies } from './validators/dependency-validator.js'

const result = validateDependencies({
  node: {
    hash: '#new-prop',
    dependencies: ['#dep1', '#dep2'],
    gateId: 'gate-03',
    gateSequence: 3
  },
  allNodes: existingNodesMap
})

if (!result.allowed) {
  console.error('Validation failed:', result.errors)
}
```

## Scope Validator

**File**: `src/mcp/validators/scope-validator.ts`

### Purpose

Validates that file modifications match the "Files Affected" list declared in proposals. Prevents unrelated refactoring and scope creep.

### Input

```typescript
interface ScopeValidationContext {
  filesAffected: string[]    // Files declared in proposal
  filesModified: string[]    // Files actually modified
  allowTestFiles?: boolean   // Allow test files (default: true)
}
```

### Rules

1. **Scope Enforcement**: Modified files must be in filesAffected
   - Error: `File modified outside of declared scope: src/utils/extra.ts`

2. **Test Files**: Test files allowed by default if `allowTestFiles: true`
   - Warning: `Test file modified but not listed in Files Affected`

3. **Unused Declarations**: Warn if declared files weren't modified
   - Warning: `File declared in "Files Affected" but not modified: src/foo.ts`

### Example

```typescript
import { validateScope } from './validators/scope-validator.js'

const result = validateScope({
  filesAffected: ['src/auth/middleware.ts', 'src/auth/types.ts'],
  filesModified: ['src/auth/middleware.ts', 'src/auth/middleware.test.ts'],
  allowTestFiles: true
})

if (!result.allowed) {
  console.error('Scope violation:', result.errors)
}
```

## Quality Validator

**File**: `src/mcp/validators/quality-validator.ts`

### Purpose

Validates quality metrics against configured thresholds from `config.json`:

```json
{
  "qualityThresholds": {
    "codeCoverage": 90,
    "typeCheckingErrors": 0,
    "lintingErrorRate": 0.01,
    "securityVulnerabilities": 0
  }
}
```

### Input

```typescript
interface QualityValidationContext {
  metrics: QualityMetrics
  config: ZenoConfig
  strict?: boolean  // Treat warnings as errors
}

interface QualityMetrics {
  coverage?: number          // Code coverage percentage (0-100)
  typeErrors?: number        // Number of type checking errors
  lintErrors?: number        // Number of linting errors
  securityIssues?: number    // Number of security vulnerabilities
  totalLines?: number        // Total lines of code
}
```

### Rules

1. **Code Coverage**: Must meet threshold
   - Error (strict): `Code coverage 85% is below threshold 90%`
   - Warning: Same message if not strict

2. **Type Errors**: Must be zero (or below threshold)
   - Error: `Type checking errors (5) exceed threshold 0`

3. **Lint Errors**: Rate-based threshold
   - Error (strict): `Lint error rate (1.5%) exceeds threshold (1.0%)`
   - Warning: Same message if not strict

4. **Security Vulnerabilities**: Must be zero
   - Error: `Security vulnerabilities (2) exceed threshold 0`

### Example

```typescript
import { validateQuality } from './validators/quality-validator.js'
import { loadConfig } from '../utils/config.js'

const config = await loadConfig()

const result = validateQuality({
  metrics: {
    coverage: 92,
    typeErrors: 0,
    lintErrors: 5,
    totalLines: 1000,
    securityIssues: 0
  },
  config,
  strict: true
})

if (!result.allowed) {
  console.error('Quality check failed:', result.errors)
}
```

## Apply Phase Validator

**File**: `src/mcp/validators/apply-phase-validator.ts`

### Purpose

Enforces constraints during proposal apply phase:
- No git operations (commits happen only at gate completion)
- Changes scoped to Files Affected
- Quality thresholds met before approval

### Input

```typescript
interface ApplyPhaseValidationContext {
  proposalHash: string
  filesAffected: string[]
  filesModified: string[]
  gitOperations: string[]   // Detected git commands
  qualityMetrics?: QualityMetrics
  config: ZenoConfig
}
```

### Rules

1. **No Git Operations**: Git commits occur only at gate completion
   - Error: `Git operations detected during apply phase: git commit, git push`

2. **Scope Enforcement**: Same as Scope Validator
   - Error: `Files modified outside of declared scope: X, Y, Z`

3. **Quality Thresholds**: Warnings for quality issues
   - Warning: `Code coverage 85% is below threshold 90%`
   - Error: `Security vulnerabilities (2) exceed threshold 0`

### Example

```typescript
import { validateApplyPhase } from './validators/apply-phase-validator.js'
import { loadConfig } from '../utils/config.js'

const config = await loadConfig()

const result = validateApplyPhase({
  proposalHash: '#abc123',
  filesAffected: ['src/auth/middleware.ts'],
  filesModified: ['src/auth/middleware.ts'],
  gitOperations: ['git commit -m "test"'],
  qualityMetrics: {
    coverage: 95,
    typeErrors: 0,
    lintErrors: 0,
    securityIssues: 0
  },
  config
})

if (!result.allowed) {
  console.error('Apply phase validation failed:', result.errors)
}
```

## Integration Points

### Proposal Creation (`proposal_create`)

Validates dependencies during proposal creation:

```typescript
// src/integration/proposals-registry.ts
const depValidation = validateDependencies({ node: currentNode, allNodes })
if (depValidation.errors) {
  errors.push(...depValidation.errors)
}
```

### Proposal Validation (`proposal_validate`)

Runs dependency and quality validators:

```typescript
// Dependency validation
const depValidation = validateDependencies({ node, allNodes })

// Quality validation
const qualityValidation = validateQuality({ metrics, config, strict })
```

### Proposal Approval (`proposal_approve`)

Runs apply-phase and quality validators in strict mode:

```typescript
// Apply phase validation
const applyValidation = validateApplyPhase({
  proposalHash,
  filesAffected,
  filesModified,
  gitOperations: [],
  qualityMetrics,
  config
})

// Quality validation (strict mode)
const qualityValidation = validateQuality({
  metrics: qualityMetrics,
  config,
  strict: true
})
```

## Configuration

Validators use `config.json` for thresholds:

```json
{
  "qualityThresholds": {
    "codeCoverage": 90,
    "typeCheckingErrors": 0,
    "lintingErrorRate": 0.01,
    "securityVulnerabilities": 0
  }
}
```

### Graceful Defaults

When `config.json` is missing, validators use sensible defaults:

```typescript
const defaultThresholds = {
  codeCoverage: 90,
  typeCheckingErrors: 0,
  lintingErrorRate: 0.01,
  securityVulnerabilities: 0
}
```

## Best Practices

1. **Run validators early**: Catch issues during creation, not approval
2. **Use strict mode for gates**: Gate completion requires strict validation
3. **Allow test files**: Set `allowTestFiles: true` for scope validation
4. **Provide context**: Include all relevant data in validation context
5. **Handle warnings**: Log warnings even if validation passes

## Testing

Integration tests cover:
- Circular dependency detection
- Gate ordering enforcement
- Scope violations
- Quality threshold enforcement
- Strict vs non-strict mode

See `tests/integration/validators.test.ts` for test suite.

## Constraint Violations & Recovery

### Common Violations

#### 1. Git Operations During Apply Phase
**Violation**: Attempting to run `git commit` during proposal implementation
**Error**: `Git operations detected during apply phase: git commit -m "test"`
**Recovery**:
- Remove git operations from proposal implementation
- Git commits occur ONLY at gate completion
- Use `manage_todo_list()` for task tracking instead

#### 2. Scope Expansion
**Violation**: Modifying files not listed in "Files Affected"
**Error**: `Files modified outside of declared scope: src/utils/helpers.ts`
**Recovery**:
- Add undeclared files to proposal's "Files Affected" list
- Or create separate proposal for additional changes
- Document scope expansion and get human approval

#### 3. Quality Thresholds Not Met
**Violation**: Code coverage below 90%
**Error**: `Code coverage 85% is below threshold 90%`
**Recovery**:
- Add missing test cases
- Improve test coverage
- Update proposal with revised quality metrics

#### 4. Circular Dependencies
**Violation**: Proposal depends on itself through a chain
**Error**: `Circular dependency detected: #prop1 → #prop2 → #prop1`
**Recovery**:
- Remove circular dependency from proposal
- Reorder implementation sequence
- Split interdependent work into separate gates

#### 5. Security Vulnerabilities
**Violation**: New security issues introduced
**Error**: `Security vulnerabilities (2) exceed threshold 0`
**Recovery**:
- Fix security vulnerabilities
- Update dependencies to secure versions
- Implement security patches

### Recovery Procedures

#### For Proposal Authors
1. **Check validation results** in tool output
2. **Fix blocking errors** before proceeding
3. **Address warnings** to improve quality
4. **Update proposal** with corrected scope/files
5. **Re-run validation** after fixes

#### For Gate Managers
1. **Review validation failures** during gate operations
2. **Escalate blocking issues** to proposal authors
3. **Verify quality metrics** before gate completion
4. **Document exceptions** for approved deviations

#### Emergency Recovery
- **Override validation**: Not supported (guardrails are mandatory)
- **Skip validation**: Not allowed (breaks audit trail)
- **Manual intervention**: Human approval required for exceptions

### Prevention Best Practices

1. **Validate early**: Run `proposal_validate` before `proposal_start`
2. **Check scope**: Review "Files Affected" against actual changes
3. **Monitor quality**: Track metrics during development
4. **Test dependencies**: Verify no circular references
5. **Security first**: Address vulnerabilities immediately

### Tool Integration

Guardrails are automatically enforced in:

- `proposal_action` (start/approve actions)
- `gates_action` (create/complete actions)
- `proposal_validate` (comprehensive validation)
- `gate_create` (dependency validation)

All validation results are returned in tool output with clear error messages and recovery guidance.
