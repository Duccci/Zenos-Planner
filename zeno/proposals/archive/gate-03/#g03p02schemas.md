# Proposal: MCP Schema Definitions

**Hash**: #g03p02schemas  
**Gate**: gate-03 - MCP Server & LLM Tool Integration  
**Status**: completed  
**Created**: 2026-01-31  
**Implemented**: 2026-01-31  
**Archived**: 2026-01-31  
**Archived By**: system

---

## Summary

Defines complete Zod schema definitions for all MCP tool inputs and outputs. Covers gates, requirements, proposals, repositories, and analysis operations with proper validation, type safety, and error messaging. Schemas enable both runtime validation and TypeScript type inference for MCP tools.

---

## Context

### Requirements Context

This proposal creates the schema layer that MCP tools will use for input validation and output serialization. Without these schemas, MCP tools cannot perform type-safe invocations or provide reliable error messages to LLMs.

### Why This Change

Zod schemas provide runtime validation (catching errors at execution time), TypeScript integration (IDE autocomplete and type checking), and excellent error messages that LLMs can parse. Separate schema files keep MCP server code clean and maintainable.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #g03p01registry | requires | Function registry must exist before schemas can reference registered functions |

---

## Tasks

### Task 1: Create Common Schema Definitions

**File(s)**: `src/mcp/schemas/common-schemas.ts`  
**Action**: create

Define Zod schemas for common types used across all MCP tools:
- Gate ID, Status, Type enums
- Requirement ID, Priority, Type enums  
- Proposal ID, Status enums
- Repository ID, Type enums
- Error response schema with error code, message, context
- Pagination schema for list operations
- Timestamp schema with ISO string validation

**Acceptance**:
- [x] All enums match database constraints (e.g., gate status: pending|in_progress|completed|rejected)
- [x] Error schema includes error code, message, context fields
- [x] Type-safe exports for TypeScript consumers
- [x] Schema messages provide helpful validation errors

---

### Task 2: Create Gate Operation Schemas

**File(s)**: `src/mcp/schemas/gate-schemas.ts`  
**Action**: create

Define Zod schemas for all gate operations:
- `gates_list`: input (optional status filter), output (Gate array)
- `gates_show`: input (gateId), output (GateDetails with requirements, proposals, dependencies)
- `gates_start`: input (gateId), output (void or status confirmation)
- `gates_complete`: input (gateId, completionNotes?), output (completion summary)
- `gates_regenerate`: input (optional fromGateId), output (regeneration suggestions)

**Acceptance**:
- [x] Input schemas validate gate IDs, statuses, required fields
- [x] Output schemas match CLI display formats
- [x] Error cases documented (gate not found, invalid status transition)
- [x] All gate-related enums use database values

---

### Task 3: Create Requirement Operation Schemas

**File(s)**: `src/mcp/schemas/requirement-schemas.ts`  
**Action**: create

Define Zod schemas for requirement operations:
- `req_list`: input (optional gateId, optional type), output (Requirement array with metadata)
- `req_show`: input (hash or id), output (RequirementDetails with parent, children, status)
- `req_deps`: input (hash), output (DependencyGraph with requirements and gates)
- `req_transfer`: input (hash, targetGateId), output (transfer confirmation)
- `req_transfer`: input (hash, targetGateId), output (transfer confirmation)

**Acceptance**:
- [x] Hash-based lookups supported (with fallback to ID)
- [x] Status enum matches database (pending, in_progress, tested, archived)
- [x] Dependency graph includes requirement and gate references
- [x] Parent/child relationships properly represented

---

### Task 4: Create Proposal Operation Schemas

**File(s)**: `src/mcp/schemas/proposal-schemas.ts`  
**Action**: create

Define Zod schemas for proposal operations:
- `proposal_list`: input (optional gateId, optional status), output (Proposal array)
- `proposal_show`: input (hash or id), output (ProposalDetails with tasks, dependencies, files)
- `proposal_validate`: input (hash), output (validation result with pass/fail and issues)
- `proposal_approve`: input (hash, approverNotes?), output (approval confirmation)
- `proposal_reject`: input (hash, rejectionReason), output (rejection confirmation)
- `proposal_start`: input (hash), output (status change confirmation)

**Acceptance**:
- [x] Hash-based lookups with ID fallback
- [x] Proposal status values: pending, in_progress, completed, rejected, archived
- [x] Validation output includes specific issues and suggestions
- [x] All markdown task structures properly typed

---

### Task 5: Create Repository and Analysis Schemas

**File(s)**: `src/mcp/schemas/repository-schemas.ts`, `src/mcp/schemas/analysis-schemas.ts`  
**Action**: create

Define schemas for repository and analysis operations:
- Repository: `repos_list`, `repos_deps`, `repos_detect`, `repos_adjust`
- Analysis: `analyze`, `show_entity`, `metrics`

**Acceptance**:
- [x] Repository type enums match database (main, service, library, tool)
- [x] Analysis output includes code metrics, dependencies, changes
- [x] Entity resolution (gates, requirements, proposals) properly typed
- [x] Metrics schema includes LOC, complexity, coupling values

---

### Task 6: Create Template and Config Schemas

**File(s)**: `src/mcp/schemas/common-schemas.ts`  
**Action**: modify

Add schemas for template operations (from solitary proposals) and config access:
- `template_list`: input (optional category), output (Template array)
- `template_get`: input (name or category/name), output (TemplateContent)
- `template_context`: input (templateName, gateId?), output (prepared LLM context)
- `config_get`: input (configPath?), output (configuration object)

**Acceptance**:
- [x] Template categories match available templates
- [x] Template output includes metadata, content, usage examples
- [x] Config values properly typed (strings, numbers, arrays, objects)

---

### Task 7: Write Schema Validation Tests

**File(s)**: `tests/mcp/schemas.test.ts`  
**Action**: create

Test all schemas with valid and invalid inputs, ensuring proper error messages.

**Acceptance**:
- [x] Each schema tested with valid input (parsing succeeds)
- [x] Each schema tested with invalid input (parsing fails with helpful message)
- [x] Enum validation tests (e.g., status must be one of the allowed values)
- [x] Optional fields properly marked
- [x] Coverage ≥90% for all schema files

---

## Completion Summary

**Tasks Completed**: 7/7  
**Files Modified**: 6 created, 1 test suite  
**Test Coverage**: 53/53 tests passing (100%)  
**Commits**: Implementation and validation

### Artifacts Created
- `src/mcp/schemas/common-schemas.ts` - 250+ lines, common Zod schemas (enums, identifiers, errors, pagination, templates, config)
- `src/mcp/schemas/gate-schemas.ts` - 200+ lines, gate operation schemas (5 operations)
- `src/mcp/schemas/requirement-schemas.ts` - 220+ lines, requirement operation schemas (5 operations)
- `src/mcp/schemas/proposal-schemas.ts` - 240+ lines, proposal operation schemas (6 operations)
- `src/mcp/schemas/repository-schemas.ts` - 120+ lines, repository operation schemas (4 operations)
- `src/mcp/schemas/analysis-schemas.ts` - 140+ lines, analysis operation schemas (3 operations)
- `tests/mcp/schemas.test.ts` - 740+ lines, comprehensive schema validation test suite

### Quality Metrics
- Tests: 53/53 passing (100%)
- TypeScript: 0 strict mode errors
- Coverage: All schema files covered (90%+ threshold met)
- Lint errors: 0
- Vulnerabilities: 0

### Key Achievements
- Complete Zod schema layer for all MCP tools (30+ operation schemas)
- Full type inference from schemas to TypeScript
- LLM-friendly error messages with code/message/context
- Enum validation for all status types and resource types
- Pagination support for list operations (skip/take with metadata)
- Hash-based identifier patterns for gates, requirements, proposals
- Template and config schema support for solitary proposal integration
- Comprehensive test coverage including valid/invalid inputs and edge cases

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/mcp/schemas/common-schemas.ts` | create | Common Zod schemas and enums used across all tools |
| `src/mcp/schemas/gate-schemas.ts` | create | Gate operation input/output schemas |
| `src/mcp/schemas/requirement-schemas.ts` | create | Requirement operation schemas |
| `src/mcp/schemas/proposal-schemas.ts` | create | Proposal operation schemas |
| `src/mcp/schemas/repository-schemas.ts` | create | Repository operation schemas |
| `src/mcp/schemas/analysis-schemas.ts` | create | Analysis operation schemas |
| `tests/mcp/schemas.test.ts` | create | Comprehensive schema validation tests |

---

**Note**: Schemas should be created and validated before implementing tool handlers. This ensures type safety throughout the MCP layer.
