# Proposal: Add MCP Git Traceability Tool

**Hash**: #g03p08gittrace  
**Gate**: Gate 03 - MCP Server & LLM Tool Integration  
**Status**: pending  
**Created**: 2026-02-01

---

## Summary

This proposal adds an MCP tool for git traceability that parses local Git history and maps commits to Zeno artifacts using configured commit formats and hash references. It provides structured commit data with confidence scoring for archival summaries and automated consolidation during archival flows. The tool enables LLM-driven workflows to gather provenance without brittle heuristics.

---

## Context

### Requirements Context

This proposal implements tasks derived from requirements. Requirements are primarily defined during `zeno init` at project inception and attributed to gates during gate generation. Requirements may be updated or added during rebaseline/rescope operations, but init is the primary source. This proposal breaks down the referenced requirement(s) into individual implementation tasks.

### Why This Change

Provides an auditable link from code changes to Zeno artifacts for traceability, archival summaries, and automated consolidation during archival flows. Enables LLM-driven workflows to gather provenance without brittle heuristics spread across prompts.

### Dependencies

List only valid hash references. It is acceptable to have no dependencies if this proposal is self-contained or first in a gate.

**Hash Usage Rules**:
- Proposal hashes (#xxxxx) should only appear in: the proposal's own header, the associated gate's proposal table, and dependency tables
- Do not reference proposal hashes in body text, task descriptions, or other sections
- Use descriptive names instead of hashes for readability in all other contexts
- **Performance**: This restriction prevents excessive file searches and context window bloat when LLMs need to find proposal references

| Hash | Type | Description |
|------|------|-------------|
| #g03p03server | requires | MCP server implementation |
| #g03p04tools | requires | MCP tool registry |
| #g03p01registry | requires | Function registry integration |

**Rules**:
- Omit rows for dependency types that do not apply
- Never use placeholder values like "None" or "N/A" as hash references
- If no dependencies exist, replace the table with: *No dependencies - self-contained proposal.*

---

## Tasks

Atomic, LLM-executable tasks. Each task should be completable in a single implementation session.

### Task 1: Design Zod schemas for input/output

**File(s)**: `src/mcp/schemas/git-trace-schemas.ts`  
**Action**: create

Design and implement Zod schemas for the git_trace tool input and output, including artifact identifier, date ranges, and structured commit records with confidence scoring.

**Acceptance**:
- [ ] Zod schemas validate input/output correctly
- [ ] Schemas include all required fields for tool behavior
- [ ] TypeScript types generated from schemas

---

### Task 2: Implement parsing helpers in git utils

**File(s)**: `src/utils/git.ts`  
**Action**: modify

Add parseCommitsForHashes() and heuristics functions to parse git log output, extract hashes, and apply confidence scoring for historic commits.

**Acceptance**:
- [ ] Parsing handles commitFormat from config
- [ ] Heuristics for subject/body matching implemented
- [ ] Unit tests cover parsing logic

---

### Task 3: Add MCP tool handler

**File(s)**: `src/mcp/tool-handlers.ts`  
**Action**: modify

Implement tool handler that validates input, calls git helpers, resolves hash references, and returns structured results.

**Acceptance**:
- [ ] Handler integrates with MCP tool registry
- [ ] Input validation using Zod schemas
- [ ] Output includes matchedHashes and confidenceScore

---

### Task 4: Wire into function registry and add CLI wrapper

**File(s)**: `src/integration/function-registry.ts`, `src/cli/commands/trace.ts`  
**Action**: modify, create

Register the function in function-registry and create CLI command that delegates to MCP tool.

**Acceptance**:
- [ ] Function registered in registry
- [ ] CLI command `zeno trace` works
- [ ] Delegates to MCP tool correctly

---

### Task 5: Add comprehensive tests

**File(s)**: `tests/mcp/git-trace.unit.test.ts`, `tests/integration/git-trace.integration.test.ts`  
**Action**: create

Implement unit tests for parsing heuristics and integration tests against sample repositories.

**Acceptance**:
- [ ] Unit tests cover happy path and error cases
- [ ] Integration tests validate matching and scoring
- [ ] Coverage >= 90% for new module

---

### Task 6: Update documentation

**File(s)**: `docs/MCP_PROMPT_WORKFLOWS.md`, `docs/MCP_VSCODE_INTEGRATION.md`  
**Action**: modify

Document usage, examples, and git log patterns using commitFormat.

**Acceptance**:
- [ ] Documentation includes examples
- [ ] References to config commitFormat
- [ ] Docs build passes

---

### Task 7: Add prompt examples

**File(s)**: `.github/prompts/zeno-archive.prompt.md`  
**Action**: modify

Add sample usage of git_trace for consolidation summaries.

**Acceptance**:
- [ ] Prompt examples demonstrate tool usage
- [ ] Integration with archival flow shown

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/mcp/schemas/git-trace-schemas.ts` | create | Zod schemas for tool I/O |
| `src/mcp/tool-handlers.ts` | modify | Add git_trace handler |
| `src/integration/function-registry.ts` | modify | Register git_trace function |
| `src/utils/git.ts` | modify | Add parsing helpers |
| `src/cli/commands/trace.ts` | create | CLI wrapper for tool |
| `docs/MCP_PROMPT_WORKFLOWS.md` | modify | Add usage documentation |
| `docs/MCP_VSCODE_INTEGRATION.md` | modify | Add integration examples |
| `tests/mcp/git-trace.unit.test.ts` | create | Unit tests for parsing |
| `tests/integration/git-trace.integration.test.ts` | create | Integration tests |
| `.github/prompts/zeno-archive.prompt.md` | modify | Add prompt examples |

---

## Implementation Notes

Tool behavior includes input for artifact hash, optional date range/branch/pagination. Output: commit records with commitSha, author, date, subject, body, filesChanged, matchedHashes, inferredArtifacts, confidenceScore, notes. Handles merges, rebases, squashed commits with heuristics. Respects commitFormat from .zeno/config.json. Local-only computation, no telemetry. Mitigations for historic commits, inconsistent formats, performance, platform differences, false positives via confidence scores.

---

## Rollback

If rejected or failed: Remove added files and revert modifications to existing files. No complex rollback needed - isolated changes.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-02-01  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-01 | Initial version | GitHub Copilot |
