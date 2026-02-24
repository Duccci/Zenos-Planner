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
  {
    pattern: /gate-tied proposals.*do not create or modify test files unless.*dedicated test proposal/i,
    reason: "Gate-specific rule: applies to gate-tied proposals only; enforced by proposal context, not a validator",
  },
  {
    pattern: /solitary proposals.*tests are included inline/i,
    reason: "Solitary-specific rule: tests belong in solitary proposals; human verifies at proposal start",
  },
  {
    pattern: /if a task requires expanding the scope.*document.*obtain human approval/i,
    reason: "Escalation process: human approval gate; agent documents and waits for user response",
  },
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

  // zeno-apply/SKILL.md guardrails - Pre-Apply Review section
  {
    pattern: /flag any open questions.*unclear requirements.*contradictory statements/i,
    reason: "Pre-apply review step: agent identifies and escalates ambiguities; requires human judgment to determine what constitutes 'unclear'",
  },
  {
    pattern: /verify all files affected exist.*explicitly marked as new files/i,
    reason: "Pre-apply check: agent can verify file existence; deciding whether to proceed is a user decision gate",
  },
  {
    pattern: /identify any implicit assumptions.*ask the user to confirm they are correct/i,
    reason: "Pre-apply validation: assumptions are implicit by definition; identifying and confirming them requires human review",
  },
  {
    pattern: /check dependencies table.*for any blockers marked as incomplete/i,
    reason: "Pre-apply blocker check: agent documents and escalates; no system enforcement needed (user provides guidance)",
  },

  // zeno-proposal/SKILL.md guardrails - Pre-Generation Gate Review section
  {
    pattern: /read the entire gate prd.*flag any open questions.*unclear requirements.*contradictory statements/i,
    reason: "Pre-generation review step: agent identifies ambiguities before decomposition; human judgment required to assess clarity",
  },
  {
    pattern: /verify all requirements.*complete and unambiguous.*vague acceptance criteria/i,
    reason: "Pre-generation validation: agent flags incomplete specs; human provides quantified metrics or clarifications",
  },
  {
    pattern: /identify any implicit assumptions in the gate prd.*ask the user to confirm/i,
    reason: "Pre-generation assumption check: assumptions are implicit; identifying them and confirming correctness requires human involvement",
  },
  {
    pattern: /check if any gate dependencies are incomplete or blocked.*request user guidance/i,
    reason: "Pre-generation dependency review: agent documents blockers and waits for user guidance before proceeding",
  },

  // zeno-gate/SKILL.md guardrails
  {
    pattern: /create gate prds and update artifacts only.*no implementation code/i,
    reason: "Scope rule: gate generation produces markdown only; agent-enforced via instructions, not a validator",
  },
  {
    pattern: /gates are concrete deliverables.*not percentages or time estimates/i,
    reason: "Definitional principle: describes gate semantics; no validator needed",
  },
  {
    pattern: /identify vague scopes and ask clarifying questions/i,
    reason: "Interaction instruction: agent behavior principle; documented in workflow",
  },

  // zeno-proposal/SKILL.md guardrails
  {
    pattern: /only create markdown in.*no code.*files.*or commands/i,
    reason: "Scope rule: proposal generation is markdown-only; enforced via instructions, proposal template structure",
  },
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
