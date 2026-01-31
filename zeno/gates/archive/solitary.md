# Solitary Proposals Archive

Consolidated registry of completed solitary (cross-cutting) proposals. Each entry documents high-level implementation outcomes without cluttering active proposal directories.

---

## Infrastructure & Tooling

### Template Loader Infrastructure (#s20260131loader)
**Completed**: 2026-01-31

Created shared template loading infrastructure enabling LLMs to dynamically access Zeno templates during workflow execution. Implemented template registry module with `loadTemplate()`, `loadAllTemplates()`, and `getTemplatesByCategory()` functions, fully integrated into function-registry. All 14 templates (4 markdown + 10 architecture diagrams) catalogued with metadata and accessible via LLM function calls. Removed hardcoded template paths from prompts in favor of dynamic function invocation.

---
