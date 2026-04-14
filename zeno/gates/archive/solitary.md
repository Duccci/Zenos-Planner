# Solitary Proposals Archive

Consolidated registry of completed solitary (cross-cutting) proposals. Each entry documents high-level implementation outcomes without cluttering active proposal directories.

**Note**: Solitary proposals consolidate into this single registry file (not moved to archive directory). No requirement status tracking occurs for solitary proposals.

---

## Infrastructure & Tooling

### Template Loader Infrastructure (#s20260131loader)

**Completed**: 2026-01-31

Created shared template loading infrastructure enabling LLMs to dynamically access Zeno templates during workflow execution. Implemented template registry module with `loadTemplate()`, `loadAllTemplates()`, and `getTemplatesByCategory()` functions, fully integrated into function-registry. All 14 templates (4 markdown + 10 architecture diagrams) catalogued with metadata and accessible via LLM function calls. Removed hardcoded template paths from prompts in favor of dynamic function invocation.

### Template CLI Commands (#s20260131templates)

**Completed**: 2026-01-31

Implemented three CLI commands for template access: `zeno template list` (with table/json/list formats), `zeno template get` (with raw flag and flexible name resolution), and `zeno template context` (with metadata and compact flags for LLM context injection). Built on template-registry infrastructure to provide users and LLMs programmatic access to all available templates. Includes flexible template name resolution supporting both full names and shorthand notation. All commands include comprehensive error handling and validation. 11/11 tests passing.

### Unified Artifact Discovery Service (#s20260206disco)

**Completed**: 2026-02-06

High-level implementation: Implemented unified artifact discovery service replacing hardcoded template registry with dynamic filesystem scanning. Created single interface for discovering templates, agents, gates, and proposals with no external dependencies. All existing CLI and MCP functionality seamlessly integrated with new discovery system. 21 new tests added, all passing with 100% coverage for new code.

### MCP Implementation Cleanup & Refactoring (#s20260201mcp)

**Completed**: 2026-02-06

High-level implementation: Comprehensive refactoring and cleanup of Zeno's MCP server implementation, reducing monolithic files from 2,754 lines to 1,430 lines, eliminating 40% code duplication, and improving user experience with simplified setup, VSCode resources, and enhanced error handling.

### MCP Implementation - Critical Tools & Guardrails (#s20260204tool)

**Completed**: 2026-02-04

High-level implementation: Successfully implemented critical MCP tools and guardrail validators, achieving 100% CLI command coverage via MCP and filling workflow gaps from 60% to 95%. Created 19 new files including schemas, validators, and tool implementations with comprehensive testing and documentation. All quality thresholds met.

### Implement Generic Entity Action Handler (#s20260211handler)

**Completed**: 2026-02-11

High-level implementation: Created a generic EntityActionHandler factory that standardizes action dispatch for MCP tools, reducing code duplication from 300+ LOC to reusable pattern. Refactored gates and proposal handlers to use the new factory, establishing foundation for consistent tool behavior across all entity types.

### Project Action MCP Tool (#s26022204proj-act)

**Completed**: 2026-02-22

Exposed `project_action: init` and `project_action: status` as unified MCP tools by extracting business logic from CLI commands into registry-backed implementations. Created Zod schemas for discriminated union input/output, implemented handler using `createEntityActionHandler` pattern, refactored CLI commands to delegate via registry invocation, ensuring single source of truth. All 4 tasks completed: schemas validated, handler factory implemented, CLI refactored with no logic duplication, 20/20 tests passing. Architecture now complete: MCP → Handler → Registry Function → Business Logic → CLI Command.

### MCP Tools Reference Documentation (#s26022202mcp-ref)

**Completed**: 2026-02-22

Consolidated and replaced `docs/MCP-TOOLS-REVIEW.md` with a single authoritative `docs/MCP-TOOLS.md` covering every MCP tool action: input schema, validators executed, preconditions, output schema, error codes, and example request/response for all six tools (gates_action, proposal_action, reg_action, repos_action, archive_action, config_get) and 27 actions. Added CI verification script that prevents new tool actions from shipping without documentation. 100% documentation coverage achieved, 19 tests passing, all quality thresholds met.

### Guardrail CI Drift Check (#s26022203ci-drift)

**Completed**: 2026-02-22

Implemented automatic CI check detecting drift between skill guardrails and MCP validators. Created guardrail allowlist with narrative-only rationale, script that extracts guardrails, matches against validators, and reports coverage with human-readable table. Integrated script into CI pipeline with fail-fast reporting of unmatched guardrails. All 3 tasks completed: allowlist created, validation script implemented, CI integration verified. Prevents future skill guardrails from drifting out of sync with system validators.

### Guardrail Enhancements - Proposal/Gate Review (#s26022205gard-rev)

**Completed**: 2026-02-22

Enhanced guardrails to mandate review of proposals before application and gates before proposal generation. Added Pre-Apply Review guardrails (4 checks: open questions, file verification, assumptions, dependencies) to zeno-apply skill and Pre-Generation Gate Review guardrails (4 checks: clarity, acceptance criteria, assumptions, blockers) to zeno-proposal skill. Updated guardrail allowlist with 8 narrative-only entries explaining why review steps require human judgment. Updated workflow documentation (AGENTS.md) with Pre-Action Review checklist. All 4 tasks completed, guardrail validation tests pass.

## Security & Safety

### Extract MCP Handler Utilities (#s20260210extract)

**Completed**: 2026-02-10

High-level implementation: Extracted and centralized duplicated MCP handler utilities into `src/mcp/tools/handler-factory.ts` (`extractMockResult`, `handleMockResult`, `runValidators`, `formatValidationError`, `handleError`, `createNotImplementedHandler`). Updated multiple handler modules to use the centralized utilities, removed duplicate code (~174 LOC net reduction), and added unit & integration tests.

### Create Unified Entity Action Tools (#s20260212unify)

**Completed**: 2026-02-12

High-level implementation: Introduced unified `reg_action` and `archive_action` tools consolidating individual requirement and archive handlers into single action-based tools. Deleted all redundant individual handlers (`req_list`, `req_show`, `req_deps`, `req_transfer`, `archive_gate`, `archive_proposal`, `archive_batch`) and their tool definitions. Eliminated ~150 LOC of dead code while maintaining zero change to MCP API. All existing tests pass without modification.

### Centralize MCP Schema Registry (#s20260212registry)

**Completed**: 2026-02-12

High-level implementation: Created centralized `schemas/registry.ts` as single source of truth for tool metadata, replacing manual tool definition array concatenation in `tools/index.ts`. Registry contains entries for gates, proposals, requirements, archives, and config with action metadata and schemas. Tool registration now driven programmatically by registry, improving maintainability and enabling future schema queries. No change to MCP behavior or API.

### MCP Tools Testing & Documentation (#s20260212testing)

**Completed**: 2026-02-12

High-level implementation: Comprehensive testing and documentation for MCP tools consolidation. Added 50+ unit tests and 20+ integration tests achieving >90% code coverage for new handler utilities and entity action pattern. Created developer guide documenting entity action pattern, tool creation process, and registry structure. Updated MCP documentation with unified tools and examples. All 100+ tests passing with zero TypeScript errors.

### MCP Implementation - Error Handling, Git Safety, Solitary Archival (#s20260206safety)

**Completed**: 2026-02-06

High-level implementation: Implemented comprehensive safety features for MCP tools including unified error response format with 12 standardized error codes, git operation audit and blocking during apply phase, and completed solitary proposal archival workflow. All 59 safety tests pass with 95%+ coverage, ensuring production-ready error handling and preventing critical guardrail violations.

### Codebase Deduplication & Consolidation (#d26021701)

**Completed**: 2026-02-21

Eliminated 15+ instances of duplicated logic across CLI, core, integration, MCP, and generation layers by extracting six shared utilities: `normalizeGateId`/`normalizeHash` (normalize.ts), `ValidationResult` interface (mcp/validators/types.ts), `listArchivedGates` (gate-consolidation.ts), `walkDir`/`walkDirSync` (file.ts), and `parseProposalMetadata` (proposal-parser.ts). All 13 consumers updated to import from canonical locations. 1,818 tests passing, 100% coverage on new utilities, 0 TypeScript errors.

### Unified Artifact Validator (#a4f7b2e9)

**Completed**: 2026-02-17

Implemented a unified artifact validator (MCP tool `artifact_validate`) with a lightweight ArtifactValidationService and MCP handler. Performs format/structure checks across gates, proposals, and architecture diagrams (section headers, status fields, diagram content detection). Quality and dependency validation are handled by dedicated validators (`quality-validator`, `dependency-validator`). Added initial test stubs and type-check fixes.

### Multi-Language Support via Tree-sitter (#b5553461)

**Completed**: 2026-03-17

Extended Zeno's static analysis engine to support non-JS/TS languages (Python, Rust, Go, C/C++) via an optional tree-sitter backend. Added `LanguageBackend` and `TreeSitterParseResult` types, created `tree-sitter-parser.ts` for lazy grammar loading, created `tree-sitter-metrics.ts` for CST-based LOC and branch-node complexity, and integrated both into `CodeAnalyzer` alongside the existing Babel path. Added 21 new tests (8 parser, 13 metrics) plus 2 integration tests, fixture files for all four target languages, and a README section. Addresses risk O-05 (multi-language analysis gap). 2,926 total tests passing, 0 TypeScript errors.

### zeno doctor: Local Setup Diagnostics Command (#71586e28)

**Completed**: 2026-03-17

Implemented `zeno doctor` CLI command that audits the local environment for all prerequisites required by Zeno's Planner — Node.js version (≥24 required, ≥20 warn), Git version (≥2.0), Graphviz `dot` binary, and better-sqlite3 native binding. Command renders a colored table (Check / Status / Detail / Fix columns) and supports a `--json` flag for scripting and CI use; exits 1 when any check fails. All checks use `spawnSync` with a 3s timeout. Addresses R-02 (Graphviz silent failure), R-03 (better-sqlite3 native compilation), and R-10 (single-developer setup friction). 25 unit tests and 5 integration smoke tests, all passing.

### Multi-Language Support via Tree-sitter (O-05) (#b5553461)

**Completed**: 2026-03-18

Introduces Tree-sitter as an optional second parser backend in the code-analysis pipeline. The Babel parser continues to own TypeScript/JavaScript; Tree-sitter handles Python, Rust, Go, and C++ by producing normalized LOC, dependency, and complexity metrics through a shared analyzer interface. The feature is opt-in (controlled by an AnalysisOptions flag) and carries no breaking changes to existing consumers.

### Unified Workspace Configuration: Standalone, Submodule, and Multi-Root Workspace Modes (#9fe231d8)

**Completed**: 2026-04-13

Consolidates and extends Zeno's project mounting and MCP wiring to support three clean deployment modes:

1. **Standalone** — Zeno IS the project (`zenoDir: '.'`); binary at `./bin/mcp-server.js`
2. **Submodule** — Zeno mounted at `zeno/` inside a consumer project; binary at `./zeno/bin/mcp-server.js`
3. **VS Code multi-root workspace** — Zeno lives in a separate workspace folder or as a submodule inside each folder; MCP config in `.code-workspace` file with per-project server keys

The current implementation hardcodes the MCP server key to `'zeno-planner'` and only writes `.vscode/mcp.json`. This breaks when multiple Zeno-managed projects share a VS Code workspace — the second `mcp install` silently overwrites the first project's entry. This proposal introduces per-project server naming (`zeno-<slug>`), read-merge-write support for `.code-workspace` files, and a unified `zeno mcp install` that auto-detects the mode and generates the correct config.
