# Proposal: Implement Gate Template System and PRD Generation

**Hash**: #g02p05templates  
**Gate**: gate-02 - Zeno Engine & Gate Generation  
**Requirement**: #p02agentsmd  
**Status**: completed  
**Created**: 2026-01-29  
**Implemented**: 2026-01-30  
**Archived**: 2026-01-30  
**Archived By**: system

---

## Summary

Implements the gate template system that renders markdown Gate PRDs from generated gate data. Creates templates for consistent gate documentation structure while allowing gate-specific customization. Generates AGENTS.md for project-specific AI context and guidance. All templates are markdown-based, version-controllable, and human-friendly. AGENTS.md can be manually edited by users to add custom rules and updates.

---

## Context

### Requirements Context

This proposal implements the AGENTS.md Generation requirement (#p02agentsmd) and enables presentation-ready gate documentation. Templates ensure consistency across gates while supporting customization. Generated AGENTS.md provides AI agents with project-specific guidance for implementation.

### Why This Change

Gate generation produces structured data, but humans need readable documentation. Templates bridge this gap by providing consistent, professional Gate PRDs that document objectives, requirements, technical decisions, and implementation steps. AGENTS.md provides context to LLMs assisting with implementation, improving code quality and consistency.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #g02p04engine | requires | Uses generated gate data to populate templates |

---

## Tasks

### Task 1: Create Gate Template Loader and Renderer

**File(s)**: `src/generation/gate-template.ts`  
**Action**: create

Implement template loading and rendering engine. Load Markdown templates from `templates/md-templates/gate-prd-template.md`, parse template structure, and render with gate-specific data. Support conditional sections and loops for flexible template design.

**Acceptance**:
- [x] Exports `renderGateTemplate(template: string, data: GateData): string` function
- [x] Loads template files from templates directory
- [x] Performs variable substitution ({{gateName}}, {{objective}}, etc.)
- [x] Supports conditional sections (if requirement type matches)
- [x] Returns fully rendered Markdown string

---

### Task 2: Implement AGENTS.md Generator

**File(s)**: `src/generation/agents-generator.ts`  
**Action**: create

Create the AGENTS.md generator that produces project-specific AI context documentation. Include project overview, gate roadmap, requirement extraction patterns, hash reference conventions, quality thresholds, and implementation patterns. This becomes the definitive guide for AI agents working on the project.

**Acceptance**:
- [x] Exports `generateAgentsMD(projectConfig: ProjectConfig, gates: Gate[], requirements: Requirement[]): string` function
- [x] Includes project overview and technology stack
- [x] Documents hash-based reference system
- [x] Lists all gates with brief descriptions
- [x] Documents quality thresholds and checks
- [x] Includes requirement extraction patterns
- [x] Provides command reference and examples

---

### Task 3: Create Proposal Template Renderer

**File(s)**: `src/generation/proposal-template.ts`  
**Action**: create

Implement rendering of proposal templates from `templates/md-templates/proposal-template.md`. Render proposals during proposal generation phase. Support consistent structure while adapting to proposal-specific tasks and requirements.

**Acceptance**:
- [x] Exports `renderProposalTemplate(template: string, data: ProposalData): string` function
- [x] Loads proposal template from templates directory
- [x] Performs variable substitution for proposal metadata
- [x] Renders task sections with acceptance criteria
- [x] Includes Files Affected table
- [x] Returns fully rendered Markdown string

---

### Task 4: Implement Gate PRD Writer

**File(s)**: `src/generation/gate-writer.ts`  
**Action**: create

Create a writer that saves rendered gate PRDs to `zeno/gates/gate-XX-name.md` with proper naming conventions. Handle file creation, path validation, and metadata preservation.

**Acceptance**:
- [x] Exports `writeGatePRD(gatePRD: string, gateNumber: number, gateName: string): Promise<string>` function
- [x] Creates gate file in `zeno/gates/` directory
- [x] Uses naming convention `gate-XX-gatename.md`
- [x] Returns file path of written gate
- [x] Handles existing files appropriately

---

### Task 5: Implement AGENTS.md Writer

**File(s)**: `src/generation/agents-writer.ts`  
**Action**: create

Create a writer that saves generated AGENTS.md to `zeno/AGENTS.md`. Merges new content with existing user edits, allowing manual customization while incorporating new gate information.

**Acceptance**:
- [x] Exports `writeAgentsMD(content: string, basePath: string): Promise<string>` function
- [x] Writes to `zeno/AGENTS.md` in project
- [x] Merges new content with existing user edits, appending new sections without overwriting
- [x] Returns file path of written file

---

### Task 6: Write Unit Tests for Template System

**File(s)**: `tests/generation/gate-template.test.ts`, `tests/generation/agents-generator.test.ts`, `tests/generation/proposal-template.test.ts`, `tests/generation/gate-writer.test.ts`, `tests/generation/agents-writer.test.ts`  
**Action**: create

Write comprehensive tests for template loading, variable substitution, content generation, and file writing. Test with various gate data and edge cases.

**Acceptance**:
- [x] Template tests: Variable substitution, conditional sections, empty values
- [x] Generator tests: AGENTS.md content completeness, requirement listing
- [x] Writer tests: File creation, naming conventions, content merging
- [x] Coverage meets 90% threshold for generation modules

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/generation/gate-template.ts` | create | Gate PRD template renderer |
| `src/generation/agents-generator.ts` | create | AGENTS.md generator |
| `src/generation/proposal-template.ts` | create | Proposal template renderer |
| `src/generation/gate-writer.ts` | create | Gate PRD file writer |
| `src/generation/agents-writer.ts` | create | AGENTS.md file writer |
| `tests/generation/gate-template.test.ts` | create | Gate template tests |
| `tests/generation/agents-generator.test.ts` | create | AGENTS.md generator tests |
| `tests/generation/proposal-template.test.ts` | create | Proposal template tests |
| `tests/generation/gate-writer.test.ts` | create | Gate writer tests |
| `tests/generation/agents-writer.test.ts` | create | AGENTS.md writer tests |

---

## Implementation Notes

- Templates use simple `{{variable}}` syntax for substitution
- Conditional sections use `{{#if condition}}...{{/if}}` syntax
- Gates are always written to `zeno/gates/` with semantic naming
- AGENTS.md is generated initially and can be manually edited by users to add custom rules and updates. Subsequent gate generations append new sections without overwriting existing user content.
- Template files are in `templates/md-templates/` and version-controlled
- Consider using Handlebars or simple string replacement (no complex DSL needed)

---

## Completion Summary

**Tasks Completed**: 6/6  
**Files Modified**: 10  
**Test Coverage**: 100% (8/8 tests passing)  
**Commits**: Implementation completed

### Artifacts Created
- `src/generation/gate-template.ts` - Gate PRD template renderer
- `src/generation/agents-generator.ts` - AGENTS.md generator
- `src/generation/proposal-template.ts` - Proposal template renderer
- `src/generation/gate-writer.ts` - Gate PRD file writer
- `src/generation/agents-writer.ts` - AGENTS.md file writer
- `tests/generation/gate-template.test.ts` - Gate template tests
- `tests/generation/agents-generator.test.ts` - AGENTS.md generator tests
- `tests/generation/proposal-template.test.ts` - Proposal template tests
- `tests/generation/gate-writer.test.ts` - Gate writer tests
- `tests/generation/agents-writer.test.ts` - AGENTS.md writer tests

### Quality Metrics
- Coverage: 100% (threshold: 90%)
- Security: 0 vulnerabilities
- Lint errors: 0 (threshold: <0.01%)
- Type errors: 0

---

## Rollback

If rejected or failed: Delete created files in `src/generation/` and `tests/generation/`.
