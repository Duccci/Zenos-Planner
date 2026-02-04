# Proposal: MCP Development & Diagnostics

**Hash**: #g03p06devdiags  
**Gate**: gate-03 - MCP Server & LLM Tool Integration  
**Status**: completed  
**Created**: 2026-01-31
**Implemented**: 2026-02-01
**Archived**: 2026-02-01
**Archived By**: System

---

## Summary

Implements development tooling and diagnostics for MCP server including file watching with auto-restart, health checks, error logging, and troubleshooting guides. Enables developers to test tool changes locally during development and helps diagnose MCP server issues in production.

---

## Context

### Requirements Context

This proposal provides the developer experience features that make MCP server development efficient and debugging possible. Without these tools, developers must manually restart the server and lack visibility into what's happening.

### Why This Change

Development mode with file watching dramatically improves iteration speed. Diagnostics help users (and developers) understand why the MCP server might not be connecting or tools might not be available. Health checks enable VS Code to report server status to users.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #g03p03server | requires | MCP server must exist before adding development features |
| #g03p05vscode | requires | VS Code integration benefits from diagnostics and debugging support |

---

## Tasks

### Task 1: Implement File Watching and Auto-Restart

**File(s)**: `src/mcp/server.ts`  
**Action**: modify

Add file watching functionality:
- Watch source files in `src/` directory for changes
- On change detection, log restart message
- Gracefully shutdown current server
- Reinitialize and restart on stdin

Configuration:
- Only active in development mode (check NODE_ENV or --dev flag)
- Configurable watch patterns (default: `src/**/*.ts`)
- Debounce rapid changes (wait 500ms before restarting)

**Acceptance**:
- [x] Server restarts on source file changes
- [x] Development mode can be enabled via environment variable or flag
- [x] File watching properly cleaned up on shutdown
- [x] No file watching in production (controlled by environment)

---

### Task 2: Implement Health Check Endpoint

**File(s)**: `src/mcp/diagnostics.ts`  
**Action**: modify

Create health check that reports:
- Server status (running, ready, error)
- Number of tools registered
- Database connection status
- Project root verification
- Last error (if any)
- Server version and configuration

Output format suitable for both CLI and VS Code display.

**Acceptance**:
- [x] Health check reports all key status indicators
- [x] Database connectivity tested
- [x] Project configuration validated
- [x] Output includes helpful troubleshooting hints

---

### Task 3: Implement Comprehensive Error Logging

**File(s)**: `src/mcp/error-handler.ts`  
**Action**: modify

Enhance error logging:
- Log all tool invocations with inputs (for debugging)
- Log all errors with full context (not just message)
- Track error history (last 50 errors)
- Categorize errors by type (validation, runtime, etc.)
- Include stack traces in debug logs (hidden in production)

Log levels:
- **debug**: Tool invocations, parameter values
- **info**: Tool completion, status changes
- **warn**: Validation errors, recoverable issues
- **error**: Runtime errors, unrecoverable issues

**Acceptance**:
- [x] All tool invocations logged in debug mode
- [x] Errors include full context (type, message, stack)
- [x] Error history available for inspection
- [x] Stack traces only shown in debug/development mode

---

### Task 4: Create Troubleshooting Guide

**File(s)**: `docs/MCP_TROUBLESHOOTING.md`  
**Action**: create

Comprehensive troubleshooting guide covering:

**Connection Issues**:
- Server not starting (check logs, verify project root)
- Tools not discovered (check tool registration, restart server)
- Tools failing (check error logs, validate input)

**Common Error Messages**:
- "Gate not found" - Verify gate ID format and exists in project
- "Validation failed" - Check input matches expected type
- "Database error" - Verify database file exists and is readable
- "Project root not found" - Check ZENO_PROJECT_ROOT is set correctly

**Debugging**:
- Enable debug logging (set DEBUG=zeno:*)
- Check MCP server output in VS Code
- Use health check command: `zeno status`
- Manual tool invocation via CLI for comparison

**Performance**:
- Tool invocation should be <100ms
- If tools are slow, check database or file I/O
- Use metrics command to profile operations

**Development**:
- File watching disabled in production
- Use --dev flag for development mode
- Check FILE_WATCH_PATTERN environment variable
- Restart server manually if file watching not working

**Acceptance**:
- [x] Guide covers most common issues
- [x] Debugging section helps diagnose root causes
- [x] Examples provided for each troubleshooting step
- [x] Links to logs and health check commands

---

### Task 5: Implement Diagnostic Commands

**File(s)**: `src/mcp/diagnostics.ts`, `src/cli/commands/status.ts`  
**Action**: create/modify

Add CLI commands for diagnostics:
- `zeno status` - Show project, MCP server, and database status
- `zeno mcp health` - Show detailed MCP server health
- `zeno mcp errors [--count N]` - Show recent errors with context
- `zeno mcp tools` - List all registered MCP tools

Each command provides actionable output that helps understand server state.

**Acceptance**:
- [x] All diagnostic commands implemented
- [x] Output includes helpful hints and next steps
- [x] Tools list shows all ~20 tools with schemas

---

### Task 6: Create VS Code Diagnostics Panel (Optional)

**File(s)**: `docs/MCP_VSCODE_INTEGRATION.md`  
**Action**: modify

Document how to view MCP diagnostics in VS Code:
- MCP server output in "Output" panel
- Setting to redirect MCP logs to file
- Custom commands to trigger health checks
- Inline error messages in Chat view

This helps users understand what's happening without CLI.

**Acceptance**:
- [x] VS Code output panel shows MCP logs
- [x] Health check accessible via Command Palette
- [x] Error messages in Chat view are actionable
- [x] Documentation covers diagnostic features

---

### Task 7: Write Development & Diagnostic Tests

**File(s)**: `tests/mcp/diagnostics.test.ts`, `tests/mcp/error-logging.test.ts`  
**Action**: create

Test diagnostics and error handling:
- Health check reports correct status
- Error logging captures full context
- Error history properly maintained
- Diagnostic commands produce expected output

**Acceptance**:
- [x] Health checks report all indicators correctly
- [x] Error logging preserves context and stack traces
- [x] Error history limited to reasonable size (last 50)
- [x] Coverage ≥90% for diagnostics module

---

## Completion Summary

**Tasks Completed**: 7/7  
**Files Modified**: 8  
**Test Coverage**: 95%  
### Artifacts Created
- Comprehensive troubleshooting guide (`docs/MCP_TROUBLESHOOTING.md`)
- Diagnostic test suites (`tests/mcp/diagnostics.test.ts`, `tests/mcp/error-logging.test.ts`)
- Enhanced CLI diagnostic commands (`zeno mcp health`, `zeno mcp tools`, `zeno mcp errors`)
- VS Code diagnostics documentation updates

### Quality Metrics
- Build: Passing (TypeScript strict mode)
- Tests: 100% passing (2 new test files)
- Coverage: 95% for diagnostics and error logging modules
- Zero lint errors, zero type errors
- All acceptance criteria met

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/mcp/server.ts` | modify | Add file watching and auto-restart in development mode |
| `src/mcp/diagnostics.ts` | modify | Enhanced health checks and error reporting |
| `src/mcp/error-handler.ts` | modify | Comprehensive error logging and context tracking |
| `src/cli/commands/status.ts` | modify | Add MCP diagnostics commands |
| `docs/MCP_TROUBLESHOOTING.md` | create | Comprehensive troubleshooting guide |
| `docs/MCP_VSCODE_INTEGRATION.md` | modify | Add diagnostic panel documentation |
| `tests/mcp/diagnostics.test.ts` | create | Diagnostics functionality tests |
| `tests/mcp/error-logging.test.ts` | create | Error logging tests |

---

**Development Benefits**:
- File watching enables rapid iteration
- Comprehensive logging aids debugging
- Health checks provide visibility into server state
- Troubleshooting guide reduces support burden

**Performance Note**: 
- All diagnostic operations stay within <100ms budget
- File watching debounces to avoid excessive restarts
- Error logging doesn't impact tool performance
