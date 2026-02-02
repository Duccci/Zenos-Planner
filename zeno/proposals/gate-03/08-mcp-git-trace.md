# Proposal: Add MCP Git Traceability Tool

**Hash**: #g03p08gittrace  
**Gate**: Gate 03 - MCP Server & LLM Tool Integration  
**Status**: pending

## What Changes
- Add an MCP tool `git_trace` (name tentative: `git_trace` / `parse_git_trace`) that parses local Git history and maps commits to Zeno artifacts (proposals, requirements, gates) using the project's configured `commitFormat` and `#<hash>` references.
- Provide a Zod input/output schema for the tool, integrate it into the MCP tool registry, and expose a CLI wrapper (`zeno trace <hash>` or `zeno trace --since=...`) that delegates to the MCP tool.
- Implement robust parsing/heuristics for historic commits that predate the hash policy (heuristics: subject/body heuristics, file-path matching, coalescing related commits, merge handling).
- Add unit and integration tests, documentation (MCP_PROMPT_WORKFLOWS.md, MCP_VSCODE_INTEGRATION.md), and example usage in prompts and the `zeno-archive` flow (consolidation via git history).

## Why
- Provides an auditable link from code changes to Zeno artifacts for traceability, archival summaries, and automated consolidation during archival flows.
- Enables LLM-driven workflows (archive, apply) to gather provenance (who implemented the work, what files changed, related commits) without brittle heuristics spread across prompts.
- Allows automation to validate completion by verifying commits/tags referencing proposal/gate hashes and by summarizing implementation details.

## Implementation Details
### Tool behavior
- Input: artifact identifier (proposal/requirement/gate hash), optional date range, branch, and pagination parameters.
- Output: list of commit records with fields: `commitSha`, `author`, `date`, `subject`, `body`, `filesChanged`, `matchedHashes` (list), `inferredArtifacts` (list), `confidenceScore` (0-1), `notes` (heuristic metadata).
- Additional features: can return aggregated change summaries (files touched, top authors, timeline), and create a compact narrative for archival summaries.

### Tasks
1. Design Zod schemas for input/output (`src/mcp/schemas/git-trace-schemas.ts`).
2. Implement parsing helpers in `src/utils/git.ts` (add `parseCommitsForHashes()` and heuristics functions with unit tests).
3. Add MCP tool handler in `src/mcp/tool-handlers.ts` that validates input, calls git helpers, resolves `#hash` references via `zeno show <hash>`, and returns structured results.
4. Wire into `src/integration/function-registry.ts` and expose CLI wrapper `zeno trace` in `src/cli/commands/trace.ts` delegating to function registry.
5. Add tests: unit tests for parsing heuristics, integration tests that run against sample repositories (fixtures) to validate matching/confidence scoring, end-to-end tests for archival flow integration.
6. Document usage and examples in `docs/MCP_PROMPT_WORKFLOWS.md` and `docs/MCP_VSCODE_INTEGRATION.md` (include `git log` patterns and examples using `.zeno/config.json` `commitFormat`).
7. Add sample prompt updates in `.github/prompts/zeno-archive.prompt.md` to use `git_trace` for consolidation summaries.

## Files Affected
- `src/mcp/schemas/git-trace-schemas.ts` (new)
- `src/mcp/tool-handlers.ts` (add handler)
- `src/integration/function-registry.ts` (register function)
- `src/utils/git.ts` (parsing helpers)
- `src/cli/commands/trace.ts` (new CLI wrapper)
- `docs/MCP_PROMPT_WORKFLOWS.md` (docs update)
- `docs/MCP_VSCODE_INTEGRATION.md` (docs update)
- `tests/mcp/git-trace.unit.test.ts` (new)
- `tests/integration/git-trace.integration.test.ts` (new)
- `.github/prompts/zeno-archive.prompt.md` (suggested prompt usage)

## Dependencies
- Requires MCP server and tool registry (#g03p03server, #g03p04tools)
- Requires `function-registry` and `git` integration utilities (#g03p01registry, existing git utilities)
- Recommended: cross-reference with archival/commit push behavior changes (`syncWithGit` changes that support `ignorePushFailure`).

## Automated Checks
- [ ] Linting: PASSED
- [ ] Type Check: PASSED
- [ ] Tests: Unit & Integration (coverage >= 90% for new module)
- [ ] Documentation: PASSED (docs build)
- [ ] Human Approval: PENDING

## Acceptance Criteria
- A new MCP tool `git_trace` implemented with Zod schemas; callable via MCP stdio and via CLI wrapper.
- Returns structured commit data and links commits to Zeno artifacts with confidence scoring.
- Handles merges, rebases, and squashed commit cases with documented heuristics and tests demonstrating behavior on sample repos.
- Respect `.zeno/config.json` `commitFormat` for parsing commit subjects to extract commit type/scope and locate artifact hashes when present.
- Does not leak telemetry or external data; all computation is local-only and respects the project's privacy constraints.
- Tests covering edge cases (no hashes, multiple hashes in commit, cross-repo references, long histories).
- Documentation and prompt examples included that show how to use the tool for archival consolidation and artifact tracing.

## Potential Issues & Mitigations
- Commit messages may not include hashes (historic history). Mitigation: fallback heuristics and file-path correlation; mark matches with low confidence and surface them to a human reviewer.
- Inconsistent `commitFormat` usage across history or repositories (subject formats differ). Mitigation: make parser configurable, rely on configurable patterns from `.zeno/config.json`, and provide a fallback mode that uses subject/body regex heuristics.
- Squashed or rebased commits that obfuscate history (single commit containing many changes). Mitigation: use file-path and diff heuristics, and prefer tag-based reconciliation when tags exist (e.g., release/archival tags).
- Multiple artifacts referenced in a single commit (one commit resolves to several hashes). Mitigation: allow `matchedHashes` to be a list and include `confidenceScore` per match.
- Cross-repo references (commit refers to artifact in a different repository). Mitigation: include `repo` field in results and support scanning multiple repos when configured; document multi-repo limitations.
- Performance on large repositories. Mitigation: add pagination, date ranges (`--since`/`--until`), and shallow scanning options; cache parsed metadata when appropriate.
- Platform differences (Windows vs Unix git date formats, encoding). Mitigation: use `git log --pretty=format:` with ISO date format, normalize encodings, and add platform tests.
- False positives in heuristic matching could mislead automated archival flows. Mitigation: surface confidence scores and demand human approval for archival summaries when confidence < threshold.

## Notes / Extensions
- Consider adding `zeno trace --summary #hash` that emits a short 1–3 sentence summary (suitable for `zeno/gates/archive` entries).
- Consider adding `zeno trace --authors` to list contributors for a given artifact for inclusion in release notes.
- This tool can be used by `zeno-archive` and other prompt workflows to generate consolidated completion summaries and to validate completion prior to archival actions.

---

**Key Points**:
- Adds structured, testable MCP tool for git traceability linked to existing commitFormat guidance in config
- Provides clear heuristics and tests to handle historic and edge-case commits
- Improves archival and auditability for LLM-driven workflows

**Recommended next action**: Review proposal, confirm dependencies, and approve to start implementation.
