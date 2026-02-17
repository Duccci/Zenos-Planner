# MCP Tools Review & Use Cases

**Project:** Zeno's Planner  
**Date:** February 13, 2026  
**Overview:** Complete analysis of all Model Context Protocol (MCP) tools and their use cases.

---

## What are MCP Tools?

The Model Context Protocol (MCP) tools expose Zeno's Planner functionality to AI agents via a unified interface. Each tool follows the **Entity Action Pattern**: a single dispatcher per entity that accepts an `action` parameter to determine what operation to perform.

**Key Design Principle:** Handler-based tools take precedence over CLI-backed function implementations, providing predictable, schema-validated `structuredContent` for LLM integration while CLI functions remain as a fallback.

---

## Unified Entity Action Tools

These tools follow the pattern: `{ action: "...", payload: {...} }`

### 1. **`gates_action`** – Gate Lifecycle Management

**Purpose:** Manage project gates—the concrete milestones that represent actual deliverables.

**Actions:**
- `list` – View all gates, optionally filter by status (pending, in_progress, completed, rejected)
- `show` – Get detailed information about a specific gate by ID (e.g., `gate-03`)
- `create` – Create a new gate with objectives, requirements, and dependencies
- `start` – Transition gate from pending → in_progress (generates gate-specific requirements)
- `complete` – Finish gate (→ completed, creates git tag, archives proposals)
- `regenerate` – Update roadmap after rescope or mid-project changes

**Use Cases:**
- Daily gate tracking and status checks
- Starting a new gate to begin its planning phase
- Completing gates once all proposals are implemented
- Viewing gate details (PRD, requirements, status, dependencies)
- Regenerating future gates when project scope changes

**Example Call:**
```json
{
  "action": "list",
  "payload": { "status": "in_progress" }
}
```

**Output:** Structured gate list with ID, status, objective, requirements count, proposal status

---

### 2. **`proposal_action`** – Proposal Lifecycle Management

**Purpose:** Manage implementation proposals—detailed plans for satisfying gate requirements.

**Actions:**
- `list` – View proposals by gate, optionally filter by status
- `show` – Get proposal details by hash reference
- `create` – Generate new proposal from requirements with title, summary, tasks, files affected
- `validate` – Run automated quality checks (coverage, linting, security, tests)
- `approve` – Review & merge proposal (merges worktree, cleans up)
- `reject` – Decline proposal with feedback (preserves for rework)
- `start` – Create isolated worktree for development (enables parallel work)

**Use Cases:**
- Creating proposals from gate requirements
- Validating proposals before human approval
- Approving proposals to proceed with implementation
- Starting proposal work in an isolated worktree
- Checking proposal status and implementation details

**Example Call:**
```json
{
  "action": "create",
  "payload": {
    "title": "Implement authentication",
    "summary": "Add JWT-based auth with refresh tokens",
    "gateId": "gate-03",
    "tasks": [
      {
        "description": "Create auth middleware",
        "acceptanceCriteria": ["Tests pass", "No security issues"]
      }
    ],
    "filesAffected": ["src/auth/middleware.ts"]
  }
}
```

**Output:** Proposal hash, status, tasks, validation results, worktree location

---

### 3. **`req_action`** – Requirements Database Query

**Purpose:** Query and manage the requirements database (single source of truth for what must be built).

**Actions:**
- `list` – Retrieve all requirements, optionally filter by gate, type (functional/non_functional/constraint), or priority
- `show` – Get detailed requirement info by hash
- `deps` – View requirement dependency graph (shows which requirements block/require others)
- `transfer` – Move requirement to a different gate

**Use Cases:**
- Understanding what must be built in the current gate
- Checking requirement dependencies before implementation
- Looking up specific requirements by hash reference
- Moving requirements between gates when scope changes
- Querying cross-cutting concerns (security, performance constraints)

**Example Call:**
```json
{
  "action": "list",
  "payload": { "gateId": "gate-03", "type": "functional" }
}
```

**Output:** Array of requirements with hash, type, priority, status, acceptance criteria, dependencies

---

### 4. **`archive_action`** – Finalize Completed Work

**Purpose:** Archive and close out completed gates, proposals, and implementation work.

**Actions:**
- `gate` – Archive completed gate & all its proposals (creates historical record)
- `proposal` – Archive single completed proposal
- `batch` – Archive multiple items at once

**Use Cases:**
- Finalizing gates once all proposals are implemented and merged
- Archiving proposals after successful completion
- Creating historical snapshots of what was built
- Cleaning up completed work for next phase

**Example Call:**
```json
{
  "action": "gate",
  "payload": { "gateId": "gate-03" }
}
```

**Output:** Confirmation of archive status, git commit created, proposals moved to archive directory

---

## Standalone Tools (Non-Action)

### 5. **`config_get`** – Access Project Configuration

**Purpose:** Retrieve project-level settings and quality thresholds.

**Parameters:** None required

**Returns:**
- Quality thresholds (coverage %, lint error %, security policies)
- Git configuration (branch naming, commit format)
- Project version and metadata
- Feature flags and environment settings

**Use Cases:**
- Understanding project quality standards before implementation
- Checking if a requirement violates configured constraints
- Validating proposals meet configured thresholds

**Example Call:**
```json
{}
```

**Output:**
```json
{
  "version": "1.0.0",
  "qualityThresholds": {
    "coverage": 0.9,
    "lintErrorRate": 0.0001,
    "vulnerabilities": 0
  },
  "git": {
    "commitFormat": "feat(scope): message"
  }
}
```

---

### 6. **`template_list`** – Browse Available Templates

**Purpose:** List all artifact templates (proposal templates, gate PRD templates, requirement templates).

**Parameters:** None

**Returns:** Array of template metadata (name, category, description, creation date)

**Use Cases:**
- Discovering what templates are available for different artifacts
- Finding examples of well-formed proposals or requirements

**Output:** Template names, categories, descriptions

---

### 7. **`template_get`** – Retrieve Template Content

**Purpose:** Get the full content of a specific template with optional contextual metadata.

**Parameters:**
- `name` – Template identifier (e.g., "proposal-default")
- `includeContext` – If true, returns template + surrounding context

**Returns:** Full template content as Markdown or JSON

**Use Cases:**
- Loading gate PRD template when creating new gate
- Getting proposal template format for manual creation
- Understanding expected structure for requirements

---

### 8. **`analyze`** – Codebase Analysis

**Purpose:** Run static analysis on codebase or specific paths for metrics.

**Parameters:**
- `path` – Path to analyze (required)
- `depth` – Analysis depth (0-10, default 3)
- `includeDependencies` – Whether to analyze dependencies (default true)
- `includeMetrics` – Whether to calculate metrics (default true)

**Returns:** Analysis results including:
- LOC (lines of code) per language
- Complexity metrics
- Test coverage
- Dependency graph
- Architecture structure

**Use Cases:**
- Understanding current codebase structure before starting a gate
- Measuring impact of proposals on code metrics
- Identifying high-complexity areas that need refactoring
- Planning multi-repo work (Gates 05+)

---

### 9. **`metrics`** – Code Metrics

**Purpose:** Get detailed code metrics for a path or gate.

**Parameters:**
- `path` – Optional path to analyze
- `groupBy` – Group results by: "repository", "language", or "type"

**Returns:**
- Metric values per group
- Historical trends
- Quality assessments

**Use Cases:**
- Checking gate contribution to project metrics
- Comparing metrics across repositories
- Identifying language-specific issues
- Trending metrics over time

---

### 10. **`show_entity`** – Resolve Entity by Hash

**Purpose:** Look up any Zeno entity by its content hash (hash reference system).

**Parameters:**
- `hash` – Content hash (16-char SHA-256 prefix)
- `entityType` – Type filter: "gate", "requirement", "proposal", "repository"

**Returns:** Full entity data resolved from the hash

**Use Cases:**
- Converting hash references (`#a3f9c2d1`) back to full entity details
- Auditing which entity a commit/artifact refers to
- Cross-referencing work artifacts back to requirements

---

## Repository Analysis Tools (Gates 05+ Feature)

### 11. **`repos_list`** – List Detected Repositories

**Purpose:** View all detected repository boundaries and structure.

**Returns:** List of repositories with:
- Path boundaries
- Language composition
- LOC count
- Coupling metrics (afferent/efferent)
- Confidence score

**Use Cases:**
- Understanding multi-repo project structure
- Identifying strongly-coupled modules that might need refactoring
- Planning cross-repo dependency management

---

### 12. **`repos_deps`** – Repository Dependency Graph

**Purpose:** Visualize how repositories depend on each other.

**Returns:** Dependency graph showing:
- Which repos depend on which
- Strength of coupling
- Circular dependency warnings

**Use Cases:**
- Planning work when multiple repos are affected
- Identifying repos that can be worked on in parallel
- Detecting architectural problems (circular deps)

---

### 13. **`repos_detect`** – Auto-Detect Repository Boundaries

**Purpose:** Re-run boundary detection algorithm to find repository structure.

**Returns:** Detection results with confidence scores

**Use Cases:**
- After major code reorganization, re-run detection
- Validate or challenge previous boundary detection
- Establish initial repo boundaries in new monorepos

---

### 14. **`repos_adjust`** – Manually Adjust Repository Boundaries

**Purpose:** Override automatic boundary detection with manual adjustments.

**Parameters:**
- Repository adjustments (path → assigned repo)

**Returns:** Updated boundary configuration

**Use Cases:**
- Correcting auto-detection errors
- Enforcing architectural decisions contrary to metrics
- Setting boundaries for new code not yet analyzed

---

## Workflow Generation Tools

### 15. **`generateProposals`** – Generate Proposals from Gate PRD

**Purpose:** Automatically generate multiple implementation proposals from a gate PRD.

**Parameters:**
- `gateId` – Gate to generate proposals for
- `count` – Number of proposals to generate (default 3)
- `constraints` – Optional constraints on proposals

**Returns:** Array of generated proposals with:
- Title & description
- Implementation approach
- Requirements addressed
- Acceptance criteria
- Risk assessment
- Estimated effort

**Use Cases:**
- Generating multiple implementation options for human review
- Creating initial proposals when gate starts
- Exploring alternative architectures

---

### 16. **`generateGates`** – Generate or Regenerate Gates

**Purpose:** Create or update gate roadmap based on requirements.

**Parameters:**
- `projectPath` – Path to project
- `regenerate` – If true, updates existing gates; if false, creates new
- `count` – Maximum gates to generate

**Returns:** Generated gates with:
- Sequential IDs
- Objectives
- Dependencies
- Gate-specific requirements
- Estimated effort

**Use Cases:**
- Initial project setup (one-time use)
- Rerouting after rescope
- Validating gate decomposition

---

### 17. **`updateProposalProgress`** – Track Proposal Implementation

**Purpose:** Track progress through proposal implementation tasks.

**Parameters:**
- `proposalHash` – Proposal being worked on
- `taskIndex` – Task within proposal (0-based)
- `status` – New status (pending, in_progress, completed)
- `notes` – Optional progress notes

**Returns:** Updated proposal with task status

**Use Cases:**
- Marking tasks complete as implementation progresses
- Tracking which tasks are blocked or require help
- Reporting progress to project manager

---

## Tool Architecture & Pattern

### Entity Action Pattern

All unified tools follow this pattern:
```
Input:  { action: "list|show|create|...", payload?: {...}, mockResult?: {...} }
Output: { action: "...", result: {...}, errors?: [], warnings?: [] }
```

**Validation Layers:**
1. **Input Validation** – Zod schema validates `{ action, payload }`
2. **Action Handler** – Executes the specific action
3. **Per-Action Validation** – Validators run (quality checks, dependency validation)
4. **Output Validation** – Result validated against action-specific schema
5. **Error Envelope** – Non-success results wrapped in `{ error: {...}, isError: true }`

### Handler Factory Pattern

```typescript
// Reusable pattern for similar tools
createSchemaValidatingHandler(registry, 'function_name', OutputSchema)
```

This auto-handles:
- Invoking registry functions
- Validating output schemas
- Formatting errors
- Mock result handling (for testing)

### Structured Content Format

All responses include `structuredContent` for LLM parsing:
```json
{
  "content": [{ "type": "text", "text": "JSON serialized result" }],
  "structuredContent": { "actual": "parsed object" }
}
```

This allows LLMs to consume structured results directly without re-parsing text.

---

## Quality Enforcement in Tools

Several tools embed quality validators:

**Proposal Validation (`proposal_action` > `validate`):**
- Code coverage ≥ 90%
- Security: 0 known CVEs
- Linting: <0.01% error rate
- TypeScript: strict mode, 0 errors
- All tests passing

**Gate Validation (`gates_action` > `create`):**
- Dependency checks (no circular deps)
- Quality thresholds from config
- File conflict detection

**Apply Phase Validation (`proposal_action` > `start`):**
- Worktree isolation checks
- File modification impact analysis
- Git integration validation

---

## Precedence & Registration

**Tool Registration Order:**
1. Handler-based tools (take precedence)
2. CLI-backed function implementations (fallback)
3. Only handler-based in latest version

**Mock Result Support:**
All tools support `mockResult` parameter for testing/local simulation:
```json
{
  "action": "list",
  "payload": {},
  "mockResult": "{\"gates\": [{\"id\": \"gate-01\"}]}"
}
```

---

## Common Usage Patterns

### Initialize a Project
```
1. generateGates (set up roadmap)
2. gates_action: show each gate to understand objectives
3. req_action: list to see gate requirements
```

### Plan a Gate
```
1. gates_action: start (gate-XX)
2. req_action: list --gate gate-XX
3. generateProposals (create implementation options)
4. proposal_action: show (each proposal hash)
```

### Implement a Gate
```
1. proposal_action: create (if not auto-generated)
2. proposal_action: validate (ensure quality gates pass)
3. [Human approval]
4. proposal_action: start (create worktree)
5. [Implement in worktree]
6. proposal_action: approve (merge implementation)
7. gates_action: complete (finish gate)
8. archive_action: gate (archive completed work)
```

### Handle Rescope
```
1. gates_action: regenerate (update roadmap)
2. req_action: transfer (move requirements to new gates)
3. Restart gate planning from "Plan a Gate" section
```

---

## Tool Dependencies & Sequencing

**Linear Dependencies:**
- `gates_action: create` requires understanding from `config_get`
- `proposal_action: create` requires reading from `req_action: list`
- `proposal_action: validate` reads from `config_get` for thresholds

**Parallel-Safe Operations:**
- Multiple `req_action: list` calls are parallel-safe
- Multiple `proposal_action: start` calls are parallel-safe (separate worktrees)
- `analyze` and `metrics` are read-only, parallel-safe

**Serialization Required:**
- Gates must be completed sequentially (one gate at a time)
- Proposals can be worked on in parallel (via worktrees)
- Archive operations must serialize to prevent conflicts

---

## Summary Table

| Tool | Category | Primary Use | Key Feature |
|------|----------|-------------|------------|
| `gates_action` | Core | Gate lifecycle | Status tracking |
| `proposal_action` | Core | Proposal lifecycle | Validation pipeline |
| `req_action` | Core | Requirements database | Hash-based queries |
| `archive_action` | Core | Finalization | Historical record |
| `config_get` | Config | Retrieve settings | Quality thresholds |
| `template_list` | Resources | Browse templates | Discovery |
| `template_get` | Resources | Load templates | Content retrieval |
| `analyze` | Analysis | Code metrics | Codebase understanding |
| `metrics` | Analysis | Metrics by group | Trending |
| `show_entity` | Analysis | Hash resolution | Cross-reference |
| `repos_list` | Multi-Repo | Repository boundaries | Structure |
| `repos_deps` | Multi-Repo | Dependency graph | Coupling analysis |
| `repos_detect` | Multi-Repo | Auto-detect repos | Algorithm |
| `repos_adjust` | Multi-Repo | Manual override | Human control |
| `generateProposals` | Generation | Proposal creation | LLM-assisted |
| `generateGates` | Generation | Gate creation | Roadmap planning |
| `updateProposalProgress` | Tracking | Task progress | Implementation tracking |

---

## Implementation Status

- ✅ **Core Tools** (`gates_action`, `proposal_action`, `req_action`, `archive_action`)
- ✅ **Configuration** (`config_get`)
- ✅ **Templates** (`template_list`, `template_get`)
- ✅ **Analysis** (`analyze`, `metrics`, `show_entity`)
- 🚧 **Multi-Repo** (planned for Gate 05+)
- ✅ **Workflow** (`generateProposals`, `generateGates`, `updateProposalProgress`)

---

**Note:** This review describes the tools as designed. Implementation status varies; check tool handlers for actual availability in your build.
