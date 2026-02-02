# MCP Prompt Workflows

This document describes the four prompt workflows enabled by the MCP server.

## /zeno-apply
- Purpose: Orchestrate proposal implementation and lifecycle steps.
- Tools: `proposal_show`, `proposal_approve`, `proposal_start`, `manage_todo_list`
- Pattern: Load proposal -> review tasks -> request approval -> track progress -> finalize

```
User Prompt
    |
    v
proposal_show(hash) -> Proposal Details
    |
    v
LLM Reviews Tasks & Dependencies
    |
    v
proposal_start(hash) -> Status: in_progress
    |
    v
Implement Tasks (external actions)
    |
    v
manage_todo_list(update) -> Track Progress
    |
    v
proposal_approve(hash) -> Status: approved
    |
    v
gates_complete(gate-id) -> Archive & Commit
```

## /zeno-gate
- Purpose: Generate or regenerate gates and requirements.
- Tools: `gates_show`, `requirement_generate`, `req_deps`, `gates_regenerate`
- Pattern: Load gate PRD -> generate requirements with templates -> create sequences -> validate

## /zeno-proposal
- Purpose: Create proposal documents for a gate.
- Tools: `gates_show`, `template_get`, `proposal_start`
- Pattern: Load gate PRD -> select template -> generate proposal markdown -> validate

## /zeno-archive
- Purpose: Archive completed artifacts and update consolidation.
- Tools: `gates_show`, `proposal_list`, `repository_commit` (if available), `git_trace`
- Pattern: Validate completion -> trace git history -> move files to archive -> tag and update registry

```
User Prompt
    |
    v
gates_show(gate-id) -> Gate Status
    |
    v
proposal_list(gate: gate-id) -> Completed Proposals
    |
    v
git_trace(artifactHash) -> Git Provenance
    |
    v
Archive Files -> Update Registry
    |
    v
repository_commit(message) -> Git Tag & Push
```

### Git Traceability Tool

The `git_trace` tool provides git history analysis for artifact traceability:

**Input Parameters:**
- `artifactHash`: Hash to search for (e.g., "#g03p08gittrace")
- `dateRange`: Optional date filter {from: "2026-01-01", to: "2026-02-01"}
- `branch`: Optional branch filter
- `limit`: Optional result limit

**Output:**
- `commits[]`: Array of matching commits with confidence scores
- `totalCommits`: Total commits searched
- `searchParams`: Echo of search parameters

**Usage Examples:**
```javascript
// Trace a proposal hash
git_trace({
  artifactHash: "#g03p08gittrace",
  dateRange: { from: "2026-01-01" }
})

// CLI usage
zeno trace #g03p08gittrace --from 2026-01-01 --json
```

**Commit Format Integration:**
The tool respects the `commitFormat` from `.zeno/config.json` for pattern matching. Default format: `feat(%s): %m`

**Confidence Scoring:**
- 1.0: Direct hash match in message
- 0.8: Hash in commit scope (using commitFormat)
- 0.7: Hash without # prefix
- 0.6: Fuzzy match (partial similarity)

Each workflow should be exercised during integration tests and documented with example MCP calls and expected outputs.
