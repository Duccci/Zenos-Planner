/**
 * Guardrail Constants — Single Authoritative Source of Truth
 *
 * All guardrails from all workflow SKILL.md files are represented here as
 * typed TypeScript constants. MCP tool handlers inject these into structured
 * responses so any agent receives guidance regardless of IDE or tool.
 *
 * Guardrails are split by topic. Each entry declares whether it must have a
 * runtime validator (`mustHaveValidator`) and, if so, which file implements it
 * (`validatorRef`). Entries with `mustHaveValidator: false` are narrative-only:
 * they describe design principles, approval gates, or human judgment calls.
 */

export interface GuardrailEntry {
  /** Unique stable ID, e.g. 'apply-001' */
  id: string
  /** Workflow domain this guardrail belongs to */
  topic: 'apply-phase' | 'proposal-generation' | 'archival' | 'gate-generation'
  /** The full guardrail rule as stated in the SKILL.md */
  rule: string
  /** True when a runtime validator enforces this rule */
  mustHaveValidator: boolean
  /** e.g. 'scope-validator.ts#validateScope' — required when mustHaveValidator is true */
  validatorRef?: string
  /** Explanation of why it is or isn't validator-enforced */
  reason: string
  /**
   * Agent(s) from agents/categories/ to consult or delegate to when this
   * narrative guardrail fires. Drawn from 04-quality-security and
   * 09-meta-orchestration so vague principles have a concrete escalation path.
   * Format: '<category-slug>/<agent-name>' — matches the agent's .md filename.
   */
  agentRef?: string[]
}

// ─── Apply Phase Guardrails ────────────────────────────────────────────────────
// Source: .claude/skills/zeno-apply/SKILL.md — Pre-Apply Review + Implementation Constraints

export const APPLY_PHASE_GUARDRAILS: GuardrailEntry[] = [
  // Pre-Apply Review
  {
    id: 'apply-001',
    topic: 'apply-phase',
    rule: 'Flag any open questions, unclear requirements, or contradictory statements in the Summary, Context, or Tasks sections. If found, document them and ask the user for clarification before proceeding.',
    mustHaveValidator: true,
    validatorRef: 'proposal-tools.ts#validators.start (preReview.openQuestionsResolved)',
    reason: 'Enforced via PreReviewSchema: proposal_action:start requires preReview.openQuestionsResolved and preReview.questionsFound',
  },
  {
    id: 'apply-002',
    topic: 'apply-phase',
    rule: 'Verify all Files Affected exist (or are explicitly marked as new files). If a file path references a non-existent directory structure, flag it and request confirmation.',
    mustHaveValidator: true,
    validatorRef: 'proposal-tools.ts#validators.start (preReview.filesVerified)',
    reason: 'Enforced via PreReviewSchema: proposal_action:start requires preReview.filesVerified',
  },
  {
    id: 'apply-003',
    topic: 'apply-phase',
    rule: 'Identify any implicit assumptions in the proposal (e.g., "assume X is already installed", "assume database schema exists"). List assumptions and ask the user to confirm they are correct before implementation begins.',
    mustHaveValidator: true,
    validatorRef: 'proposal-tools.ts#validators.start (preReview.assumptionsDocumented)',
    reason: 'Enforced via PreReviewSchema: proposal_action:start requires preReview.assumptionsDocumented',
  },
  {
    id: 'apply-004',
    topic: 'apply-phase',
    rule: 'Check Dependencies table (if present) for any blockers marked as incomplete. If found, document the blocker and wait for user guidance before proceeding.',
    mustHaveValidator: true,
    validatorRef: 'proposal-tools.ts#validators.start (preReview.blockersIdentified)',
    reason: 'Enforced via PreReviewSchema: proposal_action:start requires preReview.blockersIdentified; warning returned if blockers present',
  },

  // Implementation Constraints
  {
    id: 'apply-005',
    topic: 'apply-phase',
    rule: 'Assume user approval: proposals are reviewed and approved before apply begins (no separate approval step required)',
    mustHaveValidator: false,
    reason: 'Process assumption: documented in approval workflow; not a runtime constraint',
    agentRef: ['09-meta-orchestration/workflow-orchestrator'],
  },
  {
    id: 'apply-006',
    topic: 'apply-phase',
    rule: 'Implement straightforward solutions; add complexity only when required',
    mustHaveValidator: false,
    reason: 'Design principle: agent guidance, not a system-enforceable constraint',
    agentRef: ['04-quality-security/code-reviewer', '04-quality-security/architect-reviewer'],
  },
  {
    id: 'apply-007',
    topic: 'apply-phase',
    rule: 'Keep changes tightly scoped to proposal tasks',
    mustHaveValidator: false,
    reason: 'Design principle: scope discipline; reinforced by validateScope but "tightly scoped" is subjective',
    agentRef: ['09-meta-orchestration/task-distributor', '04-quality-security/code-reviewer'],
  },
  {
    id: 'apply-008',
    topic: 'apply-phase',
    rule: 'Only modify files and target objects explicitly listed in the proposal\'s Files Affected or the task description. Avoid unrelated edits or large refactors.',
    mustHaveValidator: true,
    validatorRef: 'scope-validator.ts#validateScope',
    reason: 'Enforced by scope-validator.ts#validateScope: files not in filesAffected are rejected',
  },
  {
    id: 'apply-009',
    topic: 'apply-phase',
    rule: 'All Files Affected entries must be explicit file paths — wildcards (*.ts) and directory references (src/dir/) are rejected by validateScope.validateExplicitPaths.',
    mustHaveValidator: true,
    validatorRef: 'scope-validator.ts#validateExplicitPaths',
    reason: 'Enforced by scope-validator.ts#validateExplicitPaths: glob patterns and directory paths are rejected at proposal_action:start',
  },
  {
    id: 'apply-010',
    topic: 'apply-phase',
    rule: 'Limit test changes to those that directly validate the updated target objects; do not broadly alter the test suite without explicit approval.',
    mustHaveValidator: false,
    reason: 'Approval gate: validation falls to human review + automated coverage checks; "directly validates" is subjective',
    agentRef: ['04-quality-security/qa-expert', '04-quality-security/test-automator'],
  },
  {
    id: 'apply-011',
    topic: 'apply-phase',
    rule: 'Gate-tied proposals: Do not create or modify test files unless the proposal is the gate\'s dedicated test proposal.',
    mustHaveValidator: true,
    validatorRef: 'scope-validator.ts#validateTestFileScope',
    reason: 'Enforced by scope-validator.ts#validateTestFileScope: gate-tied proposals may not list test files in filesAffected',
  },
  {
    id: 'apply-012',
    topic: 'apply-phase',
    rule: 'Solitary proposals: Tests are included inline and must be implemented as part of the proposal.',
    mustHaveValidator: true,
    validatorRef: 'scope-validator.ts#validateTestFileScope',
    reason: 'Enforced by scope-validator.ts#validateTestFileScope: solitary proposals receive a warning if no test files are in filesAffected',
  },
  {
    id: 'apply-013',
    topic: 'apply-phase',
    rule: 'Solitary proposals – Requirement updates: Solitary proposals have no parent gate and must directly update requirements via zeno req status <hash> implemented (not through gate completion).',
    mustHaveValidator: false,
    reason: 'Process instruction: operational procedure for requirement tracking; not a runtime constraint',
    agentRef: ['09-meta-orchestration/workflow-orchestrator', '09-meta-orchestration/context-manager'],
  },
  {
    id: 'apply-014',
    topic: 'apply-phase',
    rule: 'If a task requires expanding the scope (additional files, refactors, or cross-cutting changes), document the proposed additions in the implementation output and obtain human approval before making those changes.',
    mustHaveValidator: true,
    validatorRef: 'proposal-tools.ts#validators.progress (scopeExpansion)',
    reason: 'Structured via scopeExpansion field: proposal_action:progress accepts scopeExpansion to document scope changes; enforcement relies on field presence',
  },
  {
    id: 'apply-015',
    topic: 'apply-phase',
    rule: 'Review dependencies for context only; do not act on, implement, or pre-empt work that belongs to other proposals or later gates.',
    mustHaveValidator: false,
    reason: 'Behavioral principle: agent workflow guidance; no deterministic validator can enforce intent',
    agentRef: ['09-meta-orchestration/multi-agent-coordinator', '09-meta-orchestration/context-manager'],
  },
  {
    id: 'apply-016',
    topic: 'apply-phase',
    rule: 'Use quality thresholds from config_get() instead of hard-coded values',
    mustHaveValidator: false,
    reason: 'Development practice: configuration hygiene; validated at quality check time via quality-validator.ts',
    agentRef: ['09-meta-orchestration/performance-monitor', '04-quality-security/code-reviewer'],
  },
  {
    id: 'apply-017',
    topic: 'apply-phase',
    rule: 'Wait for human approval if automated checks fail',
    mustHaveValidator: false,
    reason: 'Approval gate: human decision point; documented in workflow, not a runtime constraint',
    agentRef: ['09-meta-orchestration/workflow-orchestrator', '09-meta-orchestration/error-coordinator'],
  },
  {
    id: 'apply-018',
    topic: 'apply-phase',
    rule: 'No git operations during apply phase — MCP tools automatically validate: proposal_action:start and proposal_action:approve both call validateApplyPhase which blocks if git operations are detected.',
    mustHaveValidator: true,
    validatorRef: 'apply-phase-validator.ts#validateApplyPhase',
    reason: 'Enforced by apply-phase-validator.ts#validateApplyPhase: git operations during apply phase are rejected',
  },
  {
    id: 'apply-019',
    topic: 'apply-phase',
    rule: 'DO NOT rename proposal files — proposals remain in active proposals directory until gate completion',
    mustHaveValidator: false,
    reason: 'File convention: human enforces via git review; inexpensive to violate and caught in git review',
    agentRef: ['09-meta-orchestration/workflow-orchestrator'],
  },
  {
    id: 'apply-020',
    topic: 'apply-phase',
    rule: 'DO NOT move proposal files to archive — archival happens automatically when gate is completed',
    mustHaveValidator: false,
    reason: 'File convention: archival is automatic at gate completion; this prevents premature manual moves',
    agentRef: ['09-meta-orchestration/workflow-orchestrator'],
  },
]

// ─── Proposal Generation Guardrails ───────────────────────────────────────────
// Source: .claude/skills/zeno-proposal/SKILL.md — Pre-Generation Gate Review + Constraints

export const PROPOSAL_GENERATION_GUARDRAILS: GuardrailEntry[] = [
  // Pre-Generation Gate Review
  {
    id: 'proposal-001',
    topic: 'proposal-generation',
    rule: 'Read the entire Gate PRD (Objectives, Requirements, Technical Decisions, Acceptance Criteria). Flag any open questions, unclear requirements, or contradictory statements.',
    mustHaveValidator: true,
    validatorRef: 'proposal-tools.ts#validators.generate (preReview.gateReviewed)',
    reason: 'Enforced via PreReviewSchema: proposal_action:generate requires preReview.gateReviewed',
  },
  {
    id: 'proposal-002',
    topic: 'proposal-generation',
    rule: 'Verify all Requirements listed in the gate are complete and unambiguous. If a requirement has vague acceptance criteria, flag it and ask for quantified metrics before proceeding.',
    mustHaveValidator: true,
    validatorRef: 'proposal-tools.ts#validators.generate (preReview.requirementsVerified)',
    reason: 'Enforced via PreReviewSchema: proposal_action:generate requires preReview.requirementsVerified; vagueRequirements blocks if requirementsVerified is false',
  },
  {
    id: 'proposal-003',
    topic: 'proposal-generation',
    rule: 'Identify any implicit assumptions in the gate PRD. List assumptions and ask the user to confirm they are correct before proposal generation.',
    mustHaveValidator: true,
    validatorRef: 'proposal-tools.ts#validators.generate (preReview.assumptionsDocumented)',
    reason: 'Enforced via PreReviewSchema: proposal_action:generate requires preReview.assumptionsDocumented',
  },
  {
    id: 'proposal-004',
    topic: 'proposal-generation',
    rule: 'Check if any gate dependencies are incomplete or blocked. If so, document the blocker and request user guidance before proceeding with proposal generation.',
    mustHaveValidator: true,
    validatorRef: 'proposal-tools.ts#validators.generate (preReview.blockersIdentified)',
    reason: 'Enforced via PreReviewSchema: proposal_action:generate requires preReview.blockersIdentified; warning returned if blockers present',
  },

  // Proposal Generation Constraints
  {
    id: 'proposal-005',
    topic: 'proposal-generation',
    rule: 'Only create markdown in zeno/proposals/gate-XX/; no code, files, or commands',
    mustHaveValidator: true,
    validatorRef: 'scope-validator.ts#validateMarkdownOnly',
    reason: 'Enforced by scope-validator.ts#validateMarkdownOnly: non-.md entries in filesAffected during generate actions are rejected',
  },
  {
    id: 'proposal-006',
    topic: 'proposal-generation',
    rule: 'Keep proposals as single coherent work units with status pending',
    mustHaveValidator: false,
    reason: 'Design principle: proposal decomposition guidance; coherence is subjective, human-reviewed',
  },
  {
    id: 'proposal-007',
    topic: 'proposal-generation',
    rule: 'Decompose Gate PRD steps into tasks; describe changes without implementing',
    mustHaveValidator: false,
    reason: 'Methodology: proposal generation approach; enforced by template and human review',
  },
  {
    id: 'proposal-008',
    topic: 'proposal-generation',
    rule: 'NO: implementation code, inline code snippets, terminal commands, file modifications, new requirements in proposal files',
    mustHaveValidator: false,
    reason: 'Content rules: proposal-generation guidelines; human enforces via review',
  },
  {
    id: 'proposal-009',
    topic: 'proposal-generation',
    rule: 'YES: markdown files, task decomposition, acceptance criteria, function/type names (no code blocks)',
    mustHaveValidator: false,
    reason: 'Content rules: defines what is appropriate in proposals; human-reviewed',
  },
  {
    id: 'proposal-010',
    topic: 'proposal-generation',
    rule: 'Review dependencies for context only; do not implement or pre-empt work that belongs to other proposals or later gates.',
    mustHaveValidator: false,
    reason: 'Behavioral principle: agent workflow guidance; no deterministic validator can enforce intent',
  },
]

// ─── Gate Generation Guardrails ───────────────────────────────────────────────
// Source: .claude/skills/zeno-gate/SKILL.md

export const GATE_GENERATION_GUARDRAILS: GuardrailEntry[] = [
  {
    id: 'gate-001',
    topic: 'gate-generation',
    rule: 'Create gate PRDs and update artifacts only; no implementation code',
    mustHaveValidator: true,
    validatorRef: 'scope-validator.ts#validateMarkdownOnly',
    reason: 'Enforced by scope-validator.ts#validateMarkdownOnly: non-.md entries in filesAffected during gates_action:generate are rejected',
  },
  {
    id: 'gate-002',
    topic: 'gate-generation',
    rule: 'Gates are concrete deliverables, not percentages or time estimates',
    mustHaveValidator: false,
    reason: 'Definitional principle: describes gate semantics; no deterministic validator applicable',
  },
  {
    id: 'gate-003',
    topic: 'gate-generation',
    rule: 'All gate objectives must have unchecked [ ] boxes; only completed gates have [x]',
    mustHaveValidator: true,
    validatorRef: 'artifact-validator.ts',
    reason: 'Enforced by artifact-validator.ts: format checks verify unchecked objective boxes on pending gates',
  },
  {
    id: 'gate-004',
    topic: 'gate-generation',
    rule: 'Requirements-first: defined at project inception; gates attribute existing requirements',
    mustHaveValidator: false,
    reason: 'Process principle: requirement lifecycle guidance; validated via zeno req list checks, not a runtime constraint',
  },
  {
    id: 'gate-005',
    topic: 'gate-generation',
    rule: 'Identify vague scopes and ask clarifying questions before proceeding',
    mustHaveValidator: false,
    reason: 'Interaction instruction: agent behavior principle; "vague" is subjective, human-judged',
  },
  {
    id: 'gate-006',
    topic: 'gate-generation',
    rule: 'Review dependencies for context only; do not implement or pre-empt work that belongs to other proposals or later gates. Document incomplete dependencies and notify a human for clarification.',
    mustHaveValidator: false,
    reason: 'Behavioral principle: agent workflow guidance; no deterministic validator can enforce intent',
  },
  {
    id: 'gate-007',
    topic: 'gate-generation',
    rule: 'Read the project requirements and gate PRD before generating gates. Flag open questions, unclear requirements, or unresolved blockers.',
    mustHaveValidator: true,
    validatorRef: 'gate-tools.ts#validators.generate (preReview.gateReviewed + preReview.requirementsVerified)',
    reason: 'Enforced via PreReviewSchema: gates_action:generate requires preReview with gateReviewed and requirementsVerified',
  },
]

// ─── Archival Guardrails ───────────────────────────────────────────────────────
// Source: .claude/skills/zeno-archive/SKILL.md

export const ARCHIVAL_GUARDRAILS: GuardrailEntry[] = [
  {
    id: 'archive-001',
    topic: 'archival',
    rule: 'Archive only when status is completed; proposals: all tasks done with [x] marks; gates: all requirements tested',
    mustHaveValidator: true,
    validatorRef: 'entity-action-handler.ts#createStateTransitionValidator',
    reason: 'Enforced by createStateTransitionValidator: gates_action:complete and proposal_action:approve validate status before transitioning',
  },
  {
    id: 'archive-002',
    topic: 'archival',
    rule: 'Gate types: gate-01 (gates); #p01... or filename (gate-tied proposals); #s20260115... (solitary)',
    mustHaveValidator: false,
    reason: 'Notation convention: describes hash/reference formats; informational only',
  },
  {
    id: 'archive-003',
    topic: 'archival',
    rule: 'Update dependent artifacts; preserve audit trail',
    mustHaveValidator: false,
    reason: 'Archival methodology: human responsibility during gate completion; covered by gate completion procedure',
  },
  {
    id: 'archive-004',
    topic: 'archival',
    rule: 'State transitions enforced by MCP handlers — gates_action:complete validates preconditions before execution.',
    mustHaveValidator: true,
    validatorRef: 'gate-tools.ts#validators.complete',
    reason: 'Enforced by gate-tools.ts#validators.complete: state transition and quality threshold checks run before gate completion',
  },
  {
    id: 'archive-005',
    topic: 'archival',
    rule: 'Full state machine reference: zeno/architecture/mcp-workflows.md',
    mustHaveValidator: false,
    reason: 'Documentation pointer: informational reference to state machine docs; not a runtime constraint',
  },
]

// ─── Database Access Guardrails ────────────────────────────────────────────────
// Source: Design Principle — All database operations must use MCP tools, never direct SQL

export const DATABASE_ACCESS_GUARDRAILS: GuardrailEntry[] = [
  {
    id: 'apply-021',
    topic: 'apply-phase',
    rule: 'NEVER use direct database access (better-sqlite3, execSync, or raw SQL). All database queries must use MCP tools: proposal_action, gates_action, requirement_action, or config_get.',
    mustHaveValidator: false,
    reason: 'Architectural principle: enforced via code review and tool design. MCP tools provide single source of truth for all database operations with schema validation via Zod.',
    agentRef: ['04-quality-security/security-auditor', '04-quality-security/code-reviewer'],
  },
  {
    id: 'apply-022',
    topic: 'apply-phase',
    rule: 'CLI commands that need data must invoke MCP tools via invokeCliTool() helper, never getDatabase() or .prepare().get().',
    mustHaveValidator: false,
    reason: 'Implementation guidance: CLI commands use invokeProposalAction(), invokeGatesAction(), etc. to access data through the MCP layer with proper validation.',
    agentRef: ['04-quality-security/architect-reviewer', '04-quality-security/code-reviewer'],
  },
  {
    id: 'apply-023',
    topic: 'apply-phase',
    rule: 'When implementing new handlers or functions, validate all inputs with Zod schemas defined in src/mcp/schemas/ before querying the database.',
    mustHaveValidator: false,
    reason: 'Best practice: schema-first approach ensures type safety and prevents invalid queries from reaching the database layer.',
    agentRef: ['04-quality-security/code-reviewer', '04-quality-security/security-auditor'],
  },
  {
    id: 'proposal-011',
    topic: 'proposal-generation',
    rule: 'Do not write custom SQL or spawn shell commands to query the database. Use MCP tools exclusively for all data access during proposal generation and implementation.',
    mustHaveValidator: false,
    reason: 'Design principle: consistency and auditability. All data access goes through validated MCP interface, creating a complete audit trail.',
  },
]

// ─── Barrel Export ─────────────────────────────────────────────────────────────

/**
 * All guardrails combined — used by guardrail-coverage.test.ts to assert
 * that every entry with mustHaveValidator:true has a valid validatorRef.
 */
export const ALL_GUARDRAILS: GuardrailEntry[] = [
  ...APPLY_PHASE_GUARDRAILS,
  ...PROPOSAL_GENERATION_GUARDRAILS,
  ...GATE_GENERATION_GUARDRAILS,
  ...ARCHIVAL_GUARDRAILS,
  ...DATABASE_ACCESS_GUARDRAILS,
]

// ─── Response Helpers ──────────────────────────────────────────────────────────

/**
 * Extracts only the narrative rules from a guardrail set for injection into
 * MCP response payloads.
 *
 * Schema-enforced guardrails (mustHaveValidator: true) are already enforced
 * via Zod validation errors on the preReview field — they do not need to be
 * repeated as text in the response body.
 *
 * When a narrative rule has an `agentRef`, the agent name(s) are appended as
 * a delegation hint so agents know who to consult rather than guessing.
 *
 * @returns Array of rule strings with optional agent delegation hints.
 */
export function toNarrativeRules(entries: GuardrailEntry[]): string[] {
  return entries
    .filter((g) => !g.mustHaveValidator)
    .map((g) => {
      if (g.agentRef && g.agentRef.length > 0) {
        const agents = g.agentRef.map((a) => `/${a.split('/').pop()}`).join(', ')
        return `${g.rule} (consult: ${agents})`
      }
      return g.rule
    })
}

/**
 * Returns all narrative guardrail entries that carry an `agentRef`.
 * Useful for building delegation tables or populating structured responses
 * with specific agent escalation paths.
 *
 * @returns Map of guardrail ID → agent name list.
 */
export function toAgentDelegationMap(
  entries: GuardrailEntry[]
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const g of entries) {
    if (!g.mustHaveValidator && g.agentRef && g.agentRef.length > 0) {
      map.set(g.id, g.agentRef)
    }
  }
  return map
}
