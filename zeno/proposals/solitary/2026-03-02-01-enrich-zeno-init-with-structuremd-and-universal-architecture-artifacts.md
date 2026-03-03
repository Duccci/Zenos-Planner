# Proposal: {{OBJECTIVE}}

**Hash**: #{{HASH}}
**Gate**: {{GATE_ID}}
**Status**: pending
**Created**: {{DATE}}

---

## Summary

Extends `zeno init` to generate `zeno/architecture/STRUCTURE.md`, `zeno/architecture/TERMINOLOGY.md`, and the five universal architecture diagrams (system-overview, data-flow, gate-lifecycle, gate-roadmap, context-diagram) immediately after scaffolding. CodeAnalyzer scan results are fed as grounded context so generated files reflect the actual codebase rather than placeholders. TERMINOLOGY.md is seeded from the project end-state description and any domain terms surfaced by the code scan, giving agents and contributors a shared vocabulary from day one.

---

## Proposal Type

**RED** | **GREEN** | **Test Refinement**

- **RED**: Test-first phase defining acceptance criteria. Focuses on coverage target (from `config.qualityThresholds.codeCoverage`). No implementation code.
- **GREEN**: Implementation phase following RED tests. Includes guardrails to verify no new tests added.
- **Test Refinement**: Final proposal refining coverage gaps and validating all tests pass.

---

## Coverage & Estimates

> **RED phase only** — Omit this section for GREEN and Test Refinement proposals.

### Target Coverage

- **Coverage Threshold**: [Inherited from config, e.g., 90%]
- **Lines to Cover**: [Estimated count of lines in affected modules]
- **Target Coverage**: (lines × threshold) ÷ 100 = [number] lines must be tested

---

## Context

### Why This Change

Currently `zeno init` creates the directory skeleton, config, database, gates, requirements, and AGENTS.md — but leaves `zeno/architecture/` empty. The five "always-generated" diagrams and STRUCTURE.md only appear later via `zeno arch generate`, which means new projects start without the repo map and universal architecture models that agents and contributors need on day one.

A `project-structure-template.md` and a `terminology-template.md` already exist and CodeAnalyzer can traverse the codebase. The diagram generation system (Gate 05) is complete. The missing pieces are: (1) wiring these capabilities into the init flow to produce a code-grounded STRUCTURE.md via a new `StructureGenerator`, and (2) a new `TerminologyGenerator` that seeds TERMINOLOGY.md by extracting domain nouns from the project's end-state description and inferred acronyms from the scanned source identifiers.

### Dependencies

List only valid hash references. It is acceptable to have no dependencies if this proposal is self-contained or first in a gate.

**Hash Usage Rules**:

- Proposal hashes (#xxxxx) should only appear in: the proposal's own header, the associated gate's proposal table, and dependency tables
- Do not reference proposal hashes in body text, task descriptions, or other sections
- Use descriptive names instead of hashes for readability in all other contexts
- **Performance**: This restriction prevents excessive file searches and context window bloat when LLMs need to find proposal references

| Hash    | Type     | Description                        |
| ------- | -------- | ---------------------------------- |
| #[hash] | requires | [What this proposal depends on]    |
| #[hash] | blocks   | [What this unblocks when complete] |

**Rules**:

- Omit rows for dependency types that do not apply
- Never use placeholder values like "None" or "N/A" as hash references
- If no dependencies exist, replace the entire Dependencies section (header through table) with: `*No dependencies.*`
- The Description column must be self-contained — the apply agent reads only this table, not the dependency files

---

## Tasks

Atomic, LLM-executable tasks. Each task should be completable in a single implementation session.

**RED Phase Tasks** (test-first, defining acceptance criteria):

- Write tests covering happy path and error cases
- Tests should fail before implementation (RED)
- Use fixtures and mocks to isolate units
- No implementation code in RED phase

**GREEN Phase Tasks** (implementation following tests):

- Implement only functions/methods covered by RED tests
- Make RED tests pass (GREEN)
- Do not add new tests beyond what RED defined
- Verify all RED tests pass before marking complete

**GREEN Phase Guardrails** (verification rules):

- [ ] All changes implement only code specified in RED phase tests
- [ ] No new test files created beyond those in RED phase
- [ ] No new test cases added to existing test files
- [ ] All RED tests pass with implementation
- [ ] Coverage meets or exceeds target threshold

<!-- LLM Instructions — File Scoping Rules (not rendered in output):
- Every File(s) entry MUST be an explicit file path (e.g., src/core/archive-logic.ts)
- NEVER use directory globs or wildcards (e.g., src/mcp/tools/*.ts)
- NEVER use directory-only references (e.g., src/mcp/tools/)
- If a refactoring touches many files, list each one explicitly — this is the cost signal that justifies splitting the proposal
- Each task should touch 1-3 files maximum; if more are needed, split into additional tasks

Test Scoping Rules:
- Gate-tied proposals: RED phase creates test proposals as early proposals in the gate; GREEN phase implementation proposals omit new test files; final proposal refines coverage
- Solitary proposals: MUST include test tasks inline. Solitary proposals are self-contained and combine RED and GREEN.
-->

### Task 1: RED: Write acceptance tests for StructureGenerator

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

RED: Write acceptance tests for StructureGenerator

**Acceptance**:

- [ ] Test: generate() returns markdown with populated repo-map tree when CodeAnalyzer results are provided
- [ ] Test: generate() uses project-structure-template.md as base scaffold
- [ ] Test: generate() gracefully handles empty/greenfield codebase (no files analyzed)
- [ ] Test: generate() maps top-level directories to one-line module descriptions seeded from gate objectives
- [ ] Test: generate() emits zeno/ sub-tree with † markers for Zeno-managed files

---

### Task 2: RED: Write integration test asserting STRUCTURE.md and universal diagrams exist after init

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

RED: Write integration test asserting STRUCTURE.md and universal diagrams exist after init

**Acceptance**:

- [ ] After a mocked zeno init run, zeno/architecture/STRUCTURE.md exists
- [ ] After a mocked zeno init run, zeno/architecture/TERMINOLOGY.md exists
- [ ] After a mocked zeno init run, all five universal diagram files exist: system-overview.md, data-flow.md, gate-lifecycle.md, gate-roadmap.md, context-diagram.md
- [ ] STRUCTURE.md contains at least the repo-map section and the Module Index section
- [ ] TERMINOLOGY.md contains at least the header row and one seeded term row derived from the project name or end-state

---

### Task 3: GREEN: Implement StructureGenerator class

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

GREEN: Implement StructureGenerator class

**Acceptance**:

- [ ] Accepts ZenoConfig, Gate[], AnalysisResult | null, and a list of top-level dirs
- [ ] Renders the project-structure-template.md slots: [Project Name], [DATE], [Stack], repo-map tree, Module Index, Entry Points, Naming Conventions
- [ ] When AnalysisResult is provided, infers stack from file extensions (*.ts → TypeScript,*.py → Python, etc.)
- [ ] Derives top-level directory descriptions from existing gate objectives and directory names
- [ ] Marks all zeno/ sub-paths with the † convention from the template
- [ ] Exported as generateStructureMD(config, gates, analysis) returning string

---

### Task 4: GREEN: Integrate CodeAnalyzer scan + StructureGenerator into scaffold flow

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

GREEN: Integrate CodeAnalyzer scan + StructureGenerator into scaffold flow

**Acceptance**:

- [ ] createProjectStructure accepts an optional AnalysisResult parameter
- [ ] When the project root contains source files, CodeAnalyzer.analyzeCodebase() is called to produce AnalysisResult
- [ ] AnalysisResult is passed to generateStructureMD and the output is written to zeno/architecture/STRUCTURE.md
- [ ] The scan is skipped (greenfield path) when no source files are detected, producing a template-with-hints file instead
- [ ] Scanning errors are non-fatal: a placeholder STRUCTURE.md is written and a warning is logged

---

### Task 5: GREEN: Trigger universal architecture diagram generation during init

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

GREEN: Trigger universal architecture diagram generation during init

**Acceptance**:

- [ ] After gates and requirements are generated, generateDiagrams() is called with the five universal diagram types: system-overview, data-flow, gate-lifecycle, gate-roadmap, context-diagram
- [ ] DiagramGenerator receives AnalysisResult (if available) and early gate list so diagrams reflect actual gate count
- [ ] Diagram generation failures are non-fatal: init completes with a logged warning listing which diagrams failed
- [ ] next-steps output in the CLI now includes: '2. Review zeno/architecture/STRUCTURE.md for repo map'

---

### Task 6: GREEN: Surface analysis context to AGENTS.md generator

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

GREEN: Surface analysis context to AGENTS.md generator

**Acceptance**:

- [ ] generateAgentsMD receives an optional AnalysisResult and uses detected stack to fill the Technology Stack section
- [ ] When AnalysisResult.metrics is available, top 5 modules by coupling score are listed in a new 'High-Coupling Modules' hint section
- [ ] Backward-compatible: existing call sites that do not pass AnalysisResult continue to compile

---

### Task 7: RED: Write acceptance tests for TerminologyGenerator

**Phase**: RED
**File(s)**: `tests/generation/terminology-generator.test.ts`
**Action**: create

RED: Write acceptance tests for TerminologyGenerator

**Acceptance**:

- [ ] Test: generateTerminologyMD() returns markdown matching terminology-template.md structure
- [ ] Test: seeded terms include tokens extracted from the project end-state description (e.g. capitalised nouns, camelCase identifiers)
- [ ] Test: when AnalysisResult is provided, SCREAMING_SNAKE and ALLCAPS identifiers from the source are included as candidate acronym rows
- [ ] Test: output is alphabetically sorted
- [ ] Test: gracefully handles empty end-state string — returns template with zero data rows
- [ ] Test: existing entries in an already-present TERMINOLOGY.md are preserved (append-only mode)

---

### Task 8: GREEN: Implement TerminologyGenerator

**Phase**: GREEN
**File(s)**: `src/generation/terminology-generator.ts`
**Action**: create

GREEN: Implement TerminologyGenerator

**Acceptance**:

- [ ] Exported as `generateTerminologyMD(config: ZenoConfig, endState: string, analysis: AnalysisResult | null): string`
- [ ] Renders terminology-template.md with frontmatter `generator: zeno init` and `refresh: zeno arch generate --terminology`
- [ ] Extracts candidate terms from end-state: capitalised nouns ≥ 4 chars, camelCase compound words split into Pascal terms
- [ ] When AnalysisResult is provided, collects SCREAMING_SNAKE constants and ALL_CAPS exports as acronym candidates
- [ ] Deduplicates candidates case-insensitively and sorts alphabetically
- [ ] Produces a `[TERM] | [Definition — inferred from context or left blank for human completion]` row per candidate
- [ ] Backward-compatible: call sites that rely on `generateAgentsMD` are unaffected

---

### Task 9: GREEN: Wire TerminologyGenerator into scaffold flow

**Phase**: GREEN
**File(s)**: `src/scaffold/index.ts`
**Action**: modify

GREEN: Wire TerminologyGenerator into scaffold flow

**Acceptance**:

- [ ] `createProjectStructure` calls `generateTerminologyMD` after writing STRUCTURE.md
- [ ] Output is written to `zeno/architecture/TERMINOLOGY.md`
- [ ] When the file already exists, new candidate terms are appended below existing rows (no overwrite of human-edited entries)
- [ ] Terminology generation failures are non-fatal: init completes with a logged warning
- [ ] next-steps CLI output now includes: '3. See zeno/architecture/TERMINOLOGY.md for domain vocabulary'

---

### Task 10: GREEN: Update project-structure-template to document the zeno/architecture/STRUCTURE.md entry point

**Phase**: GREEN
**File(s)**: `templates/md-templates/project-structure-template.md`
**Action**: modify

GREEN: Update project-structure-template to document the zeno/architecture/STRUCTURE.md entry point

**Acceptance**:

- [ ] Template includes a new 'How to Use' section at the top explaining that STRUCTURE.md is auto-generated by zeno init and should be updated via zeno arch generate --structure after directory changes
- [ ] Template adds a 'Generated By' YAML frontmatter block with 'generator: zeno init' and 'refresh: zeno arch generate --structure'

---

## Files Affected

**Rules**:

- Every entry MUST be a fully-qualified file path — no directories, no globs, no wildcards
- This table is the authoritative scope boundary; the scope validator rejects modifications to unlisted files
- Each file path must match exactly one file in the repository
- RED phase entries: test files only
- GREEN phase entries: implementation files (no new test files)
- Test Refinement entries: refinement and validation of test files only

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `src/generation/structure-generator.ts` | GREEN | create | StructureGenerator implementation |
| `src/generation/agents-writer.ts` | GREEN | modify | Surface AnalysisResult stack + coupling hints to AGENTS.md |
| `src/scaffold/index.ts` | GREEN | modify | Wire CodeAnalyzer, StructureGenerator, TerminologyGenerator into init |
| `src/core/gate-generation.ts` | GREEN | modify | Trigger five universal architecture diagrams during init |
| `src/cli/commands/init.ts` | GREEN | modify | Update next-steps output with STRUCTURE.md and TERMINOLOGY.md entries |
| `templates/md-templates/project-structure-template.md` | GREEN | modify | Add frontmatter and How-to-Use section |
| `tests/generation/structure-generator.test.ts` | RED | create | Acceptance tests for StructureGenerator |
| `tests/generation/terminology-generator.test.ts` | RED | create | Acceptance tests for TerminologyGenerator |
| `tests/integration/init-structure.test.ts` | RED | create | Integration test: STRUCTURE.md, TERMINOLOGY.md, and diagrams exist post-init |
| `src/generation/terminology-generator.ts` | GREEN | create | TerminologyGenerator implementation |

---

## Implementation Notes

[Optional: Technical approach, edge cases to handle, patterns to use. Keep brief - this is guidance, not specification. Omit if straightforward.]

---

## Rollback

**If rejected or failed**: [Brief description of how to revert changes, or "No rollback needed - isolated change"]

---

**Document Version**: [MAJOR.MINOR.PATCH]
**Last Updated**: [YYYY-MM-DD]
**Versioning**: SemVer; bump on any change (minimum: PATCH).
**Owner**: [git.user.name]
**Reviewers**: [git.user.name]

### Change Log

| Version | Date         | Summary         | Author          |
| ------- | ------------ | --------------- | --------------- |
| 1.0.0   | [YYYY-MM-DD] | Initial version | [git.user.name] |
