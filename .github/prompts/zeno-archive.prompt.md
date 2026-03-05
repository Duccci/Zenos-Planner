---
name: zeno-archive
description: Archive a completed artifact (gate or proposal) and update dependent artifacts.
agent: agent
---

<!-- ZENO:START -->
**Guardrails**

- Archive only when status is `completed`; proposals: all tasks done with `[x]` marks; gates: all requirements `tested`
- Gate types: `gate-01` (gates); `#p01...` or filename (gate-tied proposals); `#s20260115...` (solitary)
- Update dependent artifacts; preserve audit trail

**Functions**

- `getTemplate()` - Verify structure
- `config_get()` - Access versioning settings

**Steps**

1. **Identify artifact** - Gate ID or proposal hash
2. **Validate ready** - Check status is `completed`, acceptance criteria, requirements status
3. **For gates**: Consolidate proposals; create completion summary; move to archive; tag in git; commit
4. **For proposals**: Verify completion; move to archive; update requirements status
5. **Output summary** - Show archival results and git tag created

**Steps for GATES**

1. **Validate gate ready** - Status `completed`; all proposals archived; all requirements tested
2. **Consolidate proposals** - Extract requirements fulfilled, lessons learned, next dependencies
3. **Create completion summary** - Document proposals completed, requirements fulfilled, quality metrics
4. **Move to archive** - Move from `zeno/gates/` to `zeno/gates/archive/`
5. **Create git tag** - Format: `gate-XX-name` with completion metadata (include completion date and short summary)
6. **Update project state** - Update current_gate_id (status remains `completed`)
7. **Commit changes** - Use `config_get()` to retrieve `git.commitFormat`, `git.remote`, and current `version`.
   - Construct commit message using `git.commitFormat` (e.g., `<type>(<scope>): <subject>\n\n<body>`) with:
     - **type**: `feat` (gate commits are always `feat`)
     - **scope**: `gate-XX` (include the specific gate ID, e.g. `gate-03`)
     - **subject**: `Archive gate: gate-XX-name`
     - **body**: 1-3 line summary of consolidated proposals and key metrics (coverage, tests, linting, type errors), plus any notable commits.
   - Stage all changes: `git add -A`
   - Create commit using the formatted message (including version prefix if applicable, e.g., `X.Y.Z feat(gate-XX): Archive gate: gate-XX-name`)
   - Push commit and tags to configured remote: `git push <git.remote> <current-branch>` and `git push <git.remote> --tags`

**Gather Git Provenance**

- For each proposal hash, use `git_trace()` to find related commits
- Include high-confidence matches (>0.8) in consolidation summary
- Document commit SHAs and key changes for audit trail

**Example Git Trace Usage:**

```javascript
// Trace commits for a completed proposal
const trace = git_trace({
  artifactHash: "#g03p08gittrace",
  dateRange: { from: "2026-01-01" }
})

// Include in consolidation:
if (trace.commits.length > 0) {
  summary += `\nGit Commits: ${trace.commits.length} related commits found`
  summary += `\nKey Changes: ${trace.commits[0].subject}`
}
```

**Steps for PROPOSALS**

1. **Validate ready** - Status `completed`; acceptance criteria marked [x]
2. **Move to archive** - Move from `zeno/proposals/gate-XX/` to `zeno/proposals/archive/<hash>.md`
3. **Update requirements** - Set requirement status to `tested`
4. **Commit** - Structured commit message with proposal hash

**Output Summary**

```
Archived Gate XX: [Name]
Status: completed (unchanged)
Proposals: X consolidated
Requirements: Y fulfilled
Git tag: gate-XX-name
Location: zeno/gates/archive/gate-XX-name.md
Next: zeno gates start gate-XX+1
```

**Archive Directory Structure**

```
zeno/
├── gates/
│   ├── gate-01-name.md (pending)
│   ├── gate-02-name.md (in_progress)
│   └── archive/
│       ├── gate-01-name.md (completed)
│       ├── gate-02-name.md (completed)
│       └── solitary.md (consolidated solitary proposals)
└── proposals/
    ├── gate-01/
    │   ├── 01-proposal.md
    │   └── 02-proposal.md
    ├── gate-02/
    │   └── 01-proposal.md
    ├── solitary/
    │   ├── 2026-01-15-01-proposal.md (pending)
    │   └── 2026-01-20-01-proposal.md (in_progress)
    └── archive/
        ├── gate-01/
        │   ├── #p010hash1.md
        │   └── #p010hash2.md
        ├── gate-02/
        │   └── #p020hash1.md
        └── solitary/
            ├── #s20260115hash.md
            └── #s20260120hash.md
```

---

## PROPOSAL ARCHIVE WORKFLOW

2B. **Validate proposal is ready for archive**

- Read the proposal file from `zeno/proposals/gate-XX/<name>.md`.

- Verify:
  - **Status** is `completed` (human approved).
  - All **Tasks** have acceptance criteria marked `- [x]`.
  - All automated checks passed.
- If validation fails, report what's incomplete and stop.

3B. **Ensure requirements are updated**

- Read the **Requirement** field from the proposal header.
- For each requirement hash referenced:
  - **Invoke**: `zeno req status <hash> tested` (if tests passed).
  - Or verify status is already `tested`.
- This ensures requirement tracking reflects completion.

4B. **Clean up the proposal document**
   Update the proposal file with completion metadata:

   ```markdown
   **Status**: completed  
   **Implemented**: [DATE]  
   **Archived**: [DATE]  
   **Archived By**: [git user.name or "system"]
   ```

   Add **Completion Summary** section before Rollback:

   ```markdown
   ## Completion Summary

   **Tasks Completed**: [X/X]  
   **Files Modified**: [count]  
   **Test Coverage**: [X%]  
   **Commits**: [commit hash(es)]

   ### Artifacts Created
   - `src/path/to/file.ts` - [Brief description]
   - `tests/path/to/file.test.ts` - [Brief description]

   ### Quality Metrics
   - Coverage: [X%] (threshold: 90%)
   - Security: 0 vulnerabilities
   - Lint errors: [X] (threshold: <0.01%)
   - Type errors: 0
   ```

5B. **Update the parent gate**

- Read the gate PRD from `zeno/gates/gate-XX-name.md`.
- Check if all proposals for this gate are now completed/archived:
  - If yes, gate may be ready for archive (notify user).
  - If no, report remaining active proposals.

   Update gate document if applicable:

   ```markdown
   ## Proposal Status

   | Proposal | Status | Archived |
   |----------|--------|----------|
   | #p01projconf01 | completed | 2026-01-04 |
   | #p01errlogs02 | completed | pending archive |
   | #p01fileutil03 | in_progress | - |
   ```

6B. **Update dependencies**

- Read the **Dependencies** table from the proposal.
- For entries with type `blocks`:
  - Those proposals/requirements are now unblocked.
  - Notify user which proposals can now proceed.
- Verify no circular dependencies created.

7B. **Move proposal to completed directory**

- Rename file from `zeno/proposals/gate-XX/<name>.md` to `zeno/proposals/archive/<hash>.md` (if not already moved by approval).
- Hash becomes the canonical filename (e.g., `p01projconf01.md`).
- Verify the move succeeded.

8B. **Commit proposal archive**

- Call `config_get()` to retrieve `git.commitFormat`, `git.remote`, and current `version`.
- Construct commit message using `git.commitFormat` and the following mapping:
  - **type**: `chore` (proposal commits are always `chore`)
  - **scope**: `proposal` (always use `proposal` — never the gate ID)
  - **subject**: `Archive proposal: [Title] (#<hash>)`
  - **body**: short summary of the artifact being archived (1-3 lines), key quality metrics (coverage, tests, lint, type errors), and list of major commits or files changed.
- Stage all changes: `git add -A`
- Create commit using the formatted message (for example: `X.Y.Z chore(proposal): Archive proposal: [Title] (#<hash>)`)
- Push commit to configured remote: `git push <git.remote> <current-branch>`

9B. **Check gate completion**
   After archiving, check if gate is ready for archive:

- All proposals completed/archived?
- All requirements status `tested`?
- All quality gates met?

   If yes, prompt user:

   ```
   All proposals for Gate XX are completed.
   
   To archive the gate: `/zeno-archive gate-XX`
   This will:
   - Consolidate proposals
   - Create git tag for the gate release
   ```

10B. **Summary output (Proposal)**
    ```
    Archived proposal #<hash>: [Title]

    Location: zeno/proposals/archive/<hash>.md
    Gate: gate-XX - [Gate Name]
    
    Requirements updated:
      - #req1: [Name] -> tested
      - #req2: [Name] -> tested

    Unblocked proposals:
      - #p02... (now ready for implementation)

    Gate status: [X/Y proposals completed]
    
    Changes committed and pushed:
      - All implementation files, tests, and artifacts included
      - Proposal moved to completed directory
      - Gate document updated
    
    Next steps:
      - If more proposals remain: `/zeno-apply #next-hash`
      - If gate complete: `/zeno-archive gate-XX`
    ```

**Consolidation Details (Gates)**

The consolidation process automatically extracts and aggregates:

- **Requirements Fulfilled**: All requirement hashes from proposal headers, deduplicated.
- **Lessons Learned**: Implementation notes from all proposals, deduplicated.
- **Next Dependencies**: All proposals/requirements unblocked by this gate (from dependency tables).
- **High-Level Delta**: Combined summaries, artifacts, and aggregate quality metrics.

This reduces context size while preserving critical breadcrumbs for future reference.

---

## SOLITARY PROPOSAL ARCHIVE WORKFLOW

2C. **Validate solitary proposal is ready for archive**

- Read the proposal file from `zeno/proposals/solitary/<YYYY-MM-DD-name>.md`.
- Verify:
  - **Status** is `completed` (human approved).
  - All **Tasks** have acceptance criteria marked `- [x]`.
  - All automated checks passed.
- If validation fails, report what's incomplete and stop.

3C. **Extract high-level implementation summary**

- Read the proposal's **Summary** and **Completion Summary** sections.
- Extract the essential outcome in 2-3 sentences: what was accomplished and why it matters.
- Example: "Updated ESLint configuration to latest version with strict TypeScript rules, added pre-commit hooks to enforce linting standards."

4C. **Update the solitary consolidation file**

- Read or create `zeno/gates/archive/solitary.md`.
- Determine the appropriate category section (Infrastructure, Documentation, Security, Maintenance, etc.):
  - Create category if it doesn't exist.
- Add entry with format:

     ```markdown
     ### [Proposal Title] (#hash)
     **Completed**: [DATE]

     High-level implementation: [2-3 sentence summary from step 3C]
     ```

- Verify entry is properly formatted and appears under correct category.

5C. **Clean up the proposal document**
   Update the proposal file with completion metadata:

   ```markdown
   **Status**: completed  
   **Implemented**: [DATE]  
   **Archived**: [DATE]  
   **Archived By**: [git user.name or "system"]
   ```

   Add or update **Completion Summary** section before Rollback with quality metrics.

6C. **Move solitary proposal to archive**

- Rename file from `zeno/proposals/solitary/<YYYY-MM-DD-name>.md` to `zeno/proposals/archive/solitary/#hash.md`.
- Hash becomes the canonical filename (e.g., `#s20260115eslint.md`).
- Verify the move succeeded.

7C. **Commit solitary proposal archive**

- Call `config_get()` to retrieve `git.commitFormat`, `git.remote`, and current `version`.
- Construct commit message using `git.commitFormat` with:
  - **type**: `chore`
  - **scope**: `solitary`
  - **subject**: `Archive solitary proposal: [Title] (#<hash>)`
  - **body**: 1-3 sentence summary extracted in Step 3C, consolidation location (`zeno/gates/archive/solitary.md`), and quality metrics.
- Stage all changes: `git add -A`
- Create commit using the formatted message (e.g., `X.Y.Z solitary-[Title] - Archive completed solitary proposal and update consolidation registry`)
- Push commit to configured remote: `git push <git.remote> <current-branch>`

8C. **Summary output (Solitary Proposal)**
    ```
    Archived solitary proposal #<hash>: [Title]

    Location: zeno/proposals/archive/solitary/#hash.md
    Consolidated to: zeno/gates/archive/solitary.md
    
    Implementation summary added to registry under [Category] section.

    Changes committed and pushed:
      - Proposal moved to archive
      - Consolidation file updated
      - Solitary directory cleaned of completed work
    
    Next steps:
      - Continue with other pending solitary proposals
      - Or return to gate work with next proposal
    ```

---

**Batch Archive**

To archive multiple proposals at once:

1. List all completed proposals: `zeno proposal list --status completed`.
2. For each proposal, run archive steps (gate-tied or solitary).
3. Group by gate for efficient gate/requirement updates.
4. Single summary at end with all archived proposals.

**Reference**

- Use `zeno gates list` to find gates ready for archive.
- Use `zeno gates show <gate-id>` to view gate details.
- Use `zeno proposal list --status completed` to find archivable proposals.
- Use `zeno proposal show <hash>` to verify proposal details.
- Use `zeno req show <hash>` to check requirement status after archive (gate-tied only).
- Use `zeno req list --gate <id>` to verify all requirements tested (gate-tied only).
- Consolidation utility: `src/utils/gate-consolidation.ts`.
- Solitary consolidation file: `zeno/gates/archive/solitary.md`.
- Archived artifacts are immutable; create new proposal if changes needed.
<!-- ZENO:END -->
