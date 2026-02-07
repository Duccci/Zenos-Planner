---
name: zeno-archive
description: Archive a completed artifact (gate or proposal) and update dependent artifacts.
---

**Guardrails**
- Archive only at gate completion; do NOT archive individual proposals between apply and gate completion
- Gate types: `gate-01` (gates); `#p01...` or filename (gate-tied proposals); `#s20260115...` (solitary)
- Proposal archival is automatic when gate is completed; user focuses on gate-level approval only
- Update dependent artifacts; preserve audit trail

**Functions**
- `getTemplate()` - Verify structure
- `config_get()` - Access versioning settings

**Steps**
1. **Identify artifact** - Gate ID only (proposals are archived as part of gate completion, not individually)
2. **Validate gate ready** - Check status is `completed`, all proposals completed, acceptance criteria met, requirements status
3. **Consolidate proposals** - Automatically archive and consolidate all gate-tied and solitary proposals
4. **Move to archive** - Move gate and associated proposals; tag in git; commit
5. **Output summary** - Show gate archival results, archived proposals, and git tag created

**Steps for GATES**
1. **Validate gate ready** - Status `completed`; all proposals archived; all requirements tested
2. **Consolidate proposals** - Extract requirements fulfilled, lessons learned, next dependencies
3. **Create completion summary** - Document proposals completed, requirements fulfilled, quality metrics
4. **Move to archive** - Move from `zeno/gates/` to `zeno/gates/archive/`
5. **Create git tag** - Format: `gate-XX-name` with completion metadata (include completion date and short summary)
6. **Update project state** - Update current_gate_id (status remains `completed`)
7. **Commit changes** - Use `config_get()` to retrieve `git.commitFormat`, `git.remote`, and current `version`.
   - Construct commit message using `git.commitFormat` (e.g., `<type>(<scope>): <subject>\n\n<body>`) with:
     - **type**: `chore` (archive) or appropriate type
     - **scope**: `gate-XX` (include gate ID)
     - **subject**: `Archive gate: gate-XX-name`
     - **body**: 1-3 line summary of consolidated proposals and key metrics (coverage, tests, linting, type errors), plus any notable commits.
   - Stage all changes: `git add -A`
   - Create commit using the formatted message (including version prefix if applicable, e.g., `X.Y.Z chore(gate-XX): Archive gate: gate-XX-name`)
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

## GATE ARCHIVAL WORKFLOW (Automatic Proposal Archival Included)

During gate archival, all gate-tied proposals are automatically archived as part of the consolidation process. No separate proposal archival step is needed.

**Consolidation Details (Gates)**

The consolidation process automatically extracts and aggregates:
- **Requirements Fulfilled**: All requirement hashes from proposal headers, deduplicated.
- **Lessons Learned**: Implementation notes from all proposals, deduplicated.
- **Next Dependencies**: All proposals/requirements unblocked by this gate (from dependency tables).
- **High-Level Delta**: Combined summaries, artifacts, and aggregate quality metrics.

This reduces context size while preserving critical breadcrumbs for future reference.

## SOLITARY PROPOSAL ARCHIVAL (Manual, Optional)

Solitary proposals can be manually archived when the user decides they're complete. This is optional and user-initiated (unlike gate-tied proposals which are archived automatically at gate completion).

2C. **Validate solitary proposal is ready for archive**
   - Read the proposal file from `zeno/proposals/solitary/<YYYY-MM-DD-name>.md`.
   - Verify:
     - **Status** is `completed` (user approved).
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
