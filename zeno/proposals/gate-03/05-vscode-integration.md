# Proposal: VS Code Integration

**Hash**: #g03p05vscode  
**Gate**: gate-03 - MCP Server & LLM Tool Integration  
**Status**: pending  
**Created**: 2026-01-31

---

## Summary

Implements VS Code integration for MCP server including configuration, tool discovery, native Chat view integration, and comprehensive documentation. Enables VS Code Copilot (and Cursor, which is VS Code-based) to discover and invoke Zeno tools natively with full type safety and automatic tool picker population.

---

## Context

### Requirements Context

This proposal brings MCP server integration to VS Code's native ecosystem. Users can configure the MCP server in `mcp.json`, and VS Code automatically discovers Zeno tools in the Chat view's tool picker, enabling prompt-based workflows.

### Why This Change

VS Code v1.102+ has native MCP support with automatic tool discovery and tool picker integration. By providing proper configuration and documentation, we enable users to use Zeno through native VS Code Chat without terminal commands or complex setup.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #g03p03server | requires | MCP server must be fully functional before VS Code integration |
| #g03p04tools | requires | All tools must be implemented and registered for discovery |

---

## Tasks

### Task 1: Create MCP Server Configuration Template

**File(s)**: `mcp.json.template`, `docs/MCP_VSCODE_SETUP.md`  
**Action**: create

Create configuration template that users can add to their VS Code settings:
```json
{
  "servers": {
    "zenoPlanner": {
      "command": "node",
      "args": ["path/to/zeno/bin/mcp-server.js"],
      "env": {
        "ZENO_PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

Include setup documentation covering:
- Where to add `mcp.json` (workspace or user profile)
- How to set project root path
- Verification steps to confirm server is running

**Acceptance**:
- [ ] Template includes proper stdio transport configuration
- [ ] Environment variables documented for project context
- [ ] Setup instructions work for Windows, macOS, Linux
- [ ] Troubleshooting section covers common issues

---

### Task 2: Implement MCP Server Executable

**File(s)**: `bin/mcp-server.js`  
**Action**: create

Create executable entry point for MCP server:
- Parse command line arguments and environment variables
- Initialize Zeno project context
- Load function registry
- Start MCP server with stdio transport
- Handle graceful shutdown

**Acceptance**:
- [ ] Executable starts MCP server on demand
- [ ] Supports ZENO_PROJECT_ROOT environment variable
- [ ] Handles missing project gracefully (helpful error message)
- [ ] Listens on stdio for MCP protocol messages

---

### Task 3: Create VS Code MCP Integration Guide

**File(s)**: `docs/MCP_VSCODE_INTEGRATION.md`  
**Action**: create

Comprehensive guide covering:
- **Tool Discovery**: How VS Code automatically discovers Zeno tools
- **Chat View Integration**: Using Zeno tools in VS Code Chat
- **Tool Picker**: Finding and selecting Zeno tools by name
- **Explicit Tool Reference**: Using `#tool-name` syntax in chat prompts
- **Custom Agents**: Creating custom agents that use Zeno tools
- **Command Palette**: Using `MCP: List Servers`, `MCP: Reset Cached Tools` commands
- **Development Mode**: Testing tool changes locally
- **Troubleshooting**: Debugging connection issues

Include screenshots and examples of Chat view usage.

**Acceptance**:
- [ ] Guide covers all major VS Code MCP features
- [ ] Examples show real usage patterns with Zeno tools
- [ ] Troubleshooting section helps users solve common problems
- [ ] Screenshots demonstrate Chat view integration

---

### Task 4: Create Prompt Workflow Documentation

**File(s)**: `docs/MCP_PROMPT_WORKFLOWS.md`  
**Action**: create

Document the four prompt workflows enabled by MCP:
- **`/zeno-apply` Workflow**: Proposal implementation orchestration
  - Load proposal via `proposal_show` tool
  - Review tasks and dependencies
  - Record requirement lifecycle via proposal approvals and gate archival (no DB status)
  - Request approval via `proposal_approve` tool
  - Track progress with `manage_todo_list` tool
  
- **`/zeno-gate` Workflow**: Gate generation/regeneration
  - Load gate PRD via `gates_show` tool
  - Generate requirements with template functions
  - Create sequence with `req_deps` tool
  - Validate with `gates_regenerate` tool
  
- **`/zeno-proposal` Workflow**: Proposal document generation
  - Read gate PRD via `gates_show` tool
  - Access templates with `template_get` tool
  - Establish dependencies with `req_deps` tool
  - Create proposal markdown file
  
- **`/zeno-archive` Workflow**: Artifact archival
  - Validate completion with `gates_show`, `proposal_list` tools
  - Move artifacts and create tags
  - Update consolidation registry

Each workflow documented with:
- Step-by-step orchestration pattern
- MCP tools used in sequence
- Expected outputs and how LLM interprets them
- Error handling strategies

**Acceptance**:
- [ ] All four workflows documented with examples
- [ ] Tool sequences match actual MCP API
- [ ] Error cases and recovery strategies included
- [ ] Workflow diagrams (ASCII or Mermaid) show data flow

---

### Task 5: Add Tool Documentation to Chat View

**File(s)**: `src/mcp/server.ts`  
**Action**: modify

Ensure each MCP tool has:
- Clear, concise description for VS Code Chat view tool picker
- Parameter documentation with usage examples
- Return value documentation with example outputs
- Error conditions and how LLM should handle them

Tool descriptions should be:
- One-sentence summary
- Clear indication of what the tool does
- Example usage pattern

**Acceptance**:
- [ ] All ~20 tools have descriptions in Chat view
- [ ] Descriptions are clear and concise (<100 chars)
- [ ] Examples show real usage patterns
- [ ] Error documentation helps LLMs recover gracefully

---

### Task 6: Implement VS Code Development Mode

**File(s)**: `src/mcp/server.ts`, `docs/MCP_DEVELOPMENT.md`  
**Action**: create/modify

Add development mode features:
- File watching for source changes (auto-restart server)
- Debug logging for troubleshooting
- Error reporting to VS Code output panel
- Health check endpoint for diagnostics

Create development documentation covering:
- How to run MCP server in development mode
- Debugging with VS Code debugger
- Testing tools locally before deployment
- Resetting cached tools during development

**Acceptance**:
- [ ] File watching triggers server restart on code changes
- [ ] Debug logging shows all tool invocations
- [ ] Health checks report server status to VS Code
- [ ] Development setup takes <5 minutes

---

### Task 7: Write VS Code Integration Tests

**File(s)**: `tests/mcp/vscode-integration.test.ts`  
**Action**: create

Test MCP server integration with VS Code:
- Server starts with proper stdio configuration
- Tool discovery returns all registered tools
- Chat view can invoke tools successfully
- Error responses format correctly for display
- Explicit tool reference syntax (`#tool-name`) works

**Acceptance**:
- [ ] Server starts and responds to MCP protocol messages
- [ ] Tool list includes all ~20 tools with descriptions
- [ ] Sample tool invocations succeed and return proper output
- [ ] Error responses render correctly in Chat view
- [ ] Coverage ≥90% for MCP server integration paths

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `mcp.json.template` | create | VS Code MCP server configuration template |
| `bin/mcp-server.js` | create | Executable entry point for MCP server |
| `docs/MCP_VSCODE_SETUP.md` | create | MCP server setup guide for VS Code |
| `docs/MCP_VSCODE_INTEGRATION.md` | create | VS Code Chat view integration guide |
| `docs/MCP_PROMPT_WORKFLOWS.md` | create | Prompt workflow documentation |
| `docs/MCP_DEVELOPMENT.md` | create | Development mode setup and debugging |
| `src/mcp/server.ts` | modify | Add tool descriptions and development mode |
| `tests/mcp/vscode-integration.test.ts` | create | VS Code integration tests |

---

**Key Features**:
- Native VS Code Chat view integration (v1.102+)
- Automatic tool discovery in tool picker
- Explicit tool reference via `#tool-name` syntax
- Custom agent support for advanced workflows
- Development mode for testing and debugging
