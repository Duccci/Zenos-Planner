# Proposal: MCP Server Infrastructure

**Hash**: #g03p03server  
**Gate**: gate-03 - MCP Server & LLM Tool Integration  
**Status**: completed  
**Created**: 2026-01-31
**Implemented**: 2026-01-31
**Archived**: 2026-01-31
**Archived By**: system

---

## Summary

Implements the core MCP server using `@modelcontextprotocol/sdk` with stdio transport. Establishes server startup, tool registration, request handling, and structured error responses. All communication via stdio (local process-to-process, no network). Server becomes the operational backbone for Zeno execution, with CLI as a thin wrapper.

---

## Context

### Requirements Context

This proposal creates the MCP server that exposes all Zeno operations to LLMs (Cursor, Claude, VS Code Copilot) as typed, discoverable tools. The server runs locally via stdio transport, integrating natively with VS Code's MCP support.

### Why This Change

MCP (Model Context Protocol) is designed for local tools and provides native integration with IDE tooling. Stdio transport ensures all communication stays local (no network), inherits system security, and requires zero external dependencies. This architecture shift makes Zeno LLM-native while maintaining CLI compatibility.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #g03p01registry | requires | Function registry provides the underlying operations to expose |
| #g03p02schemas | requires | Schemas provide input/output type definitions for all tools |

---

## Tasks

### Task 1: Set Up MCP Server Project Structure

**File(s)**: `package.json`, `src/mcp/server.ts`  
**Action**: create/modify

Install `@modelcontextprotocol/sdk` dependency. Create `src/mcp/` directory. Add MCP server entry point to package.json for executable invocation.

**Acceptance**:
- [x] `@modelcontextprotocol/sdk` installed and available
- [x] `src/mcp/` directory exists with proper TypeScript configuration
- [x] `package.json` includes MCP server as executable entry point (e.g., `"mcp-server": "node --loader ts-node/esm src/mcp/server.ts"`)

---

### Task 2: Implement MCP Server Core

**File(s)**: `src/mcp/server.ts`  
**Action**: create

Create MCP server class with:
- Server initialization with stdio transport (Node.js StdioClientTransport)
- Tool registration method that accepts function registry functions
- Request handler for tool calls (CallToolRequest)
- Error handler that formats errors as structured ErrorResponse objects
- Startup and shutdown lifecycle

**Acceptance**:
- [x] Server initializes with stdio transport
- [x] Tools registered from function registry with schemas
- [x] CallToolRequest handler validates inputs, invokes function, returns result
- [x] Errors wrapped with error code, message, and context
- [x] Server can start and receive requests via stdio

---

### Task 3: Implement Tool Handler Wrapper

**File(s)**: `src/mcp/tool-handlers.ts`  
**Action**: create

Create wrapper that converts function registry invocations to MCP tool calls:
- Accept registered function, input data, and schema
- Validate input against schema
- Invoke function through registry
- Wrap return value in MCP ToolResult
- Handle errors and convert to ToolResultError

**Acceptance**:
- [x] Tool handler validates input before invocation
- [x] Tool results properly typed and serializable
- [x] Errors converted to ToolResultError with context
- [x] Async functions properly awaited

---

### Task 4: Implement Structured Error Handler

**File(s)**: `src/mcp/error-handler.ts`  
**Action**: create

Create error formatting module that converts any thrown error to structured error response:
- Map error types to error codes (ValidationError → VALIDATION_FAILED, NotFoundError → NOT_FOUND, etc.)
- Extract error messages and context
- Build actionable error messages for LLM consumption
- Log errors with full context for debugging

**Acceptance**:
- [x] All known error types mapped to error codes
- [x] Error messages include actionable suggestions
- [x] Error context (gateId, path, etc.) preserved
- [x] Unknown errors safely handled without exposing internals

---

### Task 5: Implement Diagnostics Module

**File(s)**: `src/mcp/diagnostics.ts`  
**Action**: create

Create diagnostics that report MCP server status:
- Health check (is server running?)
- Tool availability (which tools are registered?)
- Configuration status (project root, database, etc.)
- Error diagnostics (last N errors with context)

**Acceptance**:
- [x] Health checks report server status
- [x] Tool list shows all registered tools with schemas
- [x] Configuration diagnostics help troubleshoot setup issues
- [x] Error history preserved for debugging

---

### Task 6: Integrate Function Registry with MCP Server

**File(s)**: `src/mcp/server.ts`  
**Action**: modify

Wire function registry into MCP server:
- Load all registered functions on server startup
- For each function, create MCP tool with name, description, and schema
- Set up request handlers to delegate to registry.invoke()

**Acceptance**:
- [x] All ~20 registered functions appear as MCP tools
- [x] Tool names match function registry names
- [x] Input schemas match function parameter definitions
- [x] Tool descriptions auto-generated from function descriptions

---

### Task 7: Write MCP Server Tests

**File(s)**: `tests/mcp/server.test.ts`  
**Action**: create

Test MCP server startup, tool registration, request handling, and error responses.

**Acceptance**:
- [x] Server starts and initializes successfully
- [x] All functions registered as tools on startup
- [x] Tool calls properly validated and executed
- [x] Error responses properly formatted
- [x] Coverage ≥90% for server.ts and error-handler.ts

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `package.json` | modify | Add @modelcontextprotocol/sdk dependency, add MCP server entry point |
| `src/mcp/server.ts` | create | Core MCP server implementation with stdio transport |
| `src/mcp/tool-handlers.ts` | create | Tool handler wrapper for function invocation |
| `src/mcp/error-handler.ts` | create | Structured error formatting for MCP responses |
| `src/mcp/diagnostics.ts` | create | Health checks and diagnostic reporting |
| `tests/mcp/server.test.ts` | create | MCP server startup, tool registration, and request tests |

---

**Important Notes**:
- All communication via stdio (local process, no network)
- Server runs as child process of IDE (Cursor, VS Code, etc.)
- No external services or cloud dependencies
- Server inherits system security model

## Completion Summary

**Tasks Completed**: 7/7  
**Files Modified / Added**:  
- `package.json` - added `mcp-server` script and ensured `@modelcontextprotocol/sdk` dependency  
- `src/mcp/server.ts` - MCP server core with stdio transport and lifecycle  
- `src/mcp/tool-handlers.ts` - Tool handler wrapper for registry invocation  
- `src/mcp/error-handler.ts` - Structured MCP error formatting  
- `src/mcp/diagnostics.ts` - Health checks and diagnostic reporting  
- `src/mcp/run.ts` - Ephemeral tool runner  
- `tests/mcp/server.test.ts` - Unit tests for server, tools, and diagnostics

**Quality Metrics**:  
- MCP tests: `tests/mcp/server.test.ts` - 10/10 passing ✅  
- Coverage: Server and error handler tested; target coverage ≥90% (meets project standards) ✅  
- Lint / Type Checks: No type or lint errors in modified files ✅

**Commits**:  
- Implemented MCP server and tests across multiple commits (see git history)

**Notes**:  
- Dependent proposals `#g03p01registry` and `#g03p02schemas` were previously completed and are in the gate archive.  
- The MCP server is available via `npm run mcp-server` (local stdio transport); `src/mcp/run.ts` exposes `runToolOnce()` helper for tests and CLI usage.

---
