# MCP Tool Architecture

## Handler-First Policy
Handler-based tools in `src/mcp/tools/*` take precedence over CLI-backed function implementations.
- Handlers registered via `registerTools()` in `src/mcp/tool-handlers.ts` override function-based tools
- Handler-based tools return validated `structuredContent` via Zod schemas
- Function implementations in `src/integration/function-implementations.ts` are fallback only

## Key Entrypoint
`src/mcp/server.ts` — MCP server entry  
`src/mcp/tool-handlers.ts` — exports `createToolHandler()`, wires handlers + function registry  

## Handler Factory (`src/mcp/tools/handler-factory.ts`)
Core helpers for building handlers:
- `createBasicHandler` — simple handler with no schema validation
- `createSchemaValidatingHandler` — wraps handler with Zod input validation
- `createNotImplementedHandler` — placeholder returning structured "not implemented" response
- `runValidators` — runs an array of `ValidationResult` validators in sequence
- `handleError`, `handleMockResult`, `extractMockResult`, `formatValidationError`, `parseJsonSafe`

## Entity Action Handler (`src/mcp/tools/entity-action-handler.ts`)
`createEntityActionHandler(config: EntityActionConfig)` — generic handler factory that implements the
`list | show | create | update | delete | start | complete` action pattern used by gates, requirements,
proposals (gates_action, req_action, proposal_action tools). Central pattern — understand this before
adding new entity-level MCP tools.

## Tool Files in `src/mcp/tools/`
| File | MCP Tools Provided |
|------|--------------------|
| `gate-tools.ts` | gates_action |
| `requirement-tools.ts` | req_action |
| `proposal-tools.ts` | proposal_action |
| `archive-tools.ts` | archive_action |
| `config-tools.ts` | config_get, config_set |
| `analysis-tools.ts` | analyze_codebase, metrics |
| `architecture-tools.ts` | arch_generate, arch_show |
| `repository-tools.ts` | repository_action |
| `template-tools.ts` | template_list, template_get |
| `validation-tools.ts` | proposal_validate |
| `workflow-tools.ts` | workflow_action |
| `git-trace-tools.ts` | git_trace |
| `entity-action-handler.ts` | (shared handler factory, not a tool itself) |
| `handler-factory.ts` | (shared utilities, not a tool itself) |
| `index.ts` | re-exports all tools |

## Schemas (`src/mcp/schemas/`)
One schema file per tool domain. All use Zod. `index.ts` re-exports all.
`registry.ts` maintains a runtime map of schema name → Zod schema for dynamic lookup.

## Validators (`src/mcp/validators/`)
Pre-execution guard functions used by proposal lifecycle:
- `apply-phase-validator` — validates proposal is in correct state for apply
- `dependency-validator` — checks proposal dependencies are satisfied
- `proposal-phases-validator` — validates phase transitions
- `quality-validator` — enforces 90% coverage / 0 vulns / <0.01% lint thresholds
- `scope-validator` — checks proposal is scoped to current gate

## FunctionRegistry (`src/integration/function-registry.ts`)
`FunctionRegistry` class — registers named functions (`FunctionDefinition`) with typed parameters.  
`functionRegistry` — module-level singleton (exported constant).  
Used by CLI commands and MCP tool-handlers as a unified dispatch layer.  
`createFunctionRegistry()` / `getGlobalRegistry()` — in `function-implementations.ts`.

## Resources (`src/mcp/resources/index.ts`)
Exposes `PROJECT_PRD.md`, proposals, gate PRDs as MCP resources (readable by LLMs via MCP resource protocol).

## Dev Mode (`src/mcp/dev-mode.ts`)
Provides mock responses for tools during development/testing when real implementations are pending.
`createNotImplementedHandler` from handler-factory returns dev-mode stubs.
