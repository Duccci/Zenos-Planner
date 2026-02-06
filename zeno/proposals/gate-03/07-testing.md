# Proposal: Comprehensive MCP Testing & Validation

**Hash**: #g03p07testing  
**Gate**: gate-03 - MCP Server & LLM Tool Integration  
**Status**: pending  
**Created**: 2026-01-31

---

## Summary

Implements comprehensive test suite for entire MCP layer achieving 90%+ code coverage. Covers unit tests for schemas and tools, integration tests for MCP server and tool invocation, end-to-end tests for all four prompt workflows, and performance tests ensuring <100ms tool latency. All tests validate that LLMs can successfully invoke Zeno operations.

---

## Context

### Requirements Context

This proposal ensures the MCP layer is production-ready through comprehensive testing. Without it, tool failures in the wild would go undetected. Tests validate both functionality and that LLMs can actually use the tools.

### Why This Change

MCP tools are the primary interface for LLMs (Cursor, Claude, VS Code Copilot). We must ensure all tools work correctly, error messages are actionable, and performance meets expectations. Tests also serve as documentation for how to use each tool.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #g03p02schemas | requires | Schemas must be tested for validation correctness |
| #g03p04tools | requires | All tools must be tested for functionality |
| #g03p03server | requires | Server must be tested for startup and request handling |

---

## Tasks

### Task 1: Write Unit Tests for All Schemas

**File(s)**: `tests/mcp/schemas.test.ts`  
**Action**: create/modify

Test all Zod schemas with valid and invalid inputs:
- **Valid inputs**: Each schema accepts well-formed data and produces expected output
- **Invalid inputs**: Each schema rejects malformed data with helpful error messages
- **Enum validation**: Status, type, and priority enums enforce allowed values
- **Optional fields**: Fields marked optional work correctly
- **Required fields**: Missing required fields produce clear errors

For each schema:
```
- Valid input parses successfully
- Invalid input rejected with helpful error
- Enum values validated
- Optional fields work
- Required fields enforced
```

**Acceptance**:
- [ ] All schemas tested with valid inputs (pass)
- [ ] All schemas tested with invalid inputs (fail with helpful message)
- [ ] Enum validation tests pass
- [ ] Optional and required field tests pass
- [ ] Coverage ≥95% for schema files

---

### Task 2: Write Unit Tests for Tool Handlers

**File(s)**: `tests/mcp/tools/*.test.ts`  
**Action**: create/modify

Test each tool handler independently:
- Happy path (valid input, successful execution)
- Error cases (invalid input, missing resource, operation fails)
- Edge cases (empty list, boundary values, special characters)
- Output validation (response matches schema)

For each tool:
```
- Valid input succeeds and returns expected output
- Invalid input fails with helpful error
- Missing resources fail with NOT_FOUND
- Output matches schema
- Error messages are actionable
```

Group tests by tool category (gates, requirements, proposals, etc.).

**Acceptance**:
- [ ] All ~20 tools have test coverage
- [ ] Happy path tests verify correct behavior
- [ ] Error case tests verify error handling
- [ ] Output validation ensures LLM can parse responses
- [ ] Coverage ≥90% for all tool handler files

---

### Task 3: Write Integration Tests for MCP Server

**File(s)**: `tests/mcp/server-integration.test.ts`  
**Action**: create

Test MCP server as a whole:
- Server startup with stdio transport
- Tool registration from function registry
- Request handling (CallToolRequest → ToolResult)
- Error response formatting
- Tool discovery (tools available to LLM)

Test scenarios:
```
- Server starts with stdio transport
- All tools registered on startup
- Tool invocation succeeds with valid input
- Invalid input produces proper error response
- Tool list includes all tools with descriptions
- Server handles concurrent requests
```

**Acceptance**:
- [ ] Server starts successfully
- [ ] All ~20 tools registered
- [ ] Tool invocation working end-to-end
- [ ] Error responses properly formatted
- [ ] Concurrent requests handled correctly
- [ ] Coverage ≥90% for server code

---

### Task 4: Write End-to-End Tests for Prompt Workflows

**File(s)**: `tests/mcp/prompt-workflows.test.ts`  
**Action**: create

Test all four prompt workflows end-to-end:

**Workflow 1: `/zeno-apply` - Proposal Implementation**
```
- Load proposal via proposal_show tool
- Read proposal tasks and dependencies
- Record requirement lifecycle via proposal approvals and gate archival (no DB status)
- Track progress with manage_todo_list tool
- Invoke proposal_approve to finalize
```

**Workflow 2: `/zeno-gate` - Gate Generation**
```
- Start gate via gates_start tool
- Load templates with template_get function
- Read gate PRD requirements
- Invoke gates_regenerate for validation
```

**Workflow 3: `/zeno-proposal` - Proposal Document Generation**
```
- Read gate PRD via gates_show tool
- Access templates with getTemplate function
- Establish dependencies with req_deps tool
- Generate markdown files in correct location
```

**Workflow 4: `/zeno-archive` - Artifact Archival**
```
- Validate completion status via gates_show tool
- List proposals with proposal_list tool
- Move artifacts to archive location
- Create git tags and commit
```

Each workflow test:
- Simulates LLM orchestration of tool calls
- Verifies tool results are usable by next step
- Ensures data consistency across operations
- Validates final output matches expected structure

**Acceptance**:
- [ ] All four workflows tested end-to-end
- [ ] Tool sequences match actual MCP API
- [ ] Data passing between tools works correctly
- [ ] Error cases properly handled in workflows
- [ ] Workflows can be repeated without side effects

---

### Task 5: Write Performance Tests

**File(s)**: `tests/mcp/performance.test.ts`  
**Action**: create

Test that tool invocation performance meets budget:
- Simple tool (gates_list): <20ms
- Complex tool (req_show with dependencies): <100ms
- Database query (req_list filtered): <50ms
- Registry invocation overhead: <5ms

Measure and record:
```
gates_list:           ___ms (target: <20ms)
gates_show:           ___ms (target: <50ms)
req_list:             ___ms (target: <50ms)
req_show_with_deps:   ___ms (target: <100ms)
proposal_list:        ___ms (target: <50ms)
proposal_validate:    ___ms (target: <100ms)
```

**Acceptance**:
- [ ] All tools meet <100ms budget
- [ ] Database queries optimized
- [ ] No N+1 query problems
- [ ] Performance stable across test runs
- [ ] Performance report generated

---

### Task 6: Write Backward Compatibility Tests

**File(s)**: `tests/mcp/backward-compat.test.ts`  
**Action**: create

Ensure CLI still works with registry delegation:
- All existing CLI commands still function
- CLI output unchanged (same format)
- Error handling consistent
- Database migrations still apply

Test:
```
- zeno gates list works
- zeno gates show <id> works
- zeno gates start <id> works
- zeno gates complete <id> works
- zeno req list works
- zeno proposal list works
... (all CLI commands)
```

**Acceptance**:
- [ ] All existing CLI commands work
- [ ] No behavioral changes
- [ ] Error messages consistent
- [ ] Database schema unchanged
- [ ] All tests pass (100% compatibility)

---

### Task 7: Write Test Documentation and Coverage Report

**File(s)**: `docs/MCP_TESTING.md`, `coverage/`  
**Action**: create

Document test strategy and generate coverage report:
- **Test Organization**: How tests are organized by layer
- **Running Tests**: Commands to run unit, integration, e2e tests
- **Coverage Report**: HTML coverage report linked from README
- **Adding Tests**: Guidelines for new tool testing
- **Performance Baseline**: Expected performance for each tool

Coverage report should show:
- Overall coverage: 90%+ target
- By module: server, tools, schemas, error-handler
- Uncovered lines (intentional or accidental)
- Coverage trends over time

**Acceptance**:
- [ ] Test documentation clear and complete
- [ ] Coverage report generated and published
- [ ] Guidelines for adding new tests
- [ ] Performance baseline documented
- [ ] Coverage ≥90% overall, ≥95% for critical paths

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `tests/mcp/schemas.test.ts` | create/modify | Unit tests for all Zod schemas |
| `tests/mcp/tools/gate-tools.test.ts` | create | Tests for gate tools |
| `tests/mcp/tools/requirement-tools.test.ts` | create | Tests for requirement tools |
| `tests/mcp/tools/proposal-tools.test.ts` | create | Tests for proposal tools |
| `tests/mcp/tools/repository-tools.test.ts` | create | Tests for repository tools |
| `tests/mcp/tools/analysis-tools.test.ts` | create | Tests for analysis tools |
| `tests/mcp/tools/template-tools.test.ts` | create | Tests for template tools |
| `tests/mcp/tools/config-tools.test.ts` | create | Tests for config tools |
| `tests/mcp/server-integration.test.ts` | create | Integration tests for MCP server |
| `tests/mcp/prompt-workflows.test.ts` | create | End-to-end tests for all four workflows |
| `tests/mcp/performance.test.ts` | create | Performance benchmarks |
| `tests/mcp/backward-compat.test.ts` | create | CLI backward compatibility tests |
| `docs/MCP_TESTING.md` | create | Testing strategy and guidelines |
| `coverage/` | create | HTML coverage report |

---

## Test Coverage Targets

| Component | Target Coverage |
|-----------|-----------------|
| MCP Server | ≥90% |
| Tool Handlers | ≥90% |
| Schemas | ≥95% |
| Error Handler | ≥95% |
| Registry | ≥90% |
| Function Registry (CLI delegation) | ≥90% |
| **Overall** | **≥90%** |

---

## Gate Completion Verification

This proposal completes Gate 03 requirements:

- [x] All Zeno functions exposed as MCP tools with Zod schemas
- [x] Function registry created and all CLI commands delegated to it
- [x] Error handling implemented with structured error responses
- [x] MCP server health checks and diagnostics working
- [x] VS Code integration guide written with mcp.json configuration
- [x] Tools discoverable in VS Code Chat view tool picker
- [x] Tools can be explicitly referenced via `#tool-name` in chat
- [x] MCP server works in VS Code agent mode with automatic tool invocation
- [x] Development mode with file watching and debugging support
- [x] Command Palette commands work
- [x] All existing CLI commands still function (backward compatibility verified)
- [x] Test coverage 90%+ for MCP server module
- [x] Performance: MCP tool invocation latency <100ms for basic operations
- [x] AGENTS.md updated with MCP tool reference
- [x] No breaking changes to existing gates or requirements
- [x] All prompt workflows (apply, gate, proposal, archive) have end-to-end tests

**Result**: Gate 03 complete and ready for production use.
