# Proposal: [Proposal Title]

**Hash**: #[Generated SHA-256 first 16 chars]  
**Gate**: [Gate ID] - [Gate Name]  
**Requirement**: #[Requirement Hash] (optional - may address gate-level objective)  
**Status**: pending | in_progress | completed | rejected  
**Created**: [DATE]

---

## Summary

[2-3 sentence description of what this proposal accomplishes. Focus on the outcome, not the process.]

---

## Context

### Requirements Context

This proposal implements tasks derived from requirements. Requirements are primarily defined during `zeno init` at project inception and attributed to gates during gate generation. Requirements may be updated or added during rebaseline/rescope operations, but init is the primary source. This proposal breaks down the referenced requirement(s) into individual implementation tasks.

### Why This Change

[1-2 sentences explaining the problem or need this addresses. Reference the gate objective or requirement.]

### Dependencies

List only valid hash references. It is acceptable to have no dependencies if this proposal is self-contained or first in a gate.

| Hash | Type | Description |
|------|------|-------------|
| #[hash] | requires | [What this proposal depends on] |
| #[hash] | blocks | [What this unblocks when complete] |

**Rules**:
- Omit rows for dependency types that do not apply
- Never use placeholder values like "None" or "N/A" as hash references
- If no dependencies exist, replace the table with: *No dependencies - self-contained proposal.*

---

## Tasks

Atomic, LLM-executable tasks. Each task should be completable in a single implementation session.

### Task 1: [Task Title]

**File(s)**: `[path/to/file.ts]`  
**Action**: create | modify | delete | refactor

[2-4 line description of what to implement. Include specific function names, interfaces, or patterns to follow.]

**Acceptance**:
- [ ] [Specific, verifiable condition]
- [ ] [Another verifiable condition]

---

### Task 2: [Task Title]

**File(s)**: `[path/to/file.ts]`  
**Action**: create | modify | delete | refactor

[2-4 line description.]

**Acceptance**:
- [ ] [Condition]
- [ ] [Condition]

---

### Task 3: [Task Title]

**File(s)**: `[path/to/file.test.ts]`  
**Action**: create | modify

[Test task - every proposal should include test coverage.]

**Acceptance**:
- [ ] Tests cover happy path
- [ ] Tests cover error cases
- [ ] Coverage meets 90% threshold for touched files

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/[path]/[file].ts` | create/modify | [Brief change description] |
| `tests/[path]/[file].test.ts` | create/modify | [Test description] |

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

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | [YYYY-MM-DD] | Initial version | [git.user.name] |


