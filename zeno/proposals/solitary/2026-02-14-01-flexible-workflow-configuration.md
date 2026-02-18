# Proposal: Workflow Mode Configuration

**Hash**: #w26021401  
**Gate**: solitary  
**Status**: completed  
**Created**: 2026-02-14  
**Revised**: 2026-02-17 (open questions resolved)

---

## Summary

Add a `workflowMode` field to the existing Zeno config schema and wire solo-mode auto-approval into the existing `zeno proposal approve` command. In solo mode, approval auto-passes when artifact format validation (per #a4f7b2e9) succeeds. This is a lightweight configuration change — artifact validation, worktree management, and agent orchestration are owned by their respective proposals/gates.

---

## Context

### Why This Change

Zeno currently requires manual `zeno proposal approve` for every proposal, even in solo development where the developer is the only approver. Adding a `workflowMode` config field allows the approve command to auto-approve when artifact format validation (#a4f7b2e9) passes in solo mode, removing unnecessary friction. Quality thresholds (coverage, CVEs, lint rate, type errors) remain separately configurable via the existing `qualityThresholds` config object.

### What This Is NOT

This proposal deliberately excludes:

- **Artifact format validation** — owned by #a4f7b2e9 (Unified Artifact Validator); this proposal depends on it for solo auto-approval gating
- **Quality threshold enforcement** — already configurable via `qualityThresholds` in config; not duplicated here
- **Worktree decision logic** — Gate 10 (Git Integration) owns worktree management
- **Agent orchestration / auto-approve rules** — Gate 13 (Post-MVP) owns this
- **Proposal state machine** — the existing 4 statuses (`pending`, `in_progress`, `completed`, `rejected`) are sufficient; no new states needed
- **Team mode behavior** — deferred until there are actual multi-developer users

### Dependencies

- **#a4f7b2e9** (Unified Artifact Validator): Solo auto-approval gates on artifact format validation passing. If #a4f7b2e9 is not yet implemented, auto-approval skips format validation and approves unconditionally (graceful degradation).

---

## Requirements

### Functional Requirements

#### 1. Config Schema Extension
- Add `workflowMode` field to `ZenoConfigSchema` in `src/utils/config.ts`
- Type: `'solo' | 'team'` (extensible enum; `'agent-orchestrated'` added in Gate 13)
- **No default** — field is required; Zeno rejects configs missing `workflowMode` at load time
- Validated by Zod; invalid values rejected at load time

#### 2. Solo Auto-Approval
- When `workflowMode === 'solo'`, `zeno proposal approve <hash>` skips the interactive confirmation prompt only — all quality gates (coverage ≥90%, 0 CVEs, lint rate <0.01%, 0 TypeScript errors) are still enforced
- If artifact format validation (#a4f7b2e9) is available, auto-approval runs it first; blocks on failure
- If artifact validator is not yet implemented, auto-approval still enforces existing `qualityThresholds` checks (no unconditional approval)
- Existing approval logic preserved for `team` mode (explicit human confirmation required in addition to quality gates)
- Auto-approval records approver as `'solo-auto'` with timestamp; `approveProposal()` in `src/core/completions.ts` must be extended to accept an optional `approver` string written to the DB and proposal file metadata

#### 3. Config CLI Update
- Add `zeno config set <key> <value>` subcommand to `src/cli/commands/config.ts`
- Validates value against schema before writing
- Supports dot-path keys (e.g., `workflowMode`, `git.autoCommit`)

### Non-Functional Requirements

- **Backward compatibility**: Existing configs without `workflowMode` default to `'solo'`
- **Type safety**: Zod schema validation for the new field
- **No new files**: Changes fit within existing modules

---

## Tasks

### Task 1: Extend Config Schema
- [x] Add `workflowMode` to `ZenoConfigSchema` in `src/utils/config.ts`
- [x] Defaults to `'solo'` for backward compatibility: `z.enum(['solo', 'team']).default('solo')`
- **Acceptance Criteria**:
  - Config with valid `workflowMode` loads correctly
  - Config missing `workflowMode` rejected by Zod at load time
  - Invalid values (e.g., `'foo'`) rejected by Zod
  - TypeScript strict mode passes

### Task 2: Solo Auto-Approval in Propose Command
- [x] Extend `approveProposal(hashInput, options?)` in `src/core/completions.ts` to accept optional `approver?: string`; write it to DB (`approved_by` column, add if missing) and proposal file metadata
- [x] Update `approve` subcommand in `src/cli/commands/proposal.ts`
- [x] Read `workflowMode` from config
- [x] If `'solo'`: run quality gates (existing `qualityThresholds` checks + artifact format validation if #a4f7b2e9 available), then call `approveProposal(hash, { approver: 'solo-auto' })` directly without prompt, log `'auto-approved (solo mode)'`
- [x] If `'solo'` and any quality gate fails: block approval, show errors
- [x] If `'solo'` and artifact validator unavailable: run only `qualityThresholds` checks (no unconditional approval)
- [x] If `'team'`: preserve current behavior (explicit confirmation prompt + quality gates)
- **Acceptance Criteria**:
  - Solo mode skips prompt but enforces all quality gates
  - Team mode still requires explicit confirmation
  - Approval metadata includes `approver` (`'solo-auto'` or user identity) and timestamp

### Task 3: Add `config set` Subcommand
- [x] Add `set <key> <value>` subcommand to `src/cli/commands/config.ts`
- [x] Load config, set dot-path key, validate full config against schema, save
- [x] Reject invalid keys or values with clear error message
- **Acceptance Criteria**:
  - `zeno config set workflowMode team` works
  - `zeno config set workflowMode invalid` rejects
  - `zeno config set git.autoCommit false` works

### Task 4: Tests
- [x] Add tests to `tests/utils/config.test.ts` (file exists):
  - Schema accepts `'solo'` and `'team'`
  - Schema rejects invalid values (e.g., `'foo'`)
  - Schema defaults `workflowMode` to `'solo'` when absent (backward compat)
- [x] Add tests to `tests/cli/commands/proposal.test.ts` (file exists):
  - Solo mode skips prompt and auto-approves when quality gates pass
  - Solo mode blocks when quality gates fail
  - Team mode still requires explicit confirmation
  - `approver` metadata recorded correctly in both modes
- **Acceptance Criteria**:
  - All tests passing
  - Coverage ≥90% for modified code

---

## Files Affected

- `src/utils/config.ts` — Add `workflowMode` required field to Zod schema
- `src/core/completions.ts` — Extend `approveProposal()` to accept optional `approver` string
- `src/cli/commands/proposal.ts` — Solo auto-approval (no prompt, quality gates enforced) in `approve` subcommand
- `src/cli/commands/config.ts` — Add `set` subcommand with dot-path support
- `zeno/.zeno/config.json` — Add `workflowMode: 'solo'` (required; no default in schema)
- `tests/utils/config.test.ts` — Schema validation tests (file exists)
- `tests/cli/commands/proposal.test.ts` — Approval behavior tests (file exists)

---

## Acceptance Criteria

- [x] Config schema accepts `'solo'` and `'team'`, rejects others
- [x] Missing `workflowMode` defaults to `'solo'` (backward compat)
- [x] `zeno proposal approve` in solo mode skips prompt but enforces quality gates
- [x] `zeno proposal approve` in solo mode blocks when any quality gate fails
- [x] `zeno proposal approve` in team mode preserves existing behaviour
- [x] Approval metadata records `approver` (`'solo-auto'` or undefined) and timestamp
- [x] `zeno config set workflowMode <value>` validates and persists
- [x] `zeno config set git.autoCommit <value>` validates and persists (dot-path confirmed in schema)
- [x] All tests passing (1319/1322, 3 pre-existing skips)
- [x] TypeScript strict mode with 0 errors

---

## Deferred / Owned Elsewhere

| Scope | Owner | Rationale |
|-------|-------|-----------|
| Artifact format validation | #a4f7b2e9 | Solo auto-approval depends on this; graceful degradation if absent |
| Quality threshold enforcement | Existing `qualityThresholds` config | Already configurable; not duplicated |
| Worktree decision logic | Gate 10 | Worktree management belongs to Git Integration |
| Agent-orchestrated mode + auto-approve rules | Gate 13 | Post-MVP; no agent users yet |
| Formal proposal state machine (7 states) | None | Over-engineered; existing 4 statuses sufficient |

---

**Ready to implement**: `/zeno-apply #w26021401`
