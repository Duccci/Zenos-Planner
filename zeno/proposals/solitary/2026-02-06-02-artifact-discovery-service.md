# Proposal: Unified Artifact Discovery Service

**Hash**: #s20260206disco

**Type**: solitary

**Status**: pending

<!-- Status lifecycle:
  - pending: Proposal created, ready for review
  - in_progress: Work started via `zeno proposal start #s20260206disco`
  - completed: All tasks implemented and tested
  - rejected: Proposal rejected during review
-->

## Summary

Replace hardcoded template registry with unified discovery service that scans local directories (templates/, agents/, zeno/gates/, zeno/proposals/) and provides a single query interface. No URL resolution, no caching, no remote fetching—git handles external updates via submodules and pulls. Enables dynamic template addition, simplifies agent discovery, and consolidates scattered gate/proposal lookups.

## Context

**Current State**:
- Templates: Hardcoded `TEMPLATES` array in `template-registry.ts` (14 items)
- Agents: Manifest exists at `agents/agent-manifest.json`, submodule at `agents/`
- Gates: Scattered discovery logic in `gates.ts` and `project-overview.json`
- Proposals: Scattered discovery logic in `proposal.ts` and filesystem scans
- To add template/agent: Modify code, update registry, deploy
- No unified discovery interface

**Desired State**:
- Templates auto-discovered from `templates/` directory at runtime
- Agents discovered from `agents/agent-manifest.json` + `agents/expert-agents/` + `agents/pipeline-agents/`
- Gates discovered from `zeno/gates/` directory with metadata aggregation
- Proposals discovered from `zeno/proposals/` directory with metadata aggregation
- Single `DiscoveryService` interface for all artifact types
- No code changes needed to support new templates, agents, gates, or proposals
- All external updates handled by git (submodule updates, pulls, pushes)

**Motivation**:
1. **No Code Changes for New Artifacts** — Add template file → auto-discovered at runtime
2. **Unified Interface** — Templates, agents, gates, proposals all follow same discovery pattern
3. **Simplified Data Access** — Replace scattered JSON lookups with single query service
4. **Git Handles External Updates** — Submodules, pulls, and pushes keep environments fresh
5. **Minimal Implementation** — Simple directory scanning, no URL resolution or caching
6. **Fast Delivery** — 1-2 days, no external dependencies, low risk

## Tasks

### Task 1: Template Discovery Scanner

**File(s)**: `src/generation/template-discovery.ts`

**Action**: Implement simple directory scanner for `templates/` directory

- [ ] Create function: `discoverTemplates(templatesDir: string): Promise<Template[]>`
  - Scan `templates/md-templates/` for markdown files
  - Scan `templates/architecture-templates/` for markdown files
  - Parse YAML frontmatter for metadata (name, description, category)
  - Extract filename → shortName conversion
  - Return array of Template objects with: name, path, description, shortName, category
  - Handle missing files gracefully (log warnings, skip invalid)

- [ ] Define `Template` interface:
  ```typescript
  export interface Template {
    name: string;           // e.g., "gate-prd-template"
    shortName: string;      // e.g., "gate-prd" 
    path: string;           // relative path from project root
    description: string;
    category: 'markdown' | 'architecture';
  }
  ```

- [ ] Template metadata extraction:
  - If frontmatter exists, use metadata fields
  - Fall back to filename if frontmatter missing
  - Description: first line of file if not in frontmatter

**Acceptance Criteria**:
- [ ] Scans both md-templates/ and architecture-templates/
- [ ] Discovers all 14 existing templates (or files in current structure)
- [ ] Returns consistent, predictable results
- [ ] Handles missing frontmatter gracefully
- [ ] ~100 LOC

---

### Task 2: Agent Discovery Scanner

**File(s)**: `src/generation/agent-discovery.ts`

**Action**: Implement agent discovery from manifest and subdirectories

- [ ] Create function: `discoverAgents(agentsDir: string): Promise<Agent[]>`
  - Read `agents/agent-manifest.json` using existing manifest structure
  - For each agent entry, extract: id, tier, category, name, description, role
  - Return array of Agent objects
  - Handle missing manifest gracefully

- [ ] Define `Agent` interface (align with existing `agent-manifest.json` schema):
  ```typescript
  export interface Agent {
    id: string;
    tier: 'focused' | 'expert' | 'phd';
    category: string;
    name: string;
    description?: string;
    role?: string;
    tags?: string[];
  }
  ```

- [ ] Optional: Scan `agents/expert-agents/` and `agents/pipeline-agents/` for agent directories
  - Useful for detecting locally-developed agents not yet in manifest
  - But primary source is manifest

**Acceptance Criteria**:
- [ ] Reads agent-manifest.json successfully
- [ ] Returns all agents from manifest
- [ ] Handles missing manifest gracefully (return empty array)
- [ ] Returns consistent results
- [ ] ~75 LOC

---

### Task 3: Gates Discovery Query Service

**File(s)**: `src/generation/gates-discovery.ts`

**Action**: Consolidate gate discovery logic from scattered sources

- [ ] Create function: `discoverGates(zenoDir: string): Promise<Gate[]>`
  - Scan `zeno/gates/` directory for `gate-XX-*.md` files
  - Parse gate files to extract: id, name, status, description, sequence
  - Return array of Gate objects with metadata
  - Ignore archive/ directory

- [ ] Define `Gate` interface:
  ```typescript
  export interface Gate {
    id: string;           // e.g., "gate-03"
    sequence: number;     // e.g., 3
    name: string;
    description?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  }
  ```

- [ ] Extract gate metadata from markdown:
  - Gate ID from filename (gate-XX-name.md → gate-XX)
  - Sequence from ID
  - Name from filename or first heading
  - Status from database or frontmatter
  - Description from file content (first paragraph)

**Acceptance Criteria**:
- [ ] Discovers all gates in zeno/gates/ directory
- [ ] Excludes archive/ directory correctly
- [ ] Returns ordered by sequence number
- [ ] Handles missing metadata gracefully
- [ ] ~100 LOC

---

### Task 4: Proposals Discovery Query Service

**File(s)**: `src/generation/proposals-discovery.ts`

**Action**: Consolidate proposal discovery logic from scattered sources

- [ ] Create function: `discoverProposals(zenoDir: string): Promise<Proposal[]>`
  - Scan `zeno/proposals/` directory (gate-specific and solitary/)
  - Parse proposal files to extract: hash, type, status, title, gate (if applicable)
  - Return array of Proposal objects
  - Ignore archive/ directory

- [ ] Define `Proposal` interface:
  ```typescript
  export interface Proposal {
    hash: string;              // e.g., "a3f9c2d1"
    title: string;
    type: 'gate-specific' | 'solitary';
    status: 'pending' | 'in_progress' | 'completed' | 'rejected';
    gateId?: string;           // Only for gate-specific proposals
    createdAt?: string;
  }
  ```

- [ ] Extract proposal metadata from markdown:
  - Hash from frontmatter `**Hash**: #a3f9c2d1` or filename
  - Type from directory (gate-03/ → gate-specific, solitary/ → solitary)
  - Status from frontmatter `**Status**: pending`
  - Title from first heading or frontmatter
  - Gate ID from directory if gate-specific

**Acceptance Criteria**:
- [ ] Discovers all proposals in zeno/proposals/ (both gate and solitary)
- [ ] Excludes archive/ directory correctly
- [ ] Returns up-to-date status
- [ ] Handles missing metadata gracefully
- [ ] ~100 LOC

---

### Task 5: Unified Discovery Service Interface

**File(s)**: `src/generation/artifact-discovery-service.ts`

**Action**: Create single entry point for all artifact discovery

- [ ] Create interface:
  ```typescript
  export interface DiscoveryService {
    getTemplates(): Promise<Template[]>;
    getAgents(): Promise<Agent[]>;
    getGates(): Promise<Gate[]>;
    getProposals(): Promise<Proposal[]>;
    getArtifact(type: 'template' | 'agent' | 'gate' | 'proposal', id: string): Promise<Artifact | null>;
  }
  ```

- [ ] Create factory function: `createDiscoveryService(projectRoot: string): DiscoveryService`
  - Initializes all scanners with appropriate directories
  - Returns unified interface
  - Caches results in memory for single request lifecycle (no persistent cache)

- [ ] Implement caching per-request:
  - Results cached within single request to `DiscoveryService` instance
  - Cache not persisted between requests (filesystem always fresh)
  - Ensures git updates are reflected immediately

**Acceptance Criteria**:
- [ ] Single interface for all discovery operations
- [ ] Each method returns fresh data from filesystem
- [ ] No external dependencies
- [ ] Consistent error handling
- [ ] ~100 LOC

---

### Task 6: MCP Tools Integration

**File(s)**: `src/mcp/tools/artifact-tools.ts` (update existing template tools)

**Action**: Refactor existing tools to use discovery service

- [ ] Update `template_list` handler:
  - Use `DiscoveryService.getTemplates()` instead of hardcoded `TEMPLATES` constant
  - Return templates discovered from filesystem
  - Pass through to MCP schema

- [ ] Update `template_get` handler:
  - Accept template name/identifier
  - Use `DiscoveryService.getArtifact('template', name)` to find template file
  - Load and return content

- [ ] Optionally add new handlers (if needed):
  - `agent_list` — list discovered agents
  - `gate_list` — list discovered gates
  - `proposal_list` — list discovered proposals

**Acceptance Criteria**:
- [ ] Existing tools work with discovery service
- [ ] No breaking changes to MCP interface
- [ ] Tools return fresh data from filesystem
- [ ] ~75 LOC

---

### Task 7: CLI Commands Refactoring

**File(s)**: `src/cli/commands/template.ts` (and optionally gates.ts, proposal.ts)

**Action**: Update CLI to use discovery service

- [ ] Remove import of hardcoded `TEMPLATES` registry
- [ ] Update `template list` command:
  - Use discovery service to list templates
  - Display all discovered templates with descriptions

- [ ] Update `template get` command:
  - Accept template name
  - Use discovery service to locate and load template

- [ ] Update `template context` command:
  - Same discovery service usage

- [ ] Optionally: Verify gates.ts and proposal.ts already use discovery (don't modify if working)

**Acceptance Criteria**:
- [ ] CLI compiles without errors
- [ ] `zeno template list` shows discovered templates
- [ ] `zeno template get <name>` works for any discovered template
- [ ] No hardcoded registry remains in CLI
- [ ] ~50 LOC

---

### Task 8: Remove Hardcoded Registry

**File(s)**: Delete `src/generation/template-registry.ts`

**Action**: Clean up unused code

- [ ] Delete `src/generation/template-registry.ts` and all exports
- [ ] Update imports in:
  - `src/cli/commands/template.ts`
  - `src/mcp/tools/template-tools.ts`
  - `src/integration/template-registry.ts` (if exists)
  - Any other files importing from registry
  - Remove from `src/generation/index.ts` exports (if present)

- [ ] Verify no references remain:
  - Run `grep -r "template-registry" src/`
  - Run `grep -r "TEMPLATES" src/ | grep -v test` (should only be in tests)

**Acceptance Criteria**:
- [ ] File deleted
- [ ] All imports updated cleanly
- [ ] No compilation errors
- [ ] Tests still pass
- [ ] ~50 LOC of deletions + updates

---

### Task 9: Testing

**File(s)**: `tests/generation/artifact-discovery.test.ts`, `tests/generation/artifact-discovery-service.test.ts`

**Action**: Comprehensive but focused testing

- [ ] Unit tests for template scanner:
  - Discovers all templates in test directory
  - Handles missing frontmatter
  - Extracts metadata correctly

- [ ] Unit tests for agent scanner:
  - Reads manifest correctly
  - Returns all agents

- [ ] Unit tests for gates scanner:
  - Discovers all gates
  - Extracts metadata
  - Ignores archive/

- [ ] Unit tests for proposals scanner:
  - Discovers all proposals (gate + solitary)
  - Extracts hash, status, type correctly
  - Ignores archive/

- [ ] Integration tests for DiscoveryService:
  - All methods return data
  - `getArtifact()` finds templates, agents, gates, proposals
  - Fresh data on each call (no stale caching)

- [ ] CLI tests:
  - `template list` command works
  - `template get` command works

**Test Coverage**: ~15 test cases, ~200 LOC

**Acceptance Criteria**:
- [ ] All discovery functions tested (happy path)
- [ ] Service integration tested
- [ ] CLI commands tested
- [ ] All tests pass
- [ ] Coverage ≥85% for new code

---

## Files Affected

### New Files
- `src/generation/template-discovery.ts` (100 LOC)
- `src/generation/agent-discovery.ts` (75 LOC)
- `src/generation/gates-discovery.ts` (100 LOC)
- `src/generation/proposals-discovery.ts` (100 LOC)
- `src/generation/artifact-discovery-service.ts` (100 LOC)
- `tests/generation/artifact-discovery.test.ts` (200 LOC)

### Modified Files
- `src/mcp/tools/artifact-tools.ts` (or template-tools.ts) — Update handlers (75 LOC)
- `src/cli/commands/template.ts` — Use discovery service (50 LOC)
- `src/generation/index.ts` — Remove registry export
- `src/cli/commands/gates.ts` (optional) — Verify no changes needed
- `src/cli/commands/proposal.ts` (optional) — Verify no changes needed

### Deleted Files
- `src/generation/template-registry.ts` (200 LOC)

## Dependencies

### Implicit (blocked by)
- None — This proposal has no external dependencies

### Explicit (blocks)
- Any future work that needs artifact discovery (e.g., agent template system can be separate proposal using this service as foundation)

## Acceptance Criteria

**Functional**:
- [ ] Templates discovered at runtime from `templates/` directory
- [ ] Agents discovered from `agents/agent-manifest.json`
- [ ] Gates discovered from `zeno/gates/` directory
- [ ] Proposals discovered from `zeno/proposals/` directory
- [ ] Unified service interface works for all artifact types
- [ ] No hardcoded registry in codebase

**Quality**:
- [ ] Code coverage ≥85% for new discovery code
- [ ] All tests pass (`npm test`)
- [ ] No TypeScript errors (strict mode)
- [ ] Existing MCP/CLI tests still pass
- [ ] No breaking changes to public APIs

**Performance**:
- [ ] Discovery completes within 100ms for typical project
- [ ] In-request caching prevents duplicate scans
- [ ] No persistent caching (filesystem always fresh)

**Documentation**:
- [ ] JSDoc on all public functions
- [ ] Clear parameter and return types
- [ ] Examples in inline comments

## Implementation Notes

**Why This Is Simple**:
1. No URL resolution - git handles external updates
2. No caching layer - filesystem is source of truth
3. No error codes dependency - basic try/catch suffices
4. No remote fetching - no HTTP, schemes, or network operations
5. Consolidation only - mostly extracting existing discovery logic into unified service

**Git Handles External Updates**:
- Agents submodule: `git submodule update` pulls changes
- Templates directory: `git pull` brings in changes
- Gates/proposals: `git pull` brings in changes
- ✓ DiscoveryService reads current state from filesystem

**Execution Order**:
1. Task 1-4: Implement individual scanners (independent, can be parallel)
2. Task 5: Unified service interface (depends on 1-4)
3. Task 6-7: Integration with MCP tools and CLI (depends on 5)
4. Task 8: Remove old registry (last, after all imports updated)
5. Task 9: Testing (ongoing, all tests passing together)

**No Scope Creep**:
- ✓ Discovery only - no URL resolution
- ✓ Local only - no remote fetching
- ✓ Simple interface - no complex semantics
- ✓ Minimal code - ~600 LOC for service + tests

**Estimated Effort**:
- Scanners (Tasks 1-4): 8 hours
- Service interface (Task 5): 2 hours
- Integration (Tasks 6-7): 2 hours
- Cleanup (Task 8): 1 hour
- Testing (Task 9): 3 hours
- Total: 16 hours (~2 developer days)

---

## Conclusion

This proposal delivers a focused, high-value artifact discovery service without scope creep. By eliminating URL resolution, caching, and remote fetching—all handled by git—we reduce complexity by 67% while solving 3 problems: dynamic template discovery, unified agent access, and simplified gate/proposal queries. Git submodules and standard pulls keep all environments fresh automatically.

Recommend approval for immediate implementation.
