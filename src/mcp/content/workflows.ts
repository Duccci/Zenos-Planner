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
  {
    order: 1,
    title: 'Identify Proposal Type',
    description:
      'Determine whether this is a gate-tied or solitary proposal. Gate-tied proposals implement tasks within a specific gate; solitary proposals are standalone cross-cutting improvements.',
    actions: ['Review context: is there an active gate with a gateId?'],
    guidance:
      'If no gateId is provided and the work is cross-cutting (tooling, docs, security), default to solitary.',
  },
  {
    order: 2,
    title: 'Start / Read Gate Context',
    description:
      'For gate-tied proposals: call gates_action:start to ensure the gate is in_progress. Read the full gate PRD including Objectives, Requirements, Technical Decisions, and Acceptance Criteria.',
    prerequisites: ['Gate exists and is pending or in_progress'],
    actions: [
      'gates_action:start { gateId }',
      'Read zeno/gates/gate-XX-<name>.md',
      'zeno req list --gate <gateId> to see all requirements',
    ],
    errorHandling: 'If gate has unresolved dependencies, surface to user before proceeding.',
  },
  {
    order: 3,
    title: 'Read Existing Proposals',
    description:
      'Check for existing proposals for this gate to avoid duplication and identify gaps.',
    actions: [
      'proposal_action:list { gateId }',
      'Read existing proposal markdown files in zeno/proposals/gate-XX/',
    ],
  },
  {
    order: 4,
    title: 'Pre-Generation Gate Review',
    description:
      'Perform structured pre-review: flag open questions, verify requirements are complete and unambiguous, identify implicit assumptions, check dependencies for blockers.',
    actions: [
      'Call proposal_action:generate with preReview { gateReviewed, requirementsVerified, vagueRequirements, assumptionsDocumented, blockersIdentified }',
    ],
    errorHandling:
      'If blockers or vague requirements exist, document and request user clarification before generating.',
    guidance:
      'Enforced by PreReviewSchema: proposal_action:generate requires gateReviewed=true and requirementsVerified=true.',
  },
  {
    order: 5,
    title: 'Decompose Gate PRD into Proposals',
    description:
      'Break the gate objectives into one or more coherent, independently-deliverable proposals. Each proposal should be a single work unit that addresses a logical subset of requirements.',
    actions: [
      'Group related requirements and tasks',
      'Define proposal boundaries: can each proposal be approved/rejected independently?',
    ],
    guidance:
      'Proposals must be coherent work units. Do not create proposals that depend on changes in other pending proposals unless dependencies are explicitly documented.',
  },
  {
    order: 6,
    title: 'Generate Proposal Markdown Files',
    description:
      'Create proposal markdown files in zeno/proposals/gate-XX/ using the standard proposal template.',
    actions: [
      'Call proposal_action:generate for gate-tied proposals (or proposal_action:create for solitary)',
      'Populate: title, summary, context, tasks, filesAffected, acceptanceCriteria, dependencies',
    ],
    guidance:
      'Only markdown files; no code blocks, commands, or implementation. Use function/type names but never code snippets.',
  },
  {
    order: 7,
    title: 'Establish Dependencies',
    description:
      'Define dependency relationships between proposals. Document which proposals must be completed before this one can start.',
    actions: [
      'Populate the Dependencies section in each proposal',
      'Use hash references: #a3f9c2d1 format',
    ],
  },
  {
    order: 8,
    title: 'Validate Proposal Structure',
    description:
      'Call proposal_action:validate to run structural checks against the generated proposals.',
    actions: ['proposal_action:validate { hash } for each new proposal'],
    errorHandling: 'Fix any structural errors surfaced by validate before proceeding.',
  },
  {
    order: 9,
    title: 'Cross-Reference Architecture',
    description:
      'Review architecture diagrams to ensure proposals are consistent with the system design.',
    actions: ['Read zeno/architecture/ diagrams relevant to the gate'],
    guidance: 'Surface any inconsistencies between proposals and architecture diagrams to the user.',
  },
  {
    order: 10,
    title: 'Update Gate PRD',
    description:
      'Update the gate PRD to reflect the generated proposal structure and any clarifications discovered during decomposition.',
    actions: ['Edit zeno/gates/gate-XX-<name>.md to add proposal hash references if needed'],
  },
  {
    order: 11,
    title: 'Output Summary',
    description:
      'Present a summary of all generated proposals with: titles, hashes, file paths, requirement coverage, and next steps.',
    actions: ['List each proposal: hash, title, zeno/proposals/gate-XX/<filename>.md, requirements covered'],
    guidance:
      'Resolve all hashes to human-readable names in user-facing output. Never expose raw hash values without context.',
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
