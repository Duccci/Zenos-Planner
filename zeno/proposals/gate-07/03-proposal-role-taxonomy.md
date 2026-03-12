---
zeno:
  hash: 'c6d0a2b4'
  gate_id: 'gate-07'
  requirement_id: null
  status: pending
  reason: null
  created_at: '2026-03-11'
---
<!-- Status lifecycle:
  - pending: Proposal generated, awaiting implementation
  - in_progress: Proposal currently being implemented
  - completed: Implementation done, all tests passing
  - rejected: Proposal will not be implemented (covers both review rejection and deliberate cancellation); user-provided reason required
  - deferred: Proposal postponed to a later gate; user-provided reason required

  Non-implementation terminal statuses (rejected, deferred) require a reason.
  Set `reason` in the frontmatter above with a clear explanation before changing to either status.
-->

# Proposal: `ProposalRole` Type Taxonomy

**Hash**: #c6d0a2b4
**Gate**: gate-07 - Proposal Generation & Management
**Status**: in_progress
**Created**: 2026-03-11

---

## Summary

Consolidates the three overlapping proposal classification dimensions (location type, test-driven phase, semantic role) into a single authoritative `ProposalRole` union type in `src/core/types.ts`. Adds `roles?: ProposalRole[]` as an array field on both `ProposalMetadata` and `ProposalData`, updates the proposal generator to set default roles per phase, and adds a `{{ROLES}}` placeholder to the proposal template so the field is serialised to disk.

---

## Context

### Why This Change

Two separate role vocabularies exist without a single definition: `test-suite | implementation | test-cleanup | solitary` in `src/core/test-first-validator.ts` and `feature | refactoring | testing | documentation` in the original spec. The gate PRD reconciles these into `testing | feature | cleanup | documentation | solitary` as a multi-value array field on every proposal. Centralising the type in `src/core/types.ts` makes it the single source of truth.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #a7d4f2e8 | requires | RED test suite defines the `ProposalRole` type constraints that this impl must satisfy |

---

## Open Questions

N/A

---

## Tasks

### Task 1: Add `ProposalRole` type to `src/core/types.ts`

**File(s)**: `src/core/types.ts`
**Action**: modify

Add `export type ProposalRole = 'testing' | 'feature' | 'cleanup' | 'documentation' | 'solitary'` to the types file. Add a JSDoc block above it citing the three dimensions it replaces: location type (`gate-tied | solitary`), test-driven phase (`RED | GREEN`), and the two legacy semantic sets. The five values are: `testing` = test-suite / test-cleanup, `feature` = new functionality, `cleanup` = refactoring / test-cleanup, `documentation` = docs-only, `solitary` = not tied to a gate. A single proposal may carry multiple roles.

**Acceptance**:

- [x] `ProposalRole` is exported from `src/core/types.ts`
- [x] Union contains exactly `'testing' | 'feature' | 'cleanup' | 'documentation' | 'solitary'`
- [x] JSDoc comment documents all three merged dimensions
- [x] `npm run build` compiles cleanly

---

### Task 2: Add `roles?: ProposalRole[]` to `ProposalMetadata`

**File(s)**: `src/core/proposal-writer.ts`
**Action**: modify

Import `ProposalRole` from `src/core/types.ts`. Add `roles?: ProposalRole[]` to the `ProposalMetadata` interface. In `generateRedTestSuiteProposal`, when pushing to `proposals`, include `roles: ['testing']`. In `generateImplementationProposals`, include `roles: ['feature']`. In `generateGreenVerificationProposal`, include `roles: ['testing']`. These are default assignments; callers may override them. Do not modify the function signatures.

**Acceptance**:

- [x] `ProposalMetadata` has `roles?: ProposalRole[]`
- [x] RED proposal push sets `roles: ['testing']`
- [x] Implementation proposal push sets `roles: ['feature']`
- [x] GREEN proposal push sets `roles: ['testing']`
- [x] Import of `ProposalRole` from `../../core/types.js` compiles cleanly

---

### Task 3: Add `roles?: ProposalRole[]` to `ProposalData`

**File(s)**: `src/generation/proposal-template.ts`
**Action**: modify

Import `ProposalRole` from `../core/types.js`. Add `roles?: ProposalRole[]` to the `ProposalData` interface. In `renderProposalTemplate`, add handling for the `{{ROLES}}` placeholder: if `data.roles` is provided and non-empty, replace `{{ROLES}}` with `data.roles.join(', ')`; otherwise replace with an empty string. This is a defensive replacement and does not throw if the placeholder is absent from the template.

**Acceptance**:

- [x] `ProposalData` has `roles?: ProposalRole[]`
- [x] `renderProposalTemplate` replaces `{{ROLES}}` with comma-joined roles
- [x] No error thrown when `data.roles` is `undefined` or `[]`
- [x] No error thrown when the template string does not contain `{{ROLES}}` placeholder

---

### Task 4: Add `{{ROLES}}` placeholder and `roles` frontmatter field to proposal template

**File(s)**: `templates/md-templates/proposal-template.md`
**Action**: modify

Add `roles: '{{ROLES}}'` to the YAML frontmatter block (after `status`). Add a `**Roles**: {{ROLES}}` line to the header metadata section (below `**Status**`). This ensures both the DB-sync path (`syncProposalsFromDisk` reads frontmatter) and human readers can see the roles. The placeholder may be empty for templates rendered without explicit roles.

**Acceptance**:

- [x] `roles: '{{ROLES}}'` appears in the YAML frontmatter of the template
- [x] `**Roles**: {{ROLES}}` appears in the header section of the template body
- [x] Existing template structure is otherwise unchanged
- [x] `renderProposalTemplate` test with a minimal template string containing `{{ROLES}}` passes

---

### Task 5: Consolidate legacy role references in `test-first-validator.ts`

**File(s)**: `src/core/test-first-validator.ts`
**Action**: modify

Find all occurrences of the old role strings (`'test-suite'`, `'implementation'`, `'test-cleanup'`). Import `ProposalRole` from `./types.js`. For each role comparison, map to the new values: `'test-suite'` → `'testing'`, `'test-cleanup'` → `'testing'`, `'implementation'` → `'feature'`. If the comparisons are string literals in conditions or switch cases, replace them with the canonical `ProposalRole` values. Do not change any public function signatures — only the internal string constants.

**Acceptance**:

- [x] No `'test-suite'` or `'test-cleanup'` or `'implementation'` string literals remain
- [x] `ProposalRole` is imported and used for type-safe comparisons where applicable
- [x] All existing tests for `test-first-validator` continue to pass
- [x] `npm run build` compiles cleanly

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/core/types.ts` | modify | Add `ProposalRole` type union |
| `src/core/proposal-writer.ts` | modify | Add `roles?: ProposalRole[]` to `ProposalMetadata`; set defaults in generators |
| `src/generation/proposal-template.ts` | modify | Add `roles?: ProposalRole[]` to `ProposalData`; handle `{{ROLES}}` in render |
| `templates/md-templates/proposal-template.md` | modify | Add `roles` frontmatter key and `**Roles**` body line |
| `src/core/test-first-validator.ts` | modify | Replace legacy role strings with canonical `ProposalRole` values |

---

## Implementation Notes

`src/core/types.ts` is the canonical home for shared types used across both `src/core/` and `src/generation/`. Both `proposal-writer.ts` and `proposal-template.ts` import from it, so the type definition lives only once.

`test-first-validator.ts` role consolidation is scoped to internal string literals only. If the validator compares against a `role` field read from a proposal markdown file (via regex parse), the old strings may still appear in legacy proposals on disk. The validator should fall back gracefully (existing behaviour already returns `{ allowed: true }` on unrecognised roles).

---

## Rollback

**If rejected or failed**: Remove `ProposalRole` from `src/core/types.ts`. Remove `roles?` from `ProposalMetadata` and `ProposalData`. Revert template changes. Revert `test-first-validator.ts` to original role strings.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-11
**Versioning**: SemVer
**Owner**: zeno

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-03-11 | Initial version | zeno |
