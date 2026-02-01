# Gate 03: MCP Server & LLM Tool Integration

**Status**: pending  
**Type**: feature  
**Created**: 2026-01-31  
**Sequence**: 3 of 13  
**Hash**: #g03mcpllm

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Transforms Zeno from a CLI-centric tool to an LLM-native system by implementing a Model Context Protocol (MCP) server that exposes all Zeno functions as typed, discoverable tools. This gate creates a thin wrapper around existing CLI commands, enabling LLMs (Claude, Cursor, GPT-4, VS Code Copilot) to invoke Zeno operations directly with full type safety, structured error handling, and native IDE integration. The MCP server is designed to run locally in VS Code through stdio transport, becoming discoverable in the Chat view's tool picker and available for use in chat prompts and custom agents. The MCP server becomes the primary interface for AI agents, while the CLI remains available as a secondary interface for human operators and CI/CD pipelines. This architectural shift aligns Zeno's execution model with modern AI tooling and significantly improves the LLM-driven workflow experience.

## Objectives

### Core MCP Infrastructure
- [ ] Implement MCP server using `@modelcontextprotocol/sdk` with Node.js transport
- [ ] Define Zod schemas for all Zeno functions (gates, requirements, proposals, repositories, analysis)
- [ ] Create TypeScript interfaces for all tool input/output schemas with documentation
- [ ] Implement error handling with structured error responses and context
- [ ] Build MCP server configuration and startup logic compatible with VS Code stdio transport
- [ ] Ensure MCP server meets VS Code requirements (Named pipes compatibility on Windows, Unix sockets on Linux/macOS)
- [ ] Implement MCP server health checks and diagnostics for VS Code troubleshooting

### MCP Tool Implementations
- [ ] Expose gate management functions as MCP tools (`gates_start`, `gates_complete`, `gates_list`, `gates_show`)
- [ ] Expose requirement management functions as MCP tools (`req_list`, `req_show`, `req_deps`, `req_transfer`)
- [ ] Expose proposal functions as MCP tools (`proposal_list`, `proposal_show`, `proposal_validate`, `proposal_approve`, `proposal_reject`)
- [ ] Expose repository functions as MCP tools (`repos_list`, `repos_deps`, `repos_detect`)
- [ ] Expose analysis functions as MCP tools (`analyze`, `show_entity`)
- [ ] Expose template management functions as MCP tools (`template_list`, `template_get`, `template_context`)

### VS Code Integration & Prompt Capabilities
- [ ] Create `mcp.json` configuration file template for VS Code MCP server registration
- [ ] Create VS Code Copilot integration guide (Chat view, tool picker, custom agents, Command Palette)
- [ ] Enable VS Code Chat view tool discovery and automatic tool picker population
- [ ] Support explicit tool reference syntax (`#tool-name`) in chat prompts
- [ ] Implement MCP server as primary backend for custom agent workflows
- [ ] Support MCP tool invocation in VS Code Copilot agent mode (automatic tool calling)
- [ ] Implement MCP development mode with file watching and auto-restart for VS Code development
- [ ] Support VS Code Command Palette integration (`MCP: List Servers`, `MCP: Reset Cached Tools`)

### Prompt-Based Workflow Capabilities
- [ ] **zeno-apply workflow** - Proposal implementation orchestration: identify proposal, read details, verify dependencies, invoke `proposal_start`, implement tasks, update requirements, validate, request approval, commit, archive
- [ ] **zeno-gate workflow** - Gate generation/regeneration: determine mode, gather context, analyze state, define boundaries, generate sequence, create PRD files, handle rebaseline, update diagrams, attribute requirements, validate structure
- [ ] **zeno-proposal workflow** - Proposal document generation: identify type, start gate, read source, review existing, decompose gate steps, generate markdown files, establish dependencies, validate structure, cross-reference architecture
- [ ] **zeno-archive workflow** - Artifact archival: validate readiness, consolidate proposals, update status, create completion summary, move to archive, create git tag, update project state, commit changes
- [ ] Implement progress tracking capability via `manage_todo_list` tool integration for proposal implementation
- [ ] Support template function access for prompt workflows: `getTemplate()`, `getTemplatesByCategory()`, `config_get()` as MCP callable functions
- [ ] Enable dependency chain resolution: `req_deps` for checking proposal dependencies before implementation
- [ ] Support proposal status workflow: pending → in_progress → completed → archived with quality validation gates

### CLI and Function Registry
- [ ] Implement centralized function registry exposing all Zeno operations as invocable functions
- [ ] Update CLI commands to delegate to MCP-backed function registry (CLI becomes thin wrapper over MCP)
- [ ] Ensure all existing CLI commands map to MCP tools with backward compatibility

### Testing & Quality
- [ ] Write comprehensive tests for all MCP tool schemas and invocations
- [ ] Test all prompt workflow patterns (apply, gate, proposal, archive) end-to-end
- [ ] Achieve 90% test coverage for MCP server and tool implementations
- [ ] Validate VS Code integration with tool discovery and agent mode execution
- [ ] Performance validation: MCP tool invocation latency <100ms for basic operations

## Context

### What Was Completed Before This Gate

Gate 01 (Core Infrastructure) and Gate 02 (Zeno Engine & Gate Generation) established:

- TypeScript strict mode project with CLI framework using Commander.js
- Full suite of Zeno CLI commands (`zeno init`, `zeno gates list/show/start/complete`, `zeno analyze`)
- Project-level requirements generated during `zeno init`
- AGENTS.md generation for AI context
- Code analysis and dependency graph capabilities
- Git integration utilities
- All foundational infrastructure for operations

### Prerequisites - Required Solitary Proposals

This gate requires two solitary proposals to be completed before starting:

1. **Proposal #s20260131loader** - Template Loader Infrastructure
   - Creates `loadTemplate()`, `loadAllTemplates()`, `getTemplatesByCategory()` as registered functions
   - Enables LLMs to access templates programmatically
   - Required: Template functions must be available in function-registry before MCP can wrap them as tools

2. **Proposal #s20260131templates** - Template CLI Commands  
   - Implements `zeno template list`, `zeno template get`, `zeno template context` commands
   - Provides structured CLI access to templates
   - Required: All CLI commands must exist before MCP wraps them as tools

## Proposal Status

| Proposal | Status | Archived |
|----------|--------|----------|
| #g03p01registry | completed | 2026-01-31 |
| #g03p02schemas | completed | 2026-01-31 |
| #g03p03server | completed | 2026-01-31 |
| #g03p04tools | completed | - |
| #g03p05vscode | pending | - |
| #g03p06diagnostics | pending | - |
| #g03p07testing | pending | - |

### What This Gate Enables

**Architectural Shift to LLM-Native Execution:**
- All downstream gates (4-13) can now be executed through native tool calls instead of terminal command parsing
- LLMs gain structured type safety and error handling
- IDE integration (Cursor, Claude) provides tool discovery and documentation
- Eliminates string parsing fragility and shell escaping issues
- Enables subagent orchestration via Cursor workflows (Gate 12 enhancement)

**VS Code Prompt Workflow Support:**
This gate enables the four prompt workflows defined in `.github/prompts/`:
- `/zeno-apply` - LLMs can orchestrate proposal implementation: read proposal details, manage task lifecycle, validate quality gates, track progress, commit changes
- `/zeno-gate` - LLMs can generate or regenerate gates: read PRD, decompose requirements, template-based generation, validate dependencies, update roadmaps
- `/zeno-proposal` - LLMs can generate proposal documents: read gate PRD, decompose tasks, create markdown structures, establish dependency chains
- `/zeno-archive` - LLMs can archive completed work: validate readiness, consolidate artifacts, create git tags, update project state

Each workflow is backed by MCP tools that handle actual state changes, with LLMs orchestrating the steps. This separates presentation logic (prompts) from execution logic (MCP tools), enabling prompt reuse across different LLM instances.

**Specific Gate Dependencies:**
- **Gate 4 (Requirements & Database Layer)**: LLMs invoke `req_list`, `req_show`, `req_deps`, `req_transfer` via MCP tools
- **Gate 5 (Architecture & Diagram Generation)**: LLMs discover architecture functions through MCP tool picker
- **Gate 7+ (Proposal Generation & Implementation)**: All proposal workflows use MCP tools as backend
- **Gate 6 (Multi-Repo Detection)**: Repository functions available as typed tools
- **Gate 7 (Proposal Generation)**: LLMs invoke proposal tools with structured schemas
- **Gate 8-11**: All validation, approval, and replan operations use MCP tools
- **Gate 13+ (Subagent Orchestration)**: Cursor workflows call Zeno functions via MCP tools for parallel execution

### Scope Boundaries

**In Scope**:
- MCP server implementation with Node.js transport (stdio-based)
- Complete Zod schema definitions for all Zeno function inputs and outputs
- MCP tool definitions for all existing CLI commands:
  - Gate functions (list, show, start, complete, generate)
  - Requirement functions (list, show, deps, status, transfer)
  - Proposal functions (list, show, validate, approve, reject, start)
  - Repository functions (list, deps, detect)
  - Analysis functions (analyze, show)
  - Project functions (status, init, rescope, dashboard)
  - Template functions (list, get, context) - from solitary proposals
- Structured error responses with context (error code, message, suggestions)
- MCP server lifecycle management (startup, shutdown, health checks)
- Configuration for Cursor and Claude integration
- MCP server as primary execution interface
- CLI commands refactored to delegate to MCP backend (thin wrapper pattern)
- Comprehensive tests for all MCP tools (input validation, output schemas, error cases)
- 90% test coverage minimum for MCP server module
- Documentation on MCP server setup and tool invocation patterns
- **Prompt workflow support** - Backend implementation enabling prompt-based workflows:
  - `/zeno-apply` workflow: MCP tools for proposal status transitions, requirement updates, validation, git operations
  - `/zeno-gate` workflow: MCP tools for gate generation, template loading, requirement attribution
  - `/zeno-proposal` workflow: MCP tools for proposal creation, template access, dependency resolution
  - `/zeno-archive` workflow: MCP tools for archival state transitions, git operations, artifact consolidation
  - Template functions accessible via MCP: `getTemplate()`, `getTemplatesByCategory()` callable by LLMs
  - Progress tracking via LLM-invocable operations for task state management

**Out of Scope**:
- HTTP/WebSocket transport (only stdio-based for security and local execution)
- Network communication or remote execution (all processing is local)
- Cloud services or external APIs (no third-party service dependencies)
- Authentication/authorization (runs locally, single-user focus, inherits system security)
- API keys, OAuth, or credential management (no external service authentication)
- MCP server scaling or load balancing (local tool only, no clustering)
- Support for external MCP servers (Zeno only exposes its own functions)
- Remote code execution or inter-process communication beyond stdio
- Changes to database schema or core algorithms (only wrapping existing functionality)
- Prompt file creation or modification (`.github/prompts/*.prompt.md` files are separate, not generated by gate)

## Requirements

**Attributed from Project-Level Requirements:**

This gate addresses the following cross-cutting architectural requirements from `zeno init`:

1. **LLM-Native Tool Integration** - Zeno must expose functions to LLMs via structured tools (not CLI commands), all local
2. **Type-Safe Function Calls** - All tool invocations require Zod schema validation with local processing
3. **Structured Error Handling** - Errors returned as structured objects, not string parsing, processed locally
4. **IDE Tool Discovery** - Cursor and Claude can discover Zeno tools in their native tool pickers (local registration only)
5. **Reduced Context Size** - LLMs work with tool names and hashes, not long file paths
6. **Local Privacy & Execution** - All data processing stays local, no cloud services, no external APIs, no telemetry

## Technical Decisions

### 1. MCP Server Architecture - Local-Only Execution
- **Choice**: Implement MCP server using `@modelcontextprotocol/sdk` with stdio-based transport (local process, no network)
- **Alternatives Considered**: HTTP REST server, WebSocket, cloud-hosted service, custom JSON-RPC, remote execution
- **Rationale**: Stdio-based MCP is designed for local tools, provides native integration with Cursor/Claude, eliminates network complexity, inherits system security model, zero external dependencies, no cloud services required, all data stays local
- **Local-Only Guarantee**: 
  - All communication via stdio pipes (process-to-process)
  - No network sockets or remote connections
  - No external API calls or service dependencies
  - Database (SQLite) is local file-based
  - All file access is local file system only
  - No telemetry, analytics, or cloud reporting
- **Trade-offs**: Gained IDE integration, type safety, and local privacy; lost HTTP accessibility and web-based deployment (acceptable and desired for MVP)

### 2. CLI as Thin Wrapper
- **Choice**: Refactor CLI commands to delegate to MCP-backed function registry instead of direct implementation
- **Alternatives Considered**: Maintain separate CLI and MCP implementations, keep CLI primary with MCP overlay
- **Rationale**: Single source of truth eliminates duplication, prevents divergence between interfaces, easier maintenance, ensures CLI and MCP always synchronized
- **Trade-offs**: Gained consistency; CLI invocation now goes through MCP layer (adds minimal overhead)

### 2.5. VS Code Integration - Native MCP Support
- **Choice**: Design MCP server for native VS Code integration via stdio transport and `mcp.json` configuration
- **Alternatives Considered**: Generic MCP implementation without VS Code optimizations, separate VS Code extension
- **Rationale**: VS Code's MCP support (v1.102+) provides native tool discovery in Chat view, automatic tool picker integration, custom agent support, built-in trust/security prompts, and MCP server registry. Using stdio transport aligns with VS Code's recommended pattern for local tools.
- **VS Code Features Supported**:
  - Stdio-based stdio transport (standard for VS Code local MCP servers)
  - Tool discovery and registration in Chat view
  - Automatic tool invocation in agent mode
  - Explicit tool reference via `#tool-name` in chat
  - Custom prompt and agent integration
  - MCP server management via Command Palette (`MCP: List Servers`, `MCP: Reset Cached Tools`)
  - Development mode with file watching and debugging support
- **Configuration**:
  - `mcp.json` in user profile or workspace folder
  - Server naming convention: camelCase (e.g., "zenoPlanner")
  - Predefined variable support (e.g., `${workspaceFolder}`)
  - Environment variable support via `env` and `envFile`
- **Trade-offs**: Gained deep VS Code integration; restricted to VS Code (Cursor is VS Code based, so compatible)

### 3. Schema Definition Strategy
- **Choice**: Use Zod for runtime schema validation with TypeScript interfaces for code clarity
- **Alternatives Considered**: JSON Schema, Joi, custom validation
- **Rationale**: Zod provides runtime validation (catches errors at execution), TypeScript integration, excellent error messages, already used elsewhere in Zeno
- **Trade-offs**: Gained runtime safety; added one more schema definition (but reuses existing Zodo definitions)

### 4. Error Handling Model
- **Choice**: Structured error responses with error codes, user-friendly messages, context, and recovery suggestions
- **Alternatives Considered**: Exception throwing, string error messages, error codes only
- **Rationale**: LLMs parse structured errors better than exceptions, context helps with debugging, suggestions enable automatic recovery attempts
- **Trade-offs**: Gained debuggability; added error response structure to all tool definitions

### 5. Prompt Workflow Architecture
- **Choice**: Separate prompt layer (`.github/prompts/`) from execution layer (MCP tools)
- **Alternatives Considered**: Embed workflow logic in MCP tools, hardcode prompt workflows
- **Rationale**: 
  - Prompts define LLM-friendly orchestration patterns (step sequences, guardrails, templates)
  - MCP tools handle actual state changes and data operations (immutable, testable, reusable)
  - Enables prompt reuse across different LLM instances and versions
  - Allows prompt updates without touching backend code
  - Each prompt can use different tool subsets and calling patterns without affecting implementation
- **Workflow Examples**:
  - `/zeno-apply`: Uses `proposal_show`, `proposal_validate` (requirement lifecycle is recorded via proposal approvals and gate archival) for state management
  - `/zeno-gate`: Uses `getTemplate`, `config_get`, requirement attribution tools for generation
  - `/zeno-proposal`: Uses `getTemplate`, `req_deps` tools for decomposition
  - `/zeno-archive`: Uses `gates_show`, `proposal_list`, git-integration tools for consolidation
- **Trade-offs**: Gained flexibility and prompt updateability; requires careful tool design for prompt compatibility

## Architecture Updates

### MCP Server Architecture (100% Local Execution)

```
┌─────────────────────────────────────────────────────────────────┐
│                LLM (Cursor, Claude) - Local IDE                │
│             No external API calls or cloud sync                 │
└──────────────┬──────────────────────────────────────────────────┘
               │ Native Tool Calls via Stdio
               │ (Zod-validated schemas, in-process communication)
               ▼ (NO network, NO remote calls)
┌─────────────────────────────────────────────────────────────────┐
│         MCP Server (stdio transport) - LOCAL PROCESS            │
│       All execution stays in user's local environment           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Tool Definitions (with Zod schemas)                        ││
│  │  ├─ gates_start, gates_complete, gates_list, gates_show   ││
│  │  ├─ req_list, req_show, req_deps, req_transfer││
│  │  ├─ proposal_list, proposal_show, proposal_validate, ... ││
│  │  ├─ repos_list, repos_deps, repos_detect                 ││
│  │  └─ analyze, show_entity, status, init, rescope, ...     ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Function Registry (LOCAL delegates to Zeno core)            ││
│  │  ├─ GateManager (local gates logic)                         ││
│  │  ├─ RequirementManager (local requirement storage)          ││
│  │  ├─ ProposalManager (local proposal management)             ││
│  │  ├─ RepositoryManager (local repo metadata)                 ││
│  │  └─ AnalysisEngine (local code analysis)                    ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Local Data Layer                                             ││
│  │  ├─ SQLite (zeno/.zeno/requirements.db) - LOCAL FILE       ││
│  │  ├─ File System (zeno/gates/*.md) - LOCAL FILES            ││
│  │  ├─ Git Repository (.git) - LOCAL REPO                      ││
│  │  └─ No external storage, no cloud sync, no telemetry       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
               ▲
               │ Stdio stream (in-process)
               │ No network sockets
               │
┌──────────────┴──────────────────────────────────────────────────┐
│              CLI (thin wrapper) - LOCAL ONLY                    │
│  ├─ Parses user commands locally                                │
│  ├─ Delegates to MCP function registry (local process)          │
│  └─ Formats output for terminal display                         │
└─────────────────────────────────────────────────────────────────┘

KEY: All operations are local. No external dependencies. No cloud services.
     Data never leaves user's machine.
```

### Tool Schema Pattern

Each MCP tool follows this pattern:

```typescript
{
  name: "tool_name",
  description: "Human-readable description",
  inputSchema: z.object({
    param1: z.string().describe("Parameter description"),
    param2: z.number().optional()
  }).describe("Input parameters"),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      context: z.record(z.any()).optional()
    }).optional()
  }).describe("Response format")
}
```

### Prompt Workflow Integration Layer

The prompts in `.github/prompts/` define orchestration patterns that leverage MCP tools. Each prompt establishes:

**Workflow Pattern (Prompts):**
```
User → LLM (with prompt guardrails) → MCP Tool Calls → State Changes → Result
```

**Four Implemented Workflows:**

1. **`/zeno-apply` - Proposal Implementation**
   - Reads proposal details via `proposal_show`, `req_show` tools
   - Manages task execution lifecycle with progress tracking
   - Requirement lifecycle is recorded via proposal approvals and gate archival (no DB status)
   - Validates work via `proposal_validate` tool
   - Commits changes to git (using git integration MCP tools)
   - Archives completed proposal via archive workflow

2. **`/zeno-gate` - Gate Generation/Regeneration**
   - Loads templates via `getTemplate`, `getTemplatesByCategory` MCP functions
   - Retrieves project config via `config_get` MCP function
   - Generates gate PRD using template structures
   - Attributes requirements via `req_list` and requirement attribution tools
   - Updates architecture diagrams (gate-roadmap) via diagram update tools
   - Validates gate structure before completion

3. **`/zeno-proposal` - Proposal Document Generation**
   - Reads gate PRD using `gates_show` MCP tool
   - Loads proposal template via `getTemplate` MCP function
   - Maps gate steps to tasks using `req_deps` for dependency chains
   - Generates markdown proposals in `zeno/proposals/gate-XX/` structure
   - Establishes proposal dependencies based on gate sequencing

4. **`/zeno-archive` - Artifact Archival**
   - Validates completion status via `gates_show`, `proposal_list` tools
   - Consolidates work using git log queries (MCP integration)
   - Updates artifact status via gate/proposal status tools
   - Creates git tags via git integration MCP tools
   - Moves artifacts to archive directory structure

**Tool Dependencies per Workflow:**

| Workflow | Required MCP Tools | Template Functions |
|----------|-------------------|------------------|
| apply | proposal_show, proposal_validate, req_show | manage_todo_list (external - AVOID if triggers git operations) |
| gate | req_list, config_get | getTemplate, getTemplatesByCategory |
| proposal | gates_show, req_deps, proposal creation | getTemplate, getTemplatesByCategory |
| archive | gates_show, proposal_list, git operations | config_get |

**Prompt-Specific Guardrails Supported:**
- Each prompt defines quality thresholds (sourced from `config_get()` MCP function)
- Prompts establish task sequencing and dependencies
- Prompts define acceptance criteria validation patterns
- Prompts manage state transitions (pending → in_progress → completed)
- Prompts enforce proposal completion checks before archival

**MCP Tools Required for Prompt Support:**
- All core tools must return responses compatible with prompt parsing
- Error responses must include actionable context for LLM retry logic
- Status transitions must be idempotent (safe to retry)
- Template access must provide structured content for prompt composition

## Dependencies

### Internal Dependencies
- **zeno-engine** - Core gate generation (called by MCP tools)
- **gate-manager** - Gate lifecycle (called by MCP tools)
- **requirement-manager** - Requirement CRUD (called by MCP tools)
- **proposal-manager** - Proposal management (called by MCP tools)
- **code-analyzer** - Analysis functions (called by MCP tools)
- **repo-detector** - Repository detection (called by MCP tools)
- **validation-engine** - Quality checks (called by MCP tools)
- **function-registry** - New module to centralize all Zeno operations

### External Dependencies
- **@modelcontextprotocol/sdk** - MCP server implementation
- **zod** - Schema validation (already in project)
- **typescript** - Type definitions (already in project)

## Implementation Steps

1. **Set up MCP server infrastructure**
   - Install `@modelcontextprotocol/sdk`
   - Create `src/mcp/server.ts` with MCP server lifecycle
   - Implement stdio transport initialization
   - Add MCP server to `package.json` as a callable entry point

2. **Define Zod schemas for all tools**
   - Create `src/mcp/schemas/` directory with schema modules:
     - `gate-schemas.ts` (gates_start, gates_complete, gates_list, gates_show)
     - `requirement-schemas.ts` (req_list, req_show, req_deps, req_status, req_transfer)
     - `proposal-schemas.ts` (proposal_list, proposal_show, proposal_validate, proposal_approve, proposal_reject)
     - `repository-schemas.ts` (repos_list, repos_deps, repos_detect)
     - `analysis-schemas.ts` (analyze, show_entity)
     - `common-schemas.ts` (shared error types, pagination, common inputs)

3. **Implement function registry**
   - Create `src/integration/function-registry.ts` module
   - Define interface for all Zeno operations
   - Implement handlers that delegate to existing managers
   - Add error wrapper for consistent error responses

4. **Create MCP tool handlers**
   - Implement tool handler for each MCP tool
   - Each handler:
     - Validates input against Zod schema
     - Calls function registry
     - Formats response (success case)
     - Wraps errors in structured format
   - Add logging and diagnostics

5. **Refactor CLI commands**
   - Update CLI handlers to use function registry instead of direct implementation
   - Ensure CLI output formatting still works
   - Test that all CLI commands still function correctly

6. **Implement MCP server lifecycle**
   - Startup: Initialize server, register all tools, start stdio listener
   - Shutdown: Clean up resources gracefully
   - Health checks: Verify database connectivity, file system access
   - Diagnostics: Report tool availability, configuration status

7. **Create VS Code MCP configuration and integration guide**
   - Generate `mcp.json` template with Zeno server configuration
   - Document stdio transport setup for VS Code
   - Provide step-by-step guide for:
     - Adding MCP server to user profile or workspace folder
     - Discovering tools in Chat view tool picker
     - Using MCP tools in chat prompts and custom agents
     - Referencing tools explicitly via `#tool-name`
     - Managing server via Command Palette (`MCP: List Servers`, etc.)
   - Include troubleshooting section (logs, debugging, tool cache reset)
   - Document VS Code requirements (v1.102+ for MCP support)

8. **Add MCP server development mode support**
   - Implement file watching for development (`watch` glob pattern)
   - Support debugger attachment for Node.js MCP server
   - Document VS Code MCP Dev Guide integration
   - Enable developers to test tools locally with auto-restart

9. **Write comprehensive tests**
   - Test input validation (each schema tested with valid/invalid inputs)
   - Test tool invocation (each tool tested with realistic inputs)
   - Test error handling (each error case tested)
   - Test function registry delegation
   - Integration tests for end-to-end tool usage
   - Test coverage: 90% minimum

## Gate Completion Criteria

- [ ] MCP server implementation complete with stdio transport
- [ ] All Zeno functions exposed as MCP tools with Zod schemas
- [ ] Function registry created and all CLI commands delegated to it
- [ ] Error handling implemented with structured error responses
- [ ] MCP server health checks and diagnostics working
- [ ] VS Code integration guide written with mcp.json configuration examples
- [ ] Tools discoverable in VS Code Chat view tool picker
- [ ] Tools can be explicitly referenced via `#tool-name` in chat prompts
- [ ] MCP server works in VS Code agent mode with automatic tool invocation
- [ ] Custom agent integration guide provided for advanced use cases
- [ ] Development mode with file watching and debugging support implemented
- [ ] Command Palette commands work (`MCP: List Servers`, `MCP: Reset Cached Tools`, etc.)
- [ ] All MCP tools have comprehensive documentation for VS Code Chat view
- [ ] Test coverage 90%+ for MCP server module
- [ ] All existing CLI commands still function (backward compatibility verified)
- [ ] VS Code Copilot integration tested and working
- [ ] MCP server configuration compatible with VS Code v1.102+ requirements
- [ ] AGENTS.md updated with MCP tool reference and VS Code usage examples
- [ ] No breaking changes to existing gates or requirements
- [ ] Performance: MCP tool invocation latency <100ms for basic operations

## Files to Create/Modify

**New Files**:
- `src/mcp/server.ts` - MCP server implementation
- `src/mcp/schemas/gate-schemas.ts`
- `src/mcp/schemas/requirement-schemas.ts`
- `src/mcp/schemas/proposal-schemas.ts`
- `src/mcp/schemas/repository-schemas.ts`
- `src/mcp/schemas/analysis-schemas.ts`
- `src/mcp/schemas/common-schemas.ts`
- `src/mcp/tool-handlers.ts` - All tool handler implementations
- `src/mcp/error-handler.ts` - Structured error formatting
- `src/integration/function-registry.ts` - Centralized operation registry
- `src/mcp/diagnostics.ts` - Health checks and diagnostics
- `mcp.json.template` - VS Code MCP server configuration template
- `docs/MCP_VSCODE_INTEGRATION.md` - VS Code Copilot integration guide (Chat view, tool picker, custom agents, Command Palette)
- `docs/MCP_DEVELOPMENT.md` - Development mode setup and debugging guide
- `docs/MCP_PROMPT_WORKFLOWS.md` - Prompt workflow documentation: zeno-apply, zeno-gate, zeno-proposal, zeno-archive patterns and tool usage
- `tests/mcp/server.test.ts`
- `tests/mcp/schemas.test.ts`
- `tests/mcp/tool-handlers.test.ts`
- `tests/integration/function-registry.test.ts`
- `tests/mcp/prompt-workflows.test.ts` - End-to-end tests for all four prompt workflows

**Modified Files**:
- `src/cli/index.ts` - Refactor to use function registry
- `src/cli/commands/*.ts` - Update all command handlers to delegate
- `package.json` - Add MCP SDK dependency, add MCP server entry point
- `zeno/AGENTS.md` - Update with MCP tool reference and prompt workflow capabilities
- `zeno/PROJECT_PRD.md` - Document MCP as primary interface
- `README.md` - Mention MCP server setup and prompt workflows

## Success Metrics

- All Zeno functions accessible via MCP tools with <100ms latency (local execution, VS Code optimized)
- VS Code Chat view discovers and lists all Zeno tools in tool picker
- Tools can be automatically invoked in VS Code agent mode without user interaction
- Tools can be explicitly referenced in chat via `#tool-name` syntax
- CLI backward compatibility maintained (100% of existing commands work)
- Error messages helpful and actionable (LLM can parse and understand, VS Code displays in Chat view)
- Test coverage 90%+ for MCP module
- Documentation clear and complete (VS Code integration setup takes <5 minutes)
- No performance degradation from CLI refactoring
- **Zero external API calls** - All operations are local, no cloud services, works fully offline
- **No telemetry or analytics** - Complete privacy, no data leaves user's machine
- **No network dependencies** - All stdio communication within VS Code process
- **Local data persistence** - All data stored in local SQLite and project files
- **VS Code v1.102+ compatible** - Server configuration works with latest VS Code MCP support
- **Verified local-only** - Security audit confirms no remote execution, no cloud calls
- **Development mode ready** - File watching and debugger support for development

---

## Notes

This gate represents a fundamental shift in how Zeno is accessed. By making MCP the primary interface and relegating CLI to a thin wrapper, we:

1. **Prioritize LLM-native execution** - AI agents work naturally with tools instead of parsing terminal output
2. **Improve reliability** - Type-safe schemas catch errors early, structured responses enable proper error handling
3. **Enable IDE integration** - VS Code discovers tools natively, Cursor (which is VS Code-based) gains native access, reducing context and improving UX
4. **Maintain backward compatibility** - CLI still works, enabling human operators and CI/CD pipelines to continue using Zeno
5. **Future-proof** - Subagent orchestration (Gate 13) leverages MCP tools for parallel execution

The MCP server becomes the operational backbone of Zeno's execution model, deeply integrated with VS Code's native MCP support.

### VS Code MCP Configuration Example

```json
{
  "servers": {
    "zenoPlanner": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/dist/mcp/server.js"],
      "env": {
        "ZENO_PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

This configuration:
- Uses camelCase naming convention (`zenoPlanner`)
- Specifies stdio transport for local communication
- References workspace-local Zeno MCP server executable
- Passes workspace folder as environment variable for project context
- Works in user profile or workspace-level `mcp.json`

### VS Code Tool Usage Pattern

```
User in VS Code Chat:
  "Show me the gate roadmap"
  
VS Code Copilot:
  → Invokes `req_list` MCP tool via stdio
  → Zeno process responds with requirements
  → Copilot formats response in Chat view
  
User:
  → Sees Zeno data in Chat
  → Can reference specific tools: "#zenoPlanner.gates_show"
  → Can create custom agents that use Zeno tools
```

---

**Gate Status**: pending  
**Last Updated**: 2026-01-31  
**Owner**: Zeno's Planner Development Team
