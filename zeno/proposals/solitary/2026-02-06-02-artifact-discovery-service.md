# Proposal: Unified Artifact Discovery Service

**Hash**: #s20260206disco  
**Status**: pending  
**Created**: 2026-02-06

---

## Summary

Replace hardcoded template registry with unified discovery service that scans local directories (templates/, agents/, zeno/gates/, zeno/proposals/) and provides a single query interface. No URL resolution, no caching, no remote fetching—git handles external updates via submodules and pulls. Enables dynamic template addition, simplifies agent discovery, and consolidates scattered gate/proposal lookups.

---

## Context

### Requirements Context

This proposal is self-contained and addresses infrastructure concerns (artifact discovery) that benefit the entire project. While created as a solitary proposal, it establishes a foundation that gates and future proposals can depend on for unified artifact access patterns.

### Why This Change

Currently, templates require code modification and deployment to add new ones (hardcoded `TEMPLATES` array in `template-registry.ts`). Gate and proposal discovery logic is scattered across multiple command handlers with no unified interface. This forces duplicate directory scanning and inconsistent metadata extraction. A single discovery service eliminates these inefficiencies and enables runtime artifact extensibility.

### Dependencies

*No dependencies - self-contained proposal.*

This proposal:
- ✓ Requires no other proposals to be completed first
- ✓ No external blockers
- ✓ Can be implemented and tested independently
- ✓ Benefits all future work requiring artifact queries

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

| File | Action | Description |
|------|--------|-------------|
| `src/generation/template-discovery.ts` | create | Scanner for templates/ directory, discovers markdown files with metadata extraction |
| `src/generation/agent-discovery.ts` | create | Scanner for agents/agent-manifest.json and agent directories |
| `src/generation/gates-discovery.ts` | create | Scanner for zeno/gates/ directory, aggregates gate metadata |
| `src/generation/proposals-discovery.ts` | create | Scanner for zeno/proposals/ directory (gate-specific and solitary) |
| `src/generation/artifact-discovery-service.ts` | create | Unified DiscoveryService interface and factory function |
| `src/mcp/tools/artifact-tools.ts` | modify | Update handlers to use DiscoveryService instead of hardcoded registry |
| `src/cli/commands/template.ts` | modify | Refactor to use discovery service for template list/get/context commands |
| `src/generation/index.ts` | modify | Remove template-registry export |
| `src/generation/template-registry.ts` | delete | Hardcoded registry no longer needed |
| `tests/generation/artifact-discovery.test.ts` | create | Unit and integration tests for all discovery scanners |
| `tests/generation/artifact-discovery-service.test.ts` | create | Tests for unified DiscoveryService interface |


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

## Rollback

**If rejected or failed**: No rollback needed - proposal creates isolated new modules (`artifact-discovery.ts` files, tests). If rejected, simply don't merge the PR; no side effects or breaking changes to existing systems. Hardcoded `template-registry.ts` remains in place until explicitly removed in Task 8.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-02-06  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  

### Change Log

| Version | Date | Summary |
|---------|------|---------|
| 1.0.0 | 2026-02-06 | Initial proposal: unified artifact discovery service |
