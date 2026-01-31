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

---
