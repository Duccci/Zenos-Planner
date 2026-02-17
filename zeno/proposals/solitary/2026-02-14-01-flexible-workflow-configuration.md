# Proposal: Workflow Mode Configuration

**Hash**: #w26021401  
**Gate**: solitary  
**Status**: pending  
**Created**: 2026-02-14  
**Revised**: 2026-02-14 (rescoped after review)

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
- Default: `'solo'`
- Validated by Zod; invalid values rejected at load time

#### 2. Solo Auto-Approval
- When `workflowMode === 'solo'`, `zeno proposal approve <hash>` auto-approves without interactive confirmation
- If artifact format validation (#a4f7b2e9) is available, auto-approval runs it first; blocks on failure
- If artifact validator is not yet implemented, auto-approval proceeds unconditionally (graceful degradation)
- Existing approval logic preserved for `team` mode (explicit human approval required)
- Auto-approval still records approver as `'solo-auto'` with timestamp for audit trail

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
- [ ] Add `workflowMode` to `ZenoConfigSchema` in `src/utils/config.ts`
- [ ] Default value: `'solo'`
- [ ] Zod enum: `z.enum(['solo', 'team']).default('solo')`
- **Acceptance Criteria**:
  - Config loads with and without `workflowMode` present
  - Invalid values (e.g., `'foo'`) rejected by Zod
  - TypeScript strict mode passes

### Task 2: Solo Auto-Approval in Propose Command
- [ ] Update `approve` subcommand in `src/cli/commands/proposal.ts`
- [ ] Read `workflowMode` from config
- [ ] If `'solo'`: attempt artifact format validation (if available), then call `approveProposal()` directly, log `'auto-approved (solo mode)'`
- [ ] If `'solo'` and format validation fails: block approval, show errors
- [ ] If `'solo'` and no artifact validator available: approve unconditionally (graceful degradation)
- [ ] If `'team'`: preserve current behavior (explicit approval)
- **Acceptance Criteria**:
  - Solo mode auto-approves without prompt
  - Team mode still requires explicit approval
  - Approval metadata includes mode and timestamp

### Task 3: Add `config set` Subcommand
- [ ] Add `set <key> <value>` subcommand to `src/cli/commands/config.ts`
- [ ] Load config, set dot-path key, validate full config against schema, save
- [ ] Reject invalid keys or values with clear error message
- **Acceptance Criteria**:
  - `zeno config set workflowMode team` works
  - `zeno config set workflowMode invalid` rejects
  - `zeno config set git.autoCommit false` works

### Task 4: Tests
- [ ] Add tests to `tests/utils/config.test.ts` (or create if needed):
  - Schema accepts valid `workflowMode` values
  - Schema rejects invalid values
  - Default is `'solo'` when field absent
- [ ] Add tests to `tests/cli/commands/proposal.test.ts` (or create if needed):
  - Solo mode auto-approves
  - Team mode requires explicit approval
- **Acceptance Criteria**:
  - All tests passing
  - Coverage ≥90% for modified code

---

## Files Affected

- `src/utils/config.ts` — Add `workflowMode` to Zod schema
- `src/cli/commands/proposal.ts` — Solo auto-approval in `approve` subcommand
- `src/cli/commands/config.ts` — Add `set` subcommand
- `zeno/.zeno/config.json` — Add `workflowMode: 'solo'` default
- `tests/utils/config.test.ts` — Schema validation tests
- `tests/cli/commands/proposal.test.ts` — Approval behavior tests

---

## Acceptance Criteria

- [ ] Config schema accepts `'solo'` and `'team'`, rejects others
- [ ] Missing `workflowMode` defaults to `'solo'`
- [ ] `zeno proposal approve` auto-approves in solo mode
- [ ] `zeno proposal approve` requires confirmation in team mode
- [ ] `zeno config set workflowMode <value>` validates and persists
- [ ] All tests passing
- [ ] TypeScript strict mode with 0 errors

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
