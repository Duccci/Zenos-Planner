/**
 * Guardrail Allowlist
 *
 * Enumerates guardrails from skills that are intentionally narrative-only.
 * These describe agent intent, process assumptions, or human approval patterns
 * that cannot be enforced by runtime validators.
 *
 * **Narrative-only guardrails** = describe agent *intent*, process steps, or approval gates
 * that are not concrete system constraints. Examples:
 * - "read the gate PRD before starting" (human instruction, not system-enforced)
 * - "mark each step as in-progress" (process record-keeping, not validation)
 * - "assume user approval before apply begins" (approval gate, documented in context)
 *
 * **Must have validator** = guardrails that constrain concrete system behavior:
 * - File scope constraints (only modify explicit Files Affected)
 * - Git operations (blocked during apply phase)
 * - State transitions (pending → in_progress → completed)
 * - Test modification limits (gate-tied vs solitary rules)
 *
 * Pattern matching is case-insensitive regex. If a guardrail statement in a skill file
 * matches any pattern here, it's in the allowlist and excluded from CI drift checks.
 */

export interface AllowlistEntry {
  pattern: RegExp;
  reason: string;
}

export const GUARDRAIL_ALLOWLIST: AllowlistEntry[] = [
  // zeno-apply/SKILL.md guardrails
  {
    pattern: /assume user approval.*before apply begins/i,
    reason: "Process assumption: user approves proposals before apply; documented in approval workflow, not a runtime constraint",
  },
  {
    pattern: /implement straightforward solutions.*add complexity only when required/i,
    reason: "Design principle: agent guidance, not system-enforced constraint",
  },
  {
    pattern: /limit test changes to those that directly validate/i,
    reason: "Approval gate: validation falls to human review + automated coverage checks, not a runtime constraint",
  },
  // G9 (scopeExpansion structured field), G10 (validateTestFileScope gate-tied), G11 (validateTestFileScope solitary)
  // — removed: these guardrails now have structured validators; no longer narrative-only.
  {
    pattern: /review dependencies for context only.*do not act on.*implement.*pre-empt work/i,
    reason: "Workflow instruction: agent behavioral principle; no validator needed (agent follows instructions)",
  },
  {
    pattern: /wait for human approval if automated checks fail/i,
    reason: "Approval gate: human decision point; documented in workflow, not a runtime constraint",
  },
  {
    pattern: /do not rename proposal files/i,
    reason: "File convention rule: human enforces via git review; not a system constraint",
  },
  {
    pattern: /do not move proposal files to archive/i,
    reason: "File convention rule: archival is automatic at gate completion; guardrail prevents manual moves (human enforced)",
  },

  // G1-G4 (pre-apply review: preReview structured preconditions on proposal_action: start)
  // — removed: enforced via PreReviewSchema + proposal-tools.ts validators; no longer narrative-only.

  // G5-G8 (pre-generation review: preReview structured preconditions on proposal_action: generate, gates_action: generate)
  // — removed: enforced via PreReviewSchema + proposal-tools.ts/gate-tools.ts validators; no longer narrative-only.

  // G12 (validateMarkdownOnly in scope-validator.ts for gates_action: generate)
  // — removed: the 'create gate PRDs and update artifacts only — no implementation code' guardrail
  //   is now enforced by validateMarkdownOnly; no longer narrative-only.
  // zeno-gate/SKILL.md guardrails
  {
    pattern: /gates are concrete deliverables.*not percentages or time estimates/i,
    reason: "Definitional principle: describes gate semantics; no validator needed",
  },
  {
    pattern: /identify vague scopes and ask clarifying questions/i,
    reason: "Interaction instruction: agent behavior principle; documented in workflow",
  },

  // G12 (validateMarkdownOnly in scope-validator.ts for proposal_action: generate)
  // — removed: the 'only create markdown — no code, files, or commands' pattern is now enforced
  //   by validateMarkdownOnly; no longer narrative-only.
  // zeno-proposal/SKILL.md guardrails
  {
    pattern: /keep proposals as single coherent work units/i,
    reason: "Design principle: guidance for proposal decomposition; human reviews at proposal review phase",
  },
  {
    pattern: /decompose gate prd steps into tasks.*describe changes without implementing/i,
    reason: "Methodology: proposal generation approach; enforced by template and human review",
  },
  {
    pattern: /no.*implementation code.*inline code snippets.*terminal commands.*file modifications/i,
    reason: "Content rules: proposal-only guidelines; human enforces via review",
  },
  {
    pattern: /yes.*markdown files.*task decomposition.*acceptance criteria/i,
    reason: "Content rules: proposal-only guidelines; defines what goes into proposals",
  },

  // proposal-012: direct file editing (no scripts)
  {
    pattern: /after scaffold generation.*edit each proposal file directly/i,
    reason: "Behavioral principle: prevents LLMs from generating scripts instead of directly editing scaffold files; human-reviewed",
  },

  // zeno-archive/SKILL.md guardrails
  {
    pattern: /gate types.*gate-01.*or filename.*solitary/i,
    reason: "Notation convention: describes hash/reference formats; informational only",
  },
  {
    pattern: /update dependent artifacts.*preserve audit trail/i,
    reason: "Archival methodology: human responsibility during gate completion; documented procedure",
  },
  {
    pattern: /full state machine reference/i,
    reason: "Documentation reference: pointer to state machine docs; informational only",
  },
];
