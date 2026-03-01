/**
 * Workflow Constants — Step-by-step procedural guidance for MCP-driven workflows.
 *
 * Each exported array describes the ordered steps an agent should follow for a
 * given Zeno workflow.  These constants are injected into MCP responses so any
 * compliant agent receives up-to-date procedural guidance at the moment it needs
 * it, regardless of IDE or environment.
 */

export interface WorkflowStep {
  /** 1-based sequence number within this workflow */
  order: number
  /** Short title for the step, e.g. "Pre-Apply Review" */
  title: string
  /** Detailed description of what to do in this step */
  description: string
  /** Steps that must be complete before this one starts */
  prerequisites?: string[]
  /** Concrete actions to take — commands, tool calls, or file operations */
  actions?: string[]
  /** What to do when this step fails or is blocked */
  errorHandling?: string
  /** Additional notes or best-practice guidance for this step */
  guidance?: string
}

// ─── Apply Phase Workflow ─────────────────────────────────────────────────────
// Source: .claude/skills/zeno-apply/SKILL.md

export const APPLY_PHASE_WORKFLOW: WorkflowStep[] = [
  {
    order: 1,
    title: 'Pre-Apply Review',
    description:
      'Read the entire proposal carefully before writing any code. Flag open questions, unclear requirements, or contradictions. Verify all listed Files Affected exist (or are marked as new). Identify implicit assumptions and check Dependencies for blockers.',
    actions: [
      'Read zeno/proposals/gate-XX/<name>.md or zeno/proposals/solitary/<name>.md',
      'Call proposal_action:start with preReview populated',
    ],
    errorHandling:
      'If open questions, blockers, or unverified assumptions are found: document them and ask the user for clarification before proceeding.',
    guidance:
      'Do not begin implementation until preReview passes. This is enforced by the proposal_action:start schema (preReview.openQuestionsResolved, filesVerified, assumptionsDocumented, blockersIdentified).',
  },
  {
    order: 2,
    title: 'Read Implementation Sources',
    description:
      'Read existing source files that will be modified. Get a thorough understanding of the relevant code before making changes.',
    prerequisites: ['Pre-Apply Review accepted (proposal in_progress)'],
    actions: [
      'Read each file listed in Files Affected that already exists',
      'Use get_symbols_overview / find_symbol for large files instead of reading entire files',
    ],
    guidance:
      'Token-efficient reading: use symbolic tools first; only read symbol bodies you will modify.',
  },
  {
    order: 3,
    title: 'Check Dependencies',
    description:
      'Review the Dependencies table (if present). Confirm that all prerequisite proposals/gates are completed. Do not pre-empt work that belongs to other proposals.',
    actions: ['Call zeno req deps <hash> for each listed dependency if unclear'],
    errorHandling:
      'If a blocker is found, surface it to the user and wait for guidance before continuing.',
    guidance: 'Review dependencies for context only — do not implement their work.',
  },
  {
    order: 4,
    title: 'Start Proposal',
    description:
      'Transition the proposal to in_progress and, if applicable, create an isolated git worktree for implementation.',
    prerequisites: ['Pre-Apply Review passed'],
    actions: [
      'proposal_action:start { hash: "<hash>", preReview: { ... } }',
      'Note the worktree path returned for gate-tied proposals',
    ],
    errorHandling:
      'If the proposal is already in_progress, this step is a no-op; continue with implementation.',
  },
  {
    order: 5,
    title: 'Implement Tasks',
    description:
      'Execute each numbered task in the proposal in sequence. Report progress after each task with proposal_action:progress.',
    prerequisites: ['Proposal in_progress'],
    actions: [
      'Implement changes only to files listed in Files Affected',
      'After each task: proposal_action:progress { hash, currentTask, filesModified, notes }',
      'If scope expansion needed: document in scopeExpansion field and request user approval',
    ],
    errorHandling:
      'Scope expansion without approval is blocked. Document proposed additions and wait for human confirmation.',
    guidance:
      'Implement straightforward solutions. Avoid large refactors or unrelated changes. For solitary proposals, include inline test files as part of the proposal.',
  },
  {
    order: 6,
    title: 'Write Completion Summary',
    description:
      'After all tasks are complete, add a Completion Summary section to the proposal file documenting what was accomplished, any deviations from plan, and final quality metrics.',
    prerequisites: ['All tasks implemented'],
    actions: [
      'Add ## Completion Summary section to the proposal markdown file',
      'Include: what was done, files changed, any scope changes, quality metrics',
    ],
  },
  {
    order: 7,
    title: 'Update Requirements',
    description:
      'For solitary proposals: mark requirements as implemented directly. For gate-tied proposals: requirement status updates are deferred to gate completion.',
    actions: [
      'Solitary: zeno req status <req-hash> implemented (for each listed requirement)',
      'Gate-tied: no action — handled at gates_action:complete',
    ],
    guidance:
      'Solitary proposals have no parent gate; requirement tracking is mandatory at proposal level.',
  },
  {
    order: 8,
    title: 'Run Quality Checks',
    description:
      'Run the full test suite, TypeScript compiler, and linting. Check coverage thresholds from config_get().',
    actions: [
      'npx tsc --noEmit',
      'npx vitest run',
      'npm run lint',
      'proposal_action:validate { hash: "<hash>" }',
    ],
    errorHandling:
      'If automated checks fail, do not proceed to approval. Fix issues or wait for human guidance.',
    guidance: 'Use quality thresholds from config_get() — never hard-code coverage percentages.',
  },
  {
    order: 9,
    title: 'Request Approval',
    description:
      'Submit the proposal for human review. If all automated checks pass, wait for the human to approve.',
    actions: ['proposal_action:validate { hash } — present results to user'],
    errorHandling:
      'If human rejects: rework per feedback, then restart from step 5 (or step 1 if scope changes).',
    guidance:
      'Do not self-approve. Gate-tied proposals: approval triggers worktree merge. Solitary proposals: approval finalises the proposal status.',
  },
]

// ─── Proposal Generation Workflow ─────────────────────────────────────────────
// Source: .claude/skills/zeno-proposal/SKILL.md

export const PROPOSAL_GENERATION_WORKFLOW: WorkflowStep[] = [
  // Step 1 is context: scaffold files already exist on disk from the tool call.
  // This step is NOT an action — it constrains what the agent must NOT do.
  {
    order: 1,
    title: 'Scaffold Files Are Ready',
    description:
      'Scaffold proposal markdown files have been written to zeno/proposals/gate-XX/. Each file has the correct RED/GREEN structure, requirements, and task skeleton. Your only job from here is to fill in the placeholders — do NOT delete, recreate, replace, or batch-script-modify these files.',
    guidance:
      'Files exist on disk with real titles, hashes, gate IDs, and creation dates. Proceed directly to step 2: read the gate PRD.',
  },
  {
    order: 2,
    title: 'Read Gate Context',
    description:
      'Read the full gate PRD to gather the objectives, requirements, technical decisions, and acceptance criteria needed to fill in each proposal.',
    actions: [
      'Read zeno/gates/gate-XX-<name>.md (the gate PRD for this gate)',
      'Note each objective and its related requirements',
      'Identify technical decisions and constraints that inform proposal content',
    ],
    guidance:
      'You need this context before editing any proposal. Gather it once, then use it across all proposals.',
  },
  {
    order: 3,
    title: 'Fill In Proposals One-by-One',
    description:
      'For EACH scaffold proposal file (in the order listed), open the file, read it, and DIRECTLY EDIT it using your file-editing tools. Replace all bracketed placeholders ([...]) with concrete, gate-specific content. Do this one proposal at a time — do not batch or script.',
    actions: [
      'Open the proposal file with your read tool',
      'Replace [Proposal Title] with a descriptive title reflecting the objective it addresses',
      'Write a concrete Summary (2-3 sentences) referencing the specific gate objective',
      'Fill in Context / Why This Change with rationale from the gate PRD',
      'Refine the Tasks section: add specific file paths, function/type names, and detailed acceptance criteria',
      'Populate the Files Affected table with actual repository file paths',
      'Set the Dependencies section using hash references (#xxx) to other proposals in this gate',
      'Move to the next proposal file and repeat',
    ],
    guidance:
      'Edit each file DIRECTLY — never create scripts, batch processors, or helper programs to do this. The RED proposal (first file) should describe the test suite. Implementation proposals (middle files) describe feature work. The GREEN proposal (last file) describes test verification. Preserve the existing RED/GREEN structure and requirements list; only fill in the bracketed placeholders and refine task details.',
  },
  {
    order: 4,
    title: 'Validate Proposal Structure',
    description:
      'Call proposal_action:validate to run structural checks against the generated proposals.',
    actions: ['proposal_action:validate { hash } for each proposal'],
    errorHandling: 'Fix any structural errors surfaced by validate before proceeding.',
  },
  {
    order: 5,
    title: 'Output Summary',
    description:
      'Present a summary of all generated proposals with: titles, hashes, file paths, requirement coverage, and next steps.',
    actions: ['List each proposal: hash, title, zeno/proposals/gate-XX/<filename>.md, requirements covered'],
    guidance:
      'Resolve all hashes to human-readable names in user-facing output. Never expose raw hash values without context.',
  },
  {
    order: 6,
    title: 'Render Proposal Dependency Graph',
    description:
      'After all proposals and their dependencies are established, render a Mermaid graph (left-to-right) showing every proposal as a node and each requires/blocks relationship as a directed edge. This graph gives the user a visual overview of the execution order before implementation begins.',
    actions: [
      'Collect all proposals for this gate (title only — no hashes in the diagram)',
      'Collect all dependency relationships (requires/blocks) from each proposal\'s Dependencies section',
      'Render as a Mermaid diagram using `graph LR` direction',
      'Each node ID: camelCase or short slug derived from the proposal title (e.g., "schemaMigration")',
      'Each node label: plain text title in quotes (e.g., `schemaMigration["Schema Migration"]`)',
      'Each dependency edge: `A --> B` using node IDs (A must complete before B)',
      'Standalone proposals (no dependencies): include as isolated nodes',
      'Never use hash values (#abc123) as node IDs or labels',
    ],
    guidance:
      'Use graph LR so the diagram reads left-to-right reflecting execution order. All node IDs and labels must be human-readable titles — never raw hashes. Example:\n\n```mermaid\ngraph LR\n  schemaMigration["Schema Migration"]\n  repositoryCrud["Repository CRUD"]\n  cliCommands["CLI Commands"]\n  tests["Tests"]\n  schemaMigration --> repositoryCrud\n  repositoryCrud --> cliCommands\n  repositoryCrud --> tests\n```',
  },
]

// ─── Gate Generation Workflow ──────────────────────────────────────────────────
// Source: .claude/skills/zeno-gate/SKILL.md

export const GATE_GENERATION_WORKFLOW: WorkflowStep[] = [
  {
    order: 1,
    title: 'Determine Gate Generation Mode',
    description:
      'Determine whether this is: (A) initial gate generation from PRD, (B) rebaseline/rescope of future gates, or (C) starting a specific pending gate.',
    actions: ['gates_action:list to see current gate state'],
    guidance:
      'Mode A: zeno init or first gates_action:generate. Mode B: zeno rescope. Mode C: gates_action:start for a specific gate.',
  },
  {
    order: 2,
    title: 'Gather Project Context',
    description:
      'Read the project PRD, existing architecture diagrams, and current requirements. Understand the full project scope before generating gates.',
    prerequisites: ['Project initialized (zeno/.zeno/config.json exists)'],
    actions: [
      'Read zeno/PROJECT_PRD.md',
      'Read zeno/architecture/system-overview.md and data-flow.md',
      'zeno req list to see all project-level requirements',
    ],
    guidance: 'Requirements-first: all project-level requirements must be defined before gates are generated.',
  },
  {
    order: 3,
    title: 'Analyze Current State',
    description:
      'Assess which gates are completed, in_progress, or pending. For rescope scenarios, identify the boundary between past work and future gates.',
    actions: [
      'gates_action:list',
      'gates_action:show <id> for each in_progress gate',
      'zeno req deps <hash> for requirements with complicated dependencies',
    ],
    errorHandling:
      'If a gate is in_progress and rescope is requested, surface the conflict to the user before regenerating.',
  },
  {
    order: 4,
    title: 'Define Gate Boundaries',
    description:
      'Identify concrete, independently-deliverable milestones. Each gate must have a clear objective that can be verified as complete or not complete.',
    actions: ['Draft gate objectives as binary deliverables, not percentages'],
    errorHandling:
      'If scope is vague, ask clarifying questions before defining gate boundaries. Never proceed with a vague scope.',
    guidance:
      'Gates are concrete deliverables. "API layer complete" is a gate; "50% API work done" is not.',
  },
  {
    order: 5,
    title: 'Generate Gate Sequence',
    description:
      'Define the ordered sequence of gates, each decomposing the project state further (Zeno dichotomy-inspired). Call gates_action:generate with the preReview pre-condition populated.',
    prerequisites: ['Project context read (step 2)', 'Gate boundaries defined (step 4)'],
    actions: [
      'gates_action:generate { preReview: { gateReviewed: true, requirementsVerified: true, ... } }',
    ],
    errorHandling:
      'preReview is required for gates_action:generate. If omitted, the handler will return a structured error explaining required fields.',
    guidance: 'Let Zeno handle ID assignment. Focus on ordering and dependency chains.',
  },
  {
    order: 6,
    title: 'Create Gate PRD Files',
    description:
      'Write the gate PRD markdown files. Each file must include: Objectives (unchecked [ ] boxes), Requirements, Technical Decisions, Acceptance Criteria.',
    actions: [
      'Create zeno/gates/gate-XX-<name>.md for each gate',
      'All objectives use [ ] (never [x]) for new gates',
    ],
    guidance:
      'Validated by artifact-validator.ts: unchecked [ ] boxes are required on pending gates.',
  },
  {
    order: 7,
    title: 'Handle Rebaseline (if rescope)',
    description:
      'For rescope/rebaseline: create a rescope gate documenting the change and regenerate all future gates from the current position.',
    actions: ['gates_action:regenerate', 'Document rescope rationale in a new rescope gate PRD'],
    guidance:
      'Do not regenerate past/completed gates. The boundary is the most-recently-completed gate.',
  },
  {
    order: 8,
    title: 'Update Architecture Diagrams',
    description:
      'Regenerate or update architecture diagrams that reflect the new gate roadmap.',
    actions: ['Update zeno/architecture/gate-roadmap.md'],
    guidance: 'Use Mermaid for simple diagrams (≤5 elements); DOT/SVG for complex ones.',
  },
  {
    order: 9,
    title: 'Attribute Requirements to Gates',
    description:
      'Ensure every project-level requirement is attributed to at least one gate. Cross-cutting requirements may span multiple gates.',
    actions: ['zeno req list to check each requirement has a referenced gate'],
    errorHandling:
      'If any requirement is unattributed, add it to an appropriate gate or create a new gate for it.',
  },
  {
    order: 10,
    title: 'Validate Structure',
    description:
      'Run structural validation on all generated gate markdown files.',
    actions: ['gates_action:validate if available, or check manually against PRD template'],
    errorHandling: 'Fix structural errors before surfacing gates to the user.',
  },
  {
    order: 11,
    title: 'Output Summary',
    description:
      'Present a summary of all generated or updated gates: IDs, titles, objectives, dependencies, and next steps.',
    actions: [
      'List each gate: gateId, title, status, key objectives, gateFile path',
      'Identify which gate is the recommended starting point',
    ],
    guidance:
      'Resolve all hashes to human-readable names in user-facing output.',
  },
]

// ─── Archival Workflow ────────────────────────────────────────────────────────
// Source: .claude/skills/zeno-archive/SKILL.md (both Gate Archive and Proposal Archive)

export const ARCHIVAL_WORKFLOW: WorkflowStep[] = [
  // ── Gate Archive Steps ──────────────────────────────────────────────────────
  {
    order: 1,
    title: 'Validate Gate Readiness',
    description:
      'Before archiving, verify the gate is completed: all proposals done, all requirements at "tested" status, all quality gates met.',
    actions: [
      'gates_action:show { gateId } — check status === "completed"',
      'zeno req list --gate <gateId> — verify all requirements are "tested"',
      'proposal_action:list { gateId } — verify all proposals are "completed" or "archived"',
    ],
    errorHandling:
      'If gate is not completed, or requirements are not tested, report what is incomplete and stop.',
    guidance:
      'Enforced by createStateTransitionValidator: gates_action:complete validates preconditions before transitioning.',
  },
  {
    order: 2,
    title: 'Consolidate Gate Proposals',
    description:
      'Extract and aggregate from all completed proposals: requirements fulfilled (deduplicated), implementation metrics, lessons learned, and next dependencies.',
    actions: [
      'Read each proposal in zeno/proposals/gate-XX/',
      'Extract requirement hashes, implementation notes, and quality metrics',
      'Deduplicate and aggregate',
    ],
    guidance: 'Consolidation utility: src/utils/gate-consolidation.ts.',
  },
  {
    order: 3,
    title: 'Create Gate Completion Summary',
    description:
      'Write the gate completion summary in the gate PRD with: requirements fulfilled, aggregate quality metrics, lessons learned, and unblocked next gates.',
    actions: ['Add ## Completion Summary section to zeno/gates/gate-XX-<name>.md'],
  },
  {
    order: 4,
    title: 'Archive Gate to Completed Directory',
    description:
      'Call gates_action:complete to transition the gate to completed status and move proposal artifacts to archive.',
    actions: ['gates_action:complete { gateId }'],
    guidance: 'Archived artifacts are immutable; create a new proposal if changes are needed.',
  },
  {
    order: 5,
    title: 'Create Git Tag and Commit',
    description:
      'Create a git tag for the gate release and commit all archival changes.',
    prerequisites: ['Gate completion summary written', 'All artifacts updated'],
    actions: [
      'config_get() to retrieve git.commitFormat, git.remote, version',
      'Construct commit: feat(gate): archive gate-XX - <name> (#<hash>)',
      'git tag vX.Y.Z-gate-XX',
      'git push <remote> --tags',
    ],
    guidance:
      'Use git.commitFormat from config_get(). Include gate hash in commit body for traceability.',
  },

  // ── Proposal Archive Steps ──────────────────────────────────────────────────
  {
    order: 6,
    title: 'Validate Proposal is Ready for Archive',
    description:
      'Verify proposal status is "completed". Confirm all Tasks have [ ] acceptance criteria marked [x]. Confirm all automated checks have passed.',
    actions: [
      'proposal_action:show { hash } — check status === "completed"',
      'Read proposal markdown — all task checkboxes must be [x]',
    ],
    errorHandling: 'If validation fails, report what is incomplete and stop.',
  },
  {
    order: 7,
    title: 'Update Requirements and Dependent Artifacts',
    description:
      'For gate-tied proposals: mark each listed requirement as tested. Update any dependent proposals or gates that were waiting on this one.',
    actions: [
      'zeno req status <req-hash> tested (for each requirement in the proposal)',
      'Check proposals that listed this one as a dependency — notify they are now unblocked',
    ],
    guidance:
      'Gate-tied only. Solitary proposals: requirement tracking not applicable at proposal level.',
  },
  {
    order: 8,
    title: 'Clean Up Proposal Document',
    description:
      'Update the proposal file with completion metadata: Status, Implemented date, Archived date, Archived By.',
    actions: [
      'Update proposal markdown: Status: completed, Implemented: [DATE], Archived: [DATE]',
      'Add Completion Summary section if not already present',
    ],
  },
  {
    order: 9,
    title: 'Move Proposal to Archive',
    description:
      'Move or record the proposal in the appropriate archive location. Gate-tied proposals move to zeno/proposals/archive/; solitary proposals are recorded in zeno/gates/archive/solitary.md.',
    actions: [
      'Gate-tied: proposal_action:approve { hash } triggers automatic archival',
      'Solitary: add entry to zeno/gates/archive/solitary.md with hash and 2-3 sentence summary',
    ],
    guidance:
      'Solitary proposals consolidate into a single registry file; gate-tied proposals maintain individual archives.',
  },
  {
    order: 10,
    title: 'Commit Archival Changes',
    description:
      'Commit all archival changes with a structured commit message referencing the proposal hash.',
    actions: [
      'config_get() to retrieve git.commitFormat and git.remote',
      'Stage all changes: git add -A',
      'Commit: chore(gate-XX): archive proposal <title> (#<hash>)',
      'git push <remote> <current-branch>',
    ],
    guidance:
      'Include the proposal hash in the commit message for full traceability via git log --grep.',
  },
]

// ─── Validate Post-Response Workflow ──────────────────────────────────────────
// Injected into proposal_action:validate responses so agents know unambiguously
// what to do next and don't confuse a passed result with implementation authorization.

export const VALIDATE_WORKFLOW: WorkflowStep[] = [
  {
    order: 1,
    title: 'Interpret Validation Result',
    description:
      'Validation has run. Stop here — DO NOT edit any source files or proceed to implementation based solely on this result.',
    actions: [
      'If passed: true  → proceed to step 2',
      'If passed: false → fix every error/warning listed in issues[], then call proposal_action:validate again before proceeding',
    ],
    errorHandling:
      'Do not proceed to step 2 if any issue has level: "error". Warnings are advisory; errors are blocking.',
  },
  {
    order: 2,
    title: 'Start Implementation',
    description:
      'Validation passed. Call proposal_action:start to transition the proposal to in_progress, complete the pre-apply review, and unlock implementation. This step is mandatory — skipping it bypasses state transition, preReview enforcement, and apply-phase guardrail injection.',
    actions: [
      'proposal_action:start { hash: "<hash>", preReview: { phase: "apply", openQuestionsResolved: <bool>, questionsFound: [], assumptionsDocumented: [], blockersIdentified: [], filesVerified: <bool> } }',
    ],
    errorHandling:
      'If start is rejected: address the preReview issues surfaced in the error and retry. Never skip start.',
    guidance:
      'proposal_action:start injects the full apply-phase guardrails and workflow into its response — that guidance governs all subsequent implementation steps.',
  },
]

// ─── Response Helper ───────────────────────────────────────────────────────────

/**
 * Strips verbose optional fields from workflow steps for injection into MCP
 * response payloads.
 *
 * `prerequisites`, `actions`, `errorHandling`, and `guidance` duplicate
 * information already present in the tool's Zod schema and validation error
 * messages.  Sending only `order`, `title`, and `description` gives the LLM
 * the procedural sequence it needs at minimal token cost.
 *
 * @returns Compact step objects safe to embed in any MCP response.
 */
export function toCompactWorkflow(
  steps: WorkflowStep[]
): { order: number; title: string; description: string }[] {
  return steps.map(({ order, title, description }) => ({ order, title, description }))
}
