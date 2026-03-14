
## Consolidated Proposals Summary

*This section consolidates information from all archived proposals for this gate to reduce context size while preserving key breadcrumbs.*

### Requirements Fulfilled

| Requirement | Proposal |
|-------------|----------|
| #deaffddca970ab09 | #b1c9e3f5 |

### Lessons Learned

- All tasks are pure test-writing; no source files are modified. Tests in Tasks 1 and 4 will fail at import or runtime because the expected shapes don't exist yet. Tasks 2, 3, and 5 fail at compile time via `@ts-expect-error` inversion or type-only assertions once the types are absent.
- `tests/mcp/proposal-schemas.test.ts` does not yet exist — create it (write a `describe` wrapper + the four assertions from Task 4).
- The topological sort duplicated into `calculateProposalDependencies()` is intentional — `task-distributor-integration.ts` is an optional AI shuttle with a `child_process` dependency and should not become a hard import for core generation logic. The ~20-line Kahn's algorithm copy is justified by the isolation requirement stated in the gate PRD.
- For Task 6, the frontmatter update should re-read the written `.md` file content, find the `parallel_set_index: null` line, replace it with `parallel_set_index: <idx>`, and write the file back. Use the existing `writeFile` utility. Keep it minimal — do not introduce a full YAML serialiser.
- `src/core/types.ts` is the canonical home for shared types used across both `src/core/` and `src/generation/`. Both `proposal-writer.ts` and `proposal-template.ts` import from it, so the type definition lives only once.
- `test-first-validator.ts` role consolidation is scoped to internal string literals only. If the validator compares against a `role` field read from a proposal markdown file (via regex parse), the old strings may still appear in legacy proposals on disk. The validator should fall back gracefully (existing behaviour already returns `{ allowed: true }` on unrecognised roles).
- The algorithm for `parallelSets` reconstruction in `proposals-registry.ts` should be O(n): group all proposals by `parallel_set_index` using a `Map<number, string[]>` keyed by index, then iterate the sorted entries via `[...map.entries()].sort((a,b) => a[0]-b[0]).map(([,hashes]) => hashes)` to produce the output array in index order.
- When `parallelSets` is empty (gate has no proposals, or no proposals have been through generation), return `parallelSets: []` — never `undefined`. This keeps the schema required field contract.
- GREEN phase tasks are verification-only: do not add implementation code. If a test fails because of a genuine bug in the implementation proposals, the fix belongs in the prior proposal, not here. GREEN tasks are limited to: fixing import paths that landed at different locations than RED assumed, updating fixtures to match actual generated file shapes (e.g., if hash values or file naming differed), and adding targeted coverage-gap tests for newly discovered uncovered branches.
- The 90% coverage threshold must be met for all files touched across P02, P03, and P04 before this proposal is marked complete.

### Next Dependencies

*Proposals that are unblocked by this gate (identified from proposal dependency tables):*

*No downstream dependencies identified.*

### High-Level Delta

**Summary**:
Writes the complete failing test suite for all gate-07 deliverables before any implementation begins. Tests cover: `calculateProposalDependencies()` returning `{ edges, parallelSets }` with correct topological grouping; `parallelSetIndex` presence on `ProposalMetadata`; `ProposalRole` type constraints and per-field validation; and `ProposalListOutput` including `parallelSets` and per-summary `parallelSetIndex`. All tests are expected to fail (RED) until the three implementation proposals complete. Extends `calculateProposalDependencies()` in `src/core/proposal-writer.ts` to also compute parallel execution sets via Kahn's topological sort algorithm, returning `{ edges, parallelSets }` instead of a plain edges array. Simultaneously updates the proposal generation flow to annotate each generated `ProposalMetadata` with its `parallelSetIndex`, adds the DB schema column, and wires `parallelSetIndex` into the `syncProposalsFromDisk` frontmatter-to-DB path so the value persists across restarts. All changes are integrated as a single implementation unit. Consolidates the three overlapping proposal classification dimensions (location type, test-driven phase, semantic role) into a single authoritative `ProposalRole` union type in `src/core/types.ts`. Adds `roles?: ProposalRole[]` as an array field on both `ProposalMetadata` and `ProposalData`, updates the proposal generator to set default roles per phase, and adds a `{{ROLES}}` placeholder to the proposal template so the field is serialised to disk. Updates the `ProposalListOutputSchema` Zod schema and the `proposal_action` MCP response handler to include a top-level `parallelSets: string[][]` array and a per-proposal `parallelSetIndex?: number` field. The `proposal_list` registry function is updated to query `parallel_set_index` from the DB and assemble the `parallelSets` structure before returning. The `proposal_action` list branch in `proposal-tools.ts` validates output against the updated schema. Wires all gate-07 implementation work to the RED test suite and verifies every test passes. Covers: `calculateProposalDependencies()` shape change, `parallelSetIndex` annotation and DB persistence, `ProposalRole` type and field propagation, and `ProposalListOutput` schema update with `parallelSets`. Also closes any coverage gaps identified during implementation (missing branch coverage, error paths in the new migration patch). Ensures `npm run build` and all affected test suites pass at ≥ 90% coverage threshold.

**Artifacts Created**:
*No artifacts tracked.*

**Quality Metrics**:

- Total Coverage: 0%
- Total Files Modified: 0
- Total Tasks Completed: 0
