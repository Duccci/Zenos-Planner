# Solitary Proposals Archive

Consolidated registry of completed solitary (cross-cutting) proposals. Each entry documents high-level implementation outcomes without cluttering active proposal directories.

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

### MCP Implementation - Critical Tools & Guardrails (#m26020402tool)
**Completed**: 2026-02-04

High-level implementation: Successfully implemented critical MCP tools and guardrail validators, achieving 100% CLI command coverage via MCP and filling workflow gaps from 60% to 95%. Created 19 new files including schemas, validators, and tool implementations with comprehensive testing and documentation. All quality thresholds met.
