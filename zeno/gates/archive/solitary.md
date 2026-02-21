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

## Security & Safety

### Extract MCP Handler Utilities (#s20260210extract)

**Completed**: 2026-02-10

High-level implementation: Extracted and centralized duplicated MCP handler utilities into `src/mcp/tools/handler-factory.ts` (`extractMockResult`, `handleMockResult`, `runValidators`, `formatValidationError`, `handleError`, `createNotImplementedHandler`). Updated multiple handler modules to use the centralized utilities, removed duplicate code (~174 LOC net reduction), and added unit & integration tests.

### Create Unified Entity Action Tools (#s20260212unify)

**Completed**: 2026-02-12

High-level implementation: Introduced unified `req_action` and `archive_action` tools consolidating individual requirement and archive handlers into single action-based tools. Deleted all redundant individual handlers (`req_list`, `req_show`, `req_deps`, `req_transfer`, `archive_gate`, `archive_proposal`, `archive_batch`) and their tool definitions. Eliminated ~150 LOC of dead code while maintaining zero change to MCP API. All existing tests pass without modification.

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
