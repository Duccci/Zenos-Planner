# Consolidate SKILL.md Guidance into Core Zeno Documentation

## Metadata

- **Hash**: s20260224skill01
- **Type**: Solitary
- **Status**: pending
- **Created**: 2026-02-24
- **Summary**: Extract guardrail and workflow guidance from IDE-specific SKILL.md files into TypeScript constants in `src/mcp/content/`, push them contextually via MCP tool responses, and remove IDE-specific `.claude/skills/` dependencies to make Zeno environment-agnostic.

## Context

The SKILL.md files in `.claude/skills/` contain critical workflow guidance (pre-apply/pre-generation checklists, step-by-step procedures, function references) that is currently tied to Claude/VS Code. Any agent using a different development tool (Cursor, Windsurf, plain MCP client) receives no workflow guidance.

**Current State**:
- Guardrails already partially documented in `src/mcp/allowlists/guardrail-allowlist.ts` (allowlist for CI drift checking)
- MCP validators enforce all rule-based guardrails (apply-phase-validator, scope-validator, quality-validator, entity-action-handler)
- Workflow guidance lives only in SKILL.md files — IDE-dependent, not accessible via MCP
- `scripts/validate-guardrail-coverage.ts` scans `.claude/skills/**/*.md` — will silently vacuously pass after deletion

**Problem**: Workflow guidance is IDE-dependent. Agents using any tool other than Claude+VS Code receive no pre-apply/pre-generation checklists, step guidance, or function references.

**Solution**:
1. Create TypeScript constants in `src/mcp/content/` as the single authoritative source of truth (ASOT) for all guardrails and workflow steps — mirroring the `guardrail-allowlist.ts` pattern
2. Wire MCP tool handlers to push applicable guardrail and workflow content contextually in their structured responses (no separate query tool — content is injected, not queried)
3. Convert `scripts/validate-guardrail-coverage.ts` into `tests/mcp/guardrail-coverage.test.ts` — a Vitest test that imports constants and asserts validator linkage, running as part of the normal test suite
4. Update AGENTS.md (zeno/), root AGENTS.md, and `templates/md-templates/agents-template.md` to remove skill file references and describe MCP contextual injection
5. Delete `.claude/skills/` SKILL.md files after all injection is verified

## Tasks

### Task 1: Create Guardrail Constants
Create `src/mcp/content/guardrails.ts` with all guardrail content from all four SKILL.md files as typed TypeScript constants

**Acceptance Criteria**:
- [ ] `GuardrailEntry` interface defined with fields: `id`, `topic`, `rule`, `mustHaveValidator`, `validatorRef` (optional), `reason`
- [ ] `APPLY_PHASE_GUARDRAILS` constant exported — all Pre-Apply Review items and Implementation Constraints from `zeno-apply/SKILL.md`
- [ ] `PROPOSAL_GENERATION_GUARDRAILS` constant exported — all Pre-Generation Gate Review items and Proposal Generation Constraints from `zeno-proposal/SKILL.md`
- [ ] `ARCHIVAL_GUARDRAILS` constant exported — all guardrails from `zeno-archive/SKILL.md`
- [ ] `GATE_GENERATION_GUARDRAILS` constant exported — all guardrails from `zeno-gate/SKILL.md`
- [ ] `ALL_GUARDRAILS` barrel constant exported (all four arrays combined)
- [ ] Every entry with `mustHaveValidator: true` references an existing validator file (e.g., `apply-phase-validator.ts#validateApplyPhase`)
- [ ] `tests/mcp/guardrail-coverage.test.ts` passes against this file

**Interface**:
```typescript
export interface GuardrailEntry {
  id: string
  topic: 'apply-phase' | 'proposal-generation' | 'archival' | 'gate-generation'
  rule: string
  mustHaveValidator: boolean
  validatorRef?: string   // e.g. 'apply-phase-validator.ts#validateApplyPhase'
  reason: string          // why it is/isn't validator-enforced
}
```

### Task 2: Create Workflow Step Constants
Create `src/mcp/content/workflows.ts` with all workflow step content from all four SKILL.md files as typed TypeScript constants

**Acceptance Criteria**:
- [ ] `WorkflowStep` interface defined with fields: `order`, `title`, `description`, `prerequisites`, `actions`, `errorHandling`, `guidance`
- [ ] `APPLY_PHASE_WORKFLOW` constant exported — all 9 steps from `zeno-apply/SKILL.md` (Identify → Run Checks → Request Approval)
- [ ] `PROPOSAL_GENERATION_WORKFLOW` constant exported — all 11 steps from `zeno-proposal/SKILL.md`
- [ ] `GATE_GENERATION_WORKFLOW` constant exported — all 11 steps from `zeno-gate/SKILL.md`
- [ ] `ARCHIVAL_WORKFLOW` constant exported — gate and proposal archival steps from `zeno-archive/SKILL.md`
- [ ] `src/mcp/content/index.ts` created as barrel export for all content constants
- [ ] No step guidance is lost relative to original SKILL.md files

**Interface**:
```typescript
export interface WorkflowStep {
  order: number
  title: string
  description: string
  prerequisites: string[]
  actions: { tool: string; action: string }[]
  errorHandling: string
  guidance: string          // verbatim instruction text from SKILL.md
}
```

### Task 3: Wire MCP Contextual Injection
Update MCP action tool handlers to inject applicable guardrails and workflow steps into their structured responses so any agent receives guidance regardless of IDE

**Acceptance Criteria**:
- [ ] `src/mcp/tools/proposal-tools.ts`: `proposal_action` responses for `create`, `generate`, and `start` include `PROPOSAL_GENERATION_GUARDRAILS` + `PROPOSAL_GENERATION_WORKFLOW` in a `guidance` field
- [ ] `src/mcp/tools/proposal-tools.ts`: `proposal_action` response for `start` includes `APPLY_PHASE_GUARDRAILS` + `APPLY_PHASE_WORKFLOW` in `guidance`
- [ ] `src/mcp/tools/gate-tools.ts`: `gates_action` responses for `create` and `generate` include `GATE_GENERATION_GUARDRAILS` + `GATE_GENERATION_WORKFLOW` in `guidance`
- [ ] `src/mcp/tools/archive-tools.ts`: `archive_action` responses include `ARCHIVAL_GUARDRAILS` + `ARCHIVAL_WORKFLOW` in `guidance`
- [ ] `guidance` field is included in each tool's existing Zod output schema as optional (does not break existing schema validation)
- [ ] Existing handler tests still pass after schema additions

**Injection Pattern**:
```typescript
// In proposal_action handler for 'start':
return {
  success: true,
  data: { ...proposalData },
  guidance: {
    guardrails: APPLY_PHASE_GUARDRAILS,
    workflow: APPLY_PHASE_WORKFLOW,
  }
}
```

### Task 4: Convert Guardrail Coverage Script to Vitest Test
Replace `scripts/validate-guardrail-coverage.ts` (scans `.claude/skills/**/*.md`) with `tests/mcp/guardrail-coverage.test.ts` (imports TypeScript constants and asserts validator linkage)

**Acceptance Criteria**:
- [ ] `tests/mcp/guardrail-coverage.test.ts` created
- [ ] Test imports `ALL_GUARDRAILS` from `src/mcp/content/guardrails.ts`
- [ ] Test asserts every entry where `mustHaveValidator: true` has a non-empty `validatorRef`
- [ ] Test asserts `validatorRef` strings reference files that exist in `src/mcp/validators/`
- [ ] Test asserts no duplicate `id` values across all guardrails
- [ ] `scripts/validate-guardrail-coverage.ts` deleted
- [ ] `package.json` scripts section updated: remove any `validate-guardrail-coverage` script entry if present

### Task 5: Update Documentation and Templates
Remove all `.claude/skills/` references from AGENTS files and agents template; add MCP injection guidance

**Acceptance Criteria**:
- [ ] `zeno/AGENTS.md` Quick Navigation table updated: replace skill file rows with "Guardrails and Workflows are injected by MCP tool responses; source of truth: `src/mcp/content/`"
- [ ] `zeno/AGENTS.md` removes any `<skills>` block or `.claude/skills/` path references
- [ ] Root `AGENTS.md` Skills section updated to describe MCP contextual injection pattern instead of SKILL.md files
- [ ] `templates/md-templates/agents-template.md` updated: remove skills block, add note that guardrail/workflow guidance is provided via MCP tool responses (no IDE-specific skill files required)
- [ ] All three files consistently describe the new pattern: "MCP tool responses include applicable guardrails and workflow steps in a `guidance` field"

### Task 6: Delete SKILL.md Files
Delete all four SKILL.md files after verifying Tasks 1–5 are complete and injection is confirmed working

**Acceptance Criteria**:
- [ ] `tests/mcp/guardrail-coverage.test.ts` passes (Task 4 complete)
- [ ] All tool handler tests pass with `guidance` field additions (Task 3 complete)
- [ ] `.claude/skills/zeno-apply/SKILL.md` deleted
- [ ] `.claude/skills/zeno-proposal/SKILL.md` deleted
- [ ] `.claude/skills/zeno-archive/SKILL.md` deleted
- [ ] `.claude/skills/zeno-gate/SKILL.md` deleted
- [ ] `.claude/skills/` directory removed if empty after deletions
- [ ] Full test suite passes after deletions

## Dependencies

- None (solitary proposal)

## Files Affected

**New Files**:
- `src/mcp/content/guardrails.ts` (ASOT — all guardrail constants)
- `src/mcp/content/workflows.ts` (ASOT — all workflow step constants)
- `src/mcp/content/index.ts` (barrel export)
- `tests/mcp/guardrail-coverage.test.ts` (replaces validate-guardrail-coverage.ts)

**Modified Files**:
- `src/mcp/tools/proposal-tools.ts` (inject guidance in proposal_action responses)
- `src/mcp/tools/gate-tools.ts` (inject guidance in gates_action responses)
- `src/mcp/tools/archive-tools.ts` (inject guidance in archive_action responses)
- `zeno/AGENTS.md` (remove skill references, add MCP injection guidance)
- `AGENTS.md` (update Skills section to describe MCP injection pattern)
- `templates/md-templates/agents-template.md` (remove skills block, add MCP injection note)

**Deleted Files**:
- `scripts/validate-guardrail-coverage.ts`
- `.claude/skills/zeno-apply/SKILL.md`
- `.claude/skills/zeno-proposal/SKILL.md`
- `.claude/skills/zeno-archive/SKILL.md`
- `.claude/skills/zeno-gate/SKILL.md`

## Notes

- **ASOT**: `src/mcp/content/guardrails.ts` and `src/mcp/content/workflows.ts` are the single authoritative sources of truth. No separate markdown extraction files, no index docs in `zeno/`.
- **Injection not query**: Guardrails and workflows are pushed by the MCP server into tool responses contextually — agents receive guidance as part of the action response, not by calling a separate query tool.
- **Existing templates unchanged**: `templates/md-templates/` (proposal template, gate PRD template, etc.) are unaffected. Only the agents template loses its skill file references.
- **CI**: `validate-guardrail-coverage.ts` becomes a Vitest test — guardrail coverage runs on every `npm test` automatically.
- **VS Code user settings**: The `<skills>` block in VS Code user-level settings (outside this repo) will contain dead file references after deletion. This is acceptable — no workspace-level instruction points to those paths after Task 5, so the block becomes inert and can be cleaned up manually.
- **Deletion order**: Task 6 is gated on Tasks 1–5. Do not delete SKILL.md files until all tests pass and all injection is verified.

---

**Ready to implement**: Once approved, use `/zeno-apply s20260224skill01` to begin implementation.
