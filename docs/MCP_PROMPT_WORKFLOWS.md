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
- Tools: `gates_show`, `proposal_list`, `repository_commit` (if available)
- Pattern: Validate completion -> move files to archive -> tag and update registry

Each workflow should be exercised during integration tests and documented with example MCP calls and expected outputs.
