# Zeno's Planner Terminology

| Term / Acronym | Definition |
| -------------- | ---------- |
| **Archive** | Gate-level consolidation artifact in `gates/archive/` produced when a gate is completed; captures all proposals, requirements, and commit refs for that gate |
| **Gate** | Concrete, measurable milestone representing an actual deliverable; status: `pending` → `validated` → `in_progress` → `completed` or `rejected` |
| **Gate PRD** | Per-gate specification file at `gates/gate-XX-name.md`; contains objectives, deliverables, requirement refs, and dependencies |
| **Hash** | Content-addressable 16-char SHA-256 prefix (`#a3f9c2d1`) used to reference gates, requirements, proposals, and artifacts without repeating full paths |
| **MCP** | Model Context Protocol — server interface exposing Zeno tools (`reg_action`, `gates_action`, `proposal_action`, etc.) to AI agents |
| **Multi-Repo** | Project configuration spanning multiple independent repositories; boundaries detected via hybrid `CodeAnalyzer` + `architect-reviewer` analysis |
| **PRD** | Product Requirements Document — used at both project level (`PROJECT_PRD.md`) and gate level (`gates/gate-XX-name.md`) |
| **prop N-M** | Shorthand reference for the Mth proposal of gate N; e.g. `prop 6-2` means proposal 2 within gate 6; resolves to the corresponding entry in `proposals/gate-06/` |
| **Proposal** | Implementation plan for a set of requirements within a gate; stored in `proposals/gate-XX/<name>.md`; status: `pending` → `validated` → `in_progress` → `completed` or `rejected` |
| **Quality Gate** | Automated check that must pass before proposal approval: ≥90% coverage, 0 CVEs, <0.01% lint errors, 0 TS errors, all tests passing |
| **Registry** | SQLite database at `.zeno/registry.db` storing all requirements, gates, proposals, and hashes; accessed via MCP tools only |
| **Rescope** | Mid-project change to goals or constraints; triggers future gate regeneration via `zeno rescope` |
| **Requirement** | Specific, measurable capability or constraint; types: `functional`, `non_functional`, `constraint`; priorities: `must`, `should`, `could`, `won't` |
| **RO Matrix** | Risk/Opportunity Matrix — architecture artifact at `architecture/ro-matrix.md` visualising likelihood × impact scores |
| **Solitary** | Proposal not tied to a specific gate; stored in `proposals/solitary/` |
| **Worktree** | Isolated git working directory per proposal at `.local/worktrees/{hash}/`; created by `zeno proposal start`, cleaned up after approval |
| **Zeno Engine** | Core orchestration layer (`src/core/zeno-engine.ts`) coordinating gate lifecycle, proposal management, and quality enforcement |
