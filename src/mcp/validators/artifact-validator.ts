/**
 * Artifact Validator (Unified Composition)
 *
 * Composable validation framework that combines all artifact checks.
 * Validates proposals, gates, and architecture diagrams against Zeno's
 * format and structure requirements.
 *
 * *** IMPORTANT: Structure validation is MANDATORY ***
 * Structure validation cannot be disabled. All artifacts must satisfy
 * both format and structure requirements to pass validation.
 *
 * This validator does NOT invoke external quality checks (pre-commit, tests, linters).
 * Quality validation is the responsibility of the target project.
 * This validator only checks that artifacts follow Zeno's format and structure.
 *
 * Checks performed on Proposals:
 *   Format (always):
 *     1. Required sections (Summary, Tasks, Files Affected, Dependencies)
 *     2. Single-phase only (no Phase 1/2 language)
 *   Structure (always, non-optional):
 *     3. Test-first pattern (if gate-tied): role matches file types
 *     4. Scope validation: explicit file paths, no wildcards
 *     5. Qualitative scope creep: LLM-directed review for implementation drift
 *     6. Dependency validation: no circular deps, valid references
 *
 * Checks performed on Gates:
 *   Format (always):
 *     1. Required sections (Objectives, Requirements, Architecture, Scope Boundaries)
 *     2. Valid Status field
 *   Structure (always, non-optional):
 *     3. Objectives section: non-empty, has checkboxes
 *     4. No stale markers in Objectives/Context
 *     5. Scope Boundaries: explicit "In Scope" content
 *     6. Qualitative scope creep: LLM-directed review for implementation drift
 *
 * Checks performed on Architecture Diagrams:
 *   Format (always):
 *     1. Contains diagram content (mermaid, dot, or SVG)
 */

import { readFile } from '../../utils/file.js'
import { logger } from '../../utils/logger.js'
import type { ValidationResult } from './types.js'
import {
  loadTemplateSections,
  validateTemplateSections,
  type TemplateSections,
} from './template-sections-validator.js'
import {
  loadSectionSpecs,
  validateSectionImplementation,
  type SectionSpec,
  type SectionScore,
} from './section-implementation-validator.js'
import {
  validateProposalPhases,
  type ProposalPhasesValidationContext,
} from './proposal-phases-validator.js'
import {
  validateTestFirstPattern,
  type TestFirstValidationContext,
} from './test-first-validator.js'
import { validateScope, type ScopeValidationContext } from './scope-validator.js'
import { evaluateScopeCreep, type ScopeCreepValidationContext } from './scope-creep-validator.js'
import {
  validateDependencies,
  type DependencyValidationContext,
  type DependencyNode,
} from './dependency-validator.js'

export type ArtifactType = 'proposal' | 'gate' | 'architecture'

export interface ArtifactValidationContext {
  /** Type of artifact being validated */
  artifactType: ArtifactType
  /** Path to the artifact file */
  artifactPath: string
  /** Content of the artifact */
  content: string
  /** For proposals: gate ID if gate-tied */
  gateId?: string
  /** For proposals: proposal hash for dependency checking */
  hash?: string
  /** For proposals: role declared in the proposal */
  role?: string
  /**
   * For proposals: objectives text extracted from the parent gate.
   * When provided, used as the reference for qualitative scope-creep evaluation
   * instead of the proposal's own summary.
   */
  gateObjectives?: string
  /**
   * For proposals: explicit "Out of Scope" items from the parent gate's Scope
   * Boundaries section.  When provided, any item that appears verbatim in the
   * proposal's tasks/files produces a blocking error.
   */
  outOfScopeItems?: string[]
  /** For test-first pattern validation: all proposals in the same gate */
  gateProposals?: { hash: string; role?: string; createdAt: string }[]
  /** For dependency validation: all nodes in the system */
  allNodes?: Map<string, DependencyNode>
  /**
   * Pre-loaded template sections for section-presence validation.
   * Populated automatically by validateArtifactFile, which reads the
   * appropriate md-template and calls parseTemplateSections.
   *
   * When absent (e.g., validateArtifact called directly in tests), section
   * validation is skipped and a warning is emitted.
   */
  templateSections?: TemplateSections
  /**
   * Pre-loaded section specs for implementation-quality validation.
   * Populated automatically by validateArtifactFile alongside templateSections.
   * When absent, implementation-quality validation is skipped.
   */
  sectionSpecs?: SectionSpec[]
}

/**
 * Validate the Open Questions section in a proposal or gate document.
 *
 * The section is optional — its absence always passes.  When present the body
 * must satisfy one of:
 *   • empty / whitespace only
 *   • contains only "N/A" or "null" text (case-insensitive)
 *   • every checkbox item is resolved: `- [x]` (no `- [ ]` items remain)
 *
 * A single unresolved `- [ ]` item is a blocking error because unresolved
 * questions indicate the artifact is not ready for approval / proposal generation.
 */
function validateOpenQuestions(content: string): ValidationResult {
  const sectionMatch = /##\s+Open Questions\b([\s\S]*?)(?=\n##\s|\s*$)/i.exec(content)
  if (!sectionMatch) {
    return { allowed: true }
  }

  const body = sectionMatch[1] ?? ''
  const bodyTrimmed = body.trim()

  // Empty, "N/A", or "null" body → no questions to resolve.
  if (!bodyTrimmed || /^(?:N\/A|null)$/i.test(bodyTrimmed)) {
    return { allowed: true }
  }

  // Detect unresolved checkbox items: `- [ ] text` or `* [ ] text`
  const unresolvedMatches = [...body.matchAll(/^[-*]\s+\[\s+\]\s+.+/gm)]
  if (unresolvedMatches.length > 0) {
    const questions = unresolvedMatches
      .map((m) => m[0].replace(/^[-*]\s+\[\s+\]\s+/, '').trim().slice(0, 100))
    return {
      allowed: false,
      errors: [
        `Open Questions section has ${String(unresolvedMatches.length)} unresolved question(s). ` +
          `Mark each as [x] once resolved, or remove questions that no longer apply:\n` +
          questions.map((q) => `  • ${q}`).join('\n'),
      ],
    }
  }

  return { allowed: true }
}

/**
 * Validate a proposal artifact comprehensively.
 *
 * ALWAYS enforces both format and structure validation.
 * validationMode parameter is deprecated and ignored.
 */
function validateProposalArtifact(context: ArtifactValidationContext): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  let implementationScore: number | undefined
  let sectionScores: SectionScore[] | undefined
  const { content } = context

  // =========================================================================
  // PHASE 1: FORMAT VALIDATION (always enforced)
  // =========================================================================

  // Check 1a: Section presence — driven entirely by the parsed template.
  // templateSections is populated by validateArtifactFile; if absent (e.g.,
  // direct validateArtifact call without file I/O), skip and warn.
  if (context.templateSections) {
    const sectionResult = validateTemplateSections(content, context.templateSections)
    errors.push(...(sectionResult.errors ?? []))
    warnings.push(...(sectionResult.warnings ?? []))
  } else {
    warnings.push(
      'Template sections not loaded; section-presence validation skipped. ' +
        'Use validateArtifactFile to enable template-driven section checks.'
    )
  }

  // Check 1b: Section implementation quality — quantitative + qualitative.
  // Validates that each present section is filled with real content, not
  // template placeholders or boilerplate.  Requires sectionSpecs.
  if (context.sectionSpecs && context.sectionSpecs.length > 0) {
    const implResult = validateSectionImplementation(content, context.sectionSpecs)
    errors.push(...(implResult.errors ?? []))
    warnings.push(...(implResult.warnings ?? []))
    implementationScore = implResult.overallScore
    sectionScores = implResult.sectionScores
  }

  // Check 2: Single-phase only (detect multi-phase language)
  const phasesContext: ProposalPhasesValidationContext = {
    title: extractField(content, 'Proposal:', 1) ?? 'Unknown',
    summary: extractField(content, '## Summary', 5) ?? '',
    implementationNotes: extractField(content, '## Implementation Notes', 10),
    taskDescriptions: extractTaskDescriptions(content),
    rollback: extractField(content, '## Rollback|Implications', 10),
  }

  const phasesResult = validateProposalPhases(phasesContext)
  errors.push(...(phasesResult.errors ?? []))
  warnings.push(...(phasesResult.warnings ?? []))

  // =========================================================================
  // PHASE 2: STRUCTURE VALIDATION (always enforced, non-optional)
  // =========================================================================

  // Check 3: Test-first pattern (if gate-tied)
  if (context.gateId && context.gateProposals) {
    const filesAffected = extractFilesAffected(content)
    const testFirstContext: TestFirstValidationContext = {
      proposalHash: context.hash ?? 'unknown',
      role: context.role,
      isGateTied: !!context.gateId,
      filesAffected,
      gateProposals: context.gateProposals.map((p) => ({
        hash: p.hash,
        role: p.role,
        createdAt: p.createdAt,
      })),
    }

    const testFirstResult = validateTestFirstPattern(testFirstContext)
    errors.push(...(testFirstResult.errors ?? []))
    warnings.push(...(testFirstResult.warnings ?? []))
  }

  // Check 4: Scope validation (explicit paths, no wildcards)
  // ALWAYS performed - this is a structural requirement
  const filesAffected = extractFilesAffected(content)
  const scopeContext: ScopeValidationContext = {
    filesAffected,
    filesModified: filesAffected, // Assume declared files will be modified
    allowTestFiles: true,
  }

  const scopeResult = validateScope(scopeContext)
  errors.push(...(scopeResult.errors ?? []))
  warnings.push(...(scopeResult.warnings ?? []))

  // Check 5: Qualitative scope creep detection
  // Heuristically detects implementation drift from declared objectives.
  // Blocking when an explicit out-of-scope violation is found; advisory otherwise.
  {
    const proposalTitle = extractField(content, 'Proposal:', 1) ?? extractField(content, '# ', 1) ?? 'Unknown'
    const objectives = context.gateObjectives ?? extractField(content, '## Summary', 10) ?? ''
    const taskBlock = extractTaskDescriptions(content).join('\n')
    const filesBlock = extractFilesAffected(content).join('\n')
    const implementationContent = [taskBlock, filesBlock].filter(Boolean).join('\n\n')

    const creepContext: ScopeCreepValidationContext = {
      artifactType: 'proposal',
      title: proposalTitle.replace(/^Proposal:\s*/i, '').trim(),
      objectives,
      implementationContent,
      ...(context.outOfScopeItems && context.outOfScopeItems.length > 0
        ? { outOfScopeItems: context.outOfScopeItems }
        : {}),
    }

    const creepResult = evaluateScopeCreep(creepContext)
    errors.push(...(creepResult.errors ?? []))
    warnings.push(...(creepResult.warnings ?? []))
  }

  // Check 6: Dependency validation (if dependencies exist and nodes available)
  // ALWAYS performed if context allows - this is a structural requirement
  if (context.allNodes && context.hash) {
    const dependencies = extractDependencies(content)
    const node: DependencyNode = {
      hash: context.hash,
      dependencies,
      gateId: context.gateId,
    }

    const depContext: DependencyValidationContext = {
      node,
      allNodes: context.allNodes,
    }

    const depResult = validateDependencies(depContext)
    errors.push(...(depResult.errors ?? []))
    warnings.push(...(depResult.warnings ?? []))
  }

  // Check 7: Open Questions — all questions must be resolved (or section absent / N/A)
  {
    const oqResult = validateOpenQuestions(content)
    errors.push(...(oqResult.errors ?? []))
    warnings.push(...(oqResult.warnings ?? []))
  }

  // =========================================================================
  // PHASE 3: AGENT-DIRECTED QUALITATIVE REVIEW
  // =========================================================================

  // Generate review items the calling agent must evaluate with its own judgment.
  // These complement the heuristics above — they target intent alignment,
  // completeness, and logical accuracy that parsers cannot assess.
  const agentReview = generateProposalAgentChecks(content, context)

  // =========================================================================
  // RETURN RESULT
  // =========================================================================

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    ...(implementationScore !== undefined ? { score: implementationScore } : {}),
    ...(sectionScores !== undefined ? { sectionScores } : {}),
    ...(agentReview.length > 0 ? { agentReview } : {}),
  } as ValidationResult & { sectionScores?: SectionScore[] }
}

/**
 * Validate a gate artifact.
 *
 * ALWAYS enforces both format and structure validation.
 * validationMode parameter is deprecated and ignored.
 */
function validateGateArtifact(context: ArtifactValidationContext): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  let implementationScore: number | undefined
  let sectionScores: SectionScore[] | undefined
  const { content } = context

  // =========================================================================
  // PHASE 1: FORMAT VALIDATION (always enforced)
  // =========================================================================

  // Check 1a: Section presence — driven entirely by the parsed template.
  if (context.templateSections) {
    const sectionResult = validateTemplateSections(content, context.templateSections)
    errors.push(...(sectionResult.errors ?? []))
    warnings.push(...(sectionResult.warnings ?? []))
  } else {
    warnings.push(
      'Gate template sections not loaded; section-presence validation skipped. ' +
        'Use validateArtifactFile to enable template-driven section checks.'
    )
  }

  // Check 1b: Section implementation quality — quantitative + qualitative.
  if (context.sectionSpecs && context.sectionSpecs.length > 0) {
    const implResult = validateSectionImplementation(content, context.sectionSpecs)
    errors.push(...(implResult.errors ?? []))
    warnings.push(...(implResult.warnings ?? []))
    implementationScore = implResult.overallScore
    sectionScores = implResult.sectionScores
  }

  // Check 2: Valid Status field (structural constraint, not in template sections)
  if (!/\*\*Status\*\*:\s*(pending|validated|in_progress|completed|rejected|archived|cancelled|backlog)/i.test(content)) {
    errors.push(
      'Gate Status field missing or invalid (expected **Status**: one of pending|validated|in_progress|completed|rejected|archived|cancelled|backlog)'
    )
  }

  // =========================================================================
  // PHASE 2: STRUCTURE VALIDATION (always enforced, non-optional)
  // These checks are gate-specific: gates drive proposal creation so their
  // content quality is held to a higher standard than proposals.
  // =========================================================================

  // Check 3: Objectives section must contain at least one actionable checkbox.
  // A gate with no checkboxes provides no basis for proposal decomposition.
  const objectivesMatch = /##\s+Objectives\b([\s\S]*?)(?=\n##\s|\s*$)/.exec(content)
  const objectivesBody = objectivesMatch?.[1] ?? ''
  if (objectivesBody.trim().length === 0) {
    errors.push('Gate Objectives section is empty — at least one objective with a checkbox is required')
  } else if (!/- \[[ x]\]/i.test(objectivesBody)) {
    errors.push(
      'Gate Objectives section contains no checkboxes (- [ ] or - [x]); each objective must be an actionable, trackable item'
    )
  }

  // Check 4: No stale markers in Objectives or Context sections.
  // Stale markers (TBD, TODO, FIXME, PLACEHOLDER) in these sections indicate
  // the gate is not ready to drive proposal decomposition.
  const stalePattern = /\b(TBD|TODO|FIXME|PLACEHOLDER|COMING SOON)\b/gi
  const contextMatch = /##\s+Context\b([\s\S]*?)(?=\n##\s|\s*$)/.exec(content)
  const contextBody = contextMatch?.[1] ?? ''
  const staleInObjectives = objectivesBody.match(stalePattern)
  const staleInContext = contextBody.match(stalePattern)
  if (staleInObjectives) {
    errors.push(
      `Gate Objectives section contains unresolved stale markers: ${[...new Set(staleInObjectives.map((m) => m.toUpperCase()))].join(', ')}`
    )
  }
  if (staleInContext) {
    warnings.push(
      `Gate Context section contains stale markers: ${[...new Set(staleInContext.map((m) => m.toUpperCase()))].join(', ')} — resolve before generating proposals`
    )
  }

  // Check 5: Scope Boundaries section must contain explicit "In Scope" content.
  // Proposals inherit scope from the gate; absent boundaries create unbounded proposals.
  const scopeMatch = /##\s+Scope Boundaries\b([\s\S]*?)(?=\n##\s|\s*$)/.exec(content)
  const scopeBody = scopeMatch?.[1] ?? ''
  if (scopeBody.trim().length === 0) {
    warnings.push(
      'Gate Scope Boundaries section is empty — proposals may exceed intended scope without explicit boundaries'
    )
  } else if (!/in scope/i.test(scopeBody)) {
    warnings.push('Gate Scope Boundaries section lacks an "In Scope" list — add explicit inclusions to constrain proposals')
  }

  // Check 6: Qualitative scope creep detection
  // Heuristically detects implementation drift before proposals are generated.
  // Blocking when declared out-of-scope items appear in scope/requirements;
  // advisory when scope-expanding language is found without grounding in objectives.
  if (objectivesBody.trim()) {
    const requirementsMatch = /##\s+Requirements\b([\s\S]*?)(?=\n##\s|\s*$)/.exec(content)
    const requirementsBody = requirementsMatch?.[1] ?? ''
    const implementationContent = [scopeBody.trim(), requirementsBody.trim()].filter(Boolean).join('\n\n')

    // Extract individual "Out of Scope" bullet items so the validator can match
    // each phrase against the implementation content independently.
    const outOfScopeMatch = /out[\s-]of[\s-]scope\s*[:\n]([\s\S]*?)(?=\*\*in[\s-]scope|##|$)/i.exec(scopeBody)
    const outOfScopeBlock = outOfScopeMatch?.[1] ?? ''
    const outOfScopeItems = outOfScopeBlock
      .split('\n')
      .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
      .filter((l) => l.length >= 5)

    const gateTitle = extractField(content, '# ', 1) ?? 'Unknown Gate'
    const creepContext: ScopeCreepValidationContext = {
      artifactType: 'gate',
      title: gateTitle,
      objectives: objectivesBody.trim(),
      implementationContent,
      ...(outOfScopeItems.length > 0 ? { outOfScopeItems } : {}),
    }

    const creepResult = evaluateScopeCreep(creepContext)
    errors.push(...(creepResult.errors ?? []))
    warnings.push(...(creepResult.warnings ?? []))
  }

  // Gates with associated proposals must validate Test-First pattern at gate level
  // This is enforced when gate is completed or at proposal approval time
  // (structure checks delegated to validateTestFirstPattern when proposals are available)

  // Check 7: Open Questions — all questions must be resolved (or section absent / N/A)
  {
    const oqResult = validateOpenQuestions(content)
    errors.push(...(oqResult.errors ?? []))
    warnings.push(...(oqResult.warnings ?? []))
  }

  // =========================================================================
  // PHASE 3: AGENT-DIRECTED QUALITATIVE REVIEW
  // =========================================================================

  // Generate review items the calling agent must evaluate with its own judgment.
  // These complement the heuristics above — they target objective clarity,
  // context accuracy, scope precision, and requirements coverage.
  const agentReview = generateGateAgentChecks(content)

  // =========================================================================
  // RETURN RESULT
  // =========================================================================

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    ...(implementationScore !== undefined ? { score: implementationScore } : {}),
    ...(sectionScores !== undefined ? { sectionScores } : {}),
    ...(agentReview.length > 0 ? { agentReview } : {}),
  } as ValidationResult & { sectionScores?: SectionScore[] }
}

/**
 * Validate an architecture diagram artifact (mermaid/dot/svg).
 *
 * Checks that the file contains valid diagram content.
 */
function validateArchitectureArtifact(context: ArtifactValidationContext): ValidationResult {
  const errors: string[] = []
  const { content } = context

  // Check for diagram content (mermaid, dot, or SVG)
  if (!/```mermaid|```dot|digraph|graph\s+|<svg/i.test(content)) {
    errors.push(
      'Architecture file does not contain valid diagram content. ' +
        'Expected mermaid (```mermaid...```), dot (digraph {...}), or SVG (<svg...>).'
    )
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

// ============================================================================
// Qualitative agent-review check generators
//
// Heuristics and parsers catch structural, syntactic, and keyword-level
// issues, but they cannot evaluate semantic intent, logical completeness, or
// contextual accuracy.  These generators produce targeted review questions
// that the calling agent MUST answer with its own judgment.
//
// Rules:
//   - Every check must be answerable by reading the artifact content.
//   - Checks are phrased as specific yes/no or short-answer questions.
//   - They must not duplicate what the heuristic validators already check.
//   - They surface the category of issue so the agent knows where to look.
// ============================================================================

/**
 * Generate targeted review questions for a proposal artifact.
 *
 * Covers four dimensions that heuristics cannot measure:
 *   1. Intent alignment   — do the tasks solve what the summary promises?
 *   2. Implementation completeness — is there enough detail to build from?
 *   3. Files Affected accuracy — are all implicitly modified files listed?
 *   4. Dependency accuracy — are upstream deps declared; downstream impacts noted?
 */
function generateProposalAgentChecks(content: string, context: ArtifactValidationContext): string[] {
  const title = (extractField(content, 'Proposal:', 1) ?? 'this proposal')
    .replace(/^Proposal:\s*/i, '').trim()
  const checks: string[] = []

  // 1. Intent alignment: Summary vs Tasks
  checks.push(
    `Intent alignment: Read the Summary and every task description in "${title}". ` +
      `Do the tasks collectively implement exactly what the Summary states, ` +
      `or do they address a different problem or a subset/superset of it? ` +
      `Flag any task that cannot be directly traced to a stated objective.`
  )

  // 2. Implementation completeness
  checks.push(
    `Implementation completeness: Could a developer implement "${title}" ` +
      `using only the information in this proposal (task descriptions, acceptance criteria, ` +
      `implementation notes) without needing follow-up clarification? ` +
      `Identify any task that is too vague to act on as written.`
  )

  // 3. Files Affected coverage — supplement the heuristic scope check
  checks.push(
    `Files Affected coverage: Based on the task descriptions, are there files ` +
      `that would realistically need to change that are NOT listed in the Files Affected section? ` +
      `Consider test files, type definitions, index re-exports, and configuration ` +
      `that the described changes would touch.`
  )

  // 4. Dependency accuracy
  const hasDeps = /##\s+Dependencies/i.test(content)
  if (hasDeps) {
    checks.push(
      `Dependency accuracy: Review the Dependencies section of "${title}". ` +
        `Are all proposals that must be applied before this one declared? ` +
        `Are there downstream proposals in the same gate that must now list this one as a dependency? ` +
        `Flag any missing or incorrect dependency declarations.`
    )
  }

  // 5. Gate objectives coverage (when gate objectives are provided)
  if (context.gateObjectives?.trim()) {
    checks.push(
      `Gate objective coverage: Cross-reference the gate objectives against all tasks in "${title}". ` +
        `Does this proposal advance or complete one or more gate objectives, ` +
        `or does it work on something tangential? ` +
        `Confirm which gate objective(s) each task maps to.`
    )
  }

  return checks
}

/**
 * Generate targeted review questions for a gate artifact.
 *
 * Covers four dimensions that heuristics cannot measure:
 *   1. Objective specificity — are acceptance criteria measurable?
 *   2. Context accuracy      — does it reflect reality, not aspiration?
 *   3. Scope tightness       — are boundaries specific enough to drive proposals?
 *   4. Requirements coverage — do requirements map completely to objectives?
 */
function generateGateAgentChecks(content: string): string[] {
  const title = (extractField(content, '# ', 1) ?? 'this gate').trim()
  const checks: string[] = []

  // 1. Objective specificity
  checks.push(
    `Objective specificity: Read each checkbox in the Objectives section of "${title}". ` +
      `Is each objective specific enough that a reviewer could determine unambiguously ` +
      `whether it has been met? Flag any objective that is a vague goal (e.g., "improve X") ` +
      `rather than a concrete, verifiable outcome.`
  )

  // 2. Context accuracy
  const hasContext = /##\s+Context/i.test(content)
  if (hasContext) {
    checks.push(
      `Context accuracy: Read the Context section of "${title}". ` +
        `Does it accurately describe the current state of the codebase and the ` +
        `problem being solved, or does it describe a future/aspirational state? ` +
        `Identify any statements that are incorrect or that will mislead proposal authors.`
    )
  }

  // 3. Scope tightness
  checks.push(
    `Scope tightness: Read the Scope Boundaries section of "${title}". ` +
      `Are the "In Scope" items specific enough that a proposal author could determine ` +
      `without ambiguity what they are permitted to change? ` +
      `Are the "Out of Scope" items precise enough to prevent boundary disputes? ` +
      `Flag any item that is too broad or could be interpreted in multiple ways.`
  )

  // 4. Requirements coverage
  const hasRequirements = /##\s+Requirements/i.test(content)
  if (hasRequirements) {
    checks.push(
      `Requirements coverage: Cross-reference the Requirements section against the Objectives ` +
        `in "${title}". Does every Objective have at least one Requirement that, ` +
        `when implemented, would satisfy it? Are there Requirements with no corresponding ` +
        `Objective (orphaned requirements)? Flag any gaps in either direction.`
    )
  }

  return checks
}

/**
 * Validate any artifact by type.
 */
export function validateArtifact(context: ArtifactValidationContext): ValidationResult {
  switch (context.artifactType) {
    case 'proposal':
      return validateProposalArtifact(context)
    case 'gate':
      return validateGateArtifact(context)
    case 'architecture':
      return validateArchitectureArtifact(context)
    default:
      return {
        allowed: false,
        errors: [`Unknown artifact type: ${String(context.artifactType)}`],
      }
  }
}

// ============================================================================
// Helper functions for field extraction
// ============================================================================

/**
 * Extract field value from markdown (simple regex-based).
 */
function extractField(content: string, pattern: string, maxLines: number): string | undefined {
  const regex = new RegExp(`${pattern}[^\\n]*\\n([\\s\\S]*?)(?=##|$)`, 'i')
  const match = content.match(regex)
  if (!match?.[1]) return undefined

  // Return first maxLines of captured group
  const lines = match[1].split('\n').slice(0, maxLines).join('\n')
  return lines.trim() || undefined
}

/**
 * Extract task descriptions from the Tasks section.
 * Tasks use "### Task N: Description" headers, not bullet/numbered lines.
 */
function extractTaskDescriptions(content: string): string[] {
  const taskSection = extractField(content, '## Tasks', 200) ?? ''
  // Split by '### Task N:' headers
  return taskSection
    .split(/###\s+Task\s+\d+:/)
    .slice(1) // drop the empty segment before the first header
    .map((t) => t.split('\n')[0]?.trim() ?? '') // first line of each section is the task title
    .filter((t) => t.length > 0)
}

/**
 * Extract Files Affected list from the proposal.
 * Dynamically detects format: backtick-quoted paths, table cells, or list items.
 * No hardcoded path patterns — derives valid file indicators from actual content.
 */
function extractFilesAffected(content: string): string[] {
  const filesSection = extractField(content, '## Files Affected', 100) ?? ''
  if (!filesSection.trim()) return []

  const files: string[] = []
  const seen = new Set<string>()

  // ── Extract backtick-quoted paths (e.g., `src/path/file.ts`) ──────────────
  // This is the primary format in the template
  const backtickMatches = filesSection.match(/`([^`]+\.[a-z]+)`/gi)
  if (backtickMatches) {
    for (const match of backtickMatches) {
      const path = match.slice(1, -1).trim() // Remove backticks
      if (path && !seen.has(path)) {
        files.push(path)
        seen.add(path)
      }
    }
  }

  // ── Extract from table cells (pipe-delimited) ─────────────────────────────
  // Look for cells that contain file extensions (.) and are not headers/separators
  const lines = filesSection.split('\n')
  for (const line of lines) {
    // Skip table structure lines (headers starting with |, separator lines with |:-|)
    if (/^\s*\|[-\s:|]+\|\s*$/.test(line) || /^[-\s|]+$/.test(line)) continue

    // If line has pipes, it's table format
    if (line.includes('|')) {
      const cells = line.split('|').map((c) => c.trim())

      for (const cell of cells) {
        // Skip empty cells and headers
        if (!cell || cell.length === 0 || /^[A-Z][a-zA-Z\s]+$/.test(cell)) continue

        // Match any text with file extension (dot notation)
        // Accept paths like: file.ts, src/file.ts, path/to/file.test.ts, etc.
        if (cell.includes('.')) {
          // Extract just the path part if there are extra tokens
          // e.g., "` src/file.ts` (create)" → "src/file.ts"
          const pathMatch = /([a-zA-Z0-9._\-/]+\.[a-zA-Z0-9]+)/.exec(cell)
          if (pathMatch?.[1]) {
            const path = pathMatch[1]
            if (!seen.has(path)) {
              files.push(path)
              seen.add(path)
            }
          }
        }
      }
    }

    // ── Extract from list format (bullet points) ────────────────────────────
    // Handle lines starting with * or - followed by a path
    const listMatch = /^\s*[*-]\s+(.+)/.exec(line)
    if (listMatch?.[1]) {
      const content = listMatch[1].trim()
      // Extract the actual path (may have extra description after it)
      const pathMatch = /([a-zA-Z0-9._\-/]+\.[a-zA-Z0-9]+)/.exec(content)
      if (pathMatch?.[1]) {
        const path = pathMatch[1]
        if (!seen.has(path)) {
          files.push(path)
          seen.add(path)
        }
      }
    }
  }

  return files
}

/**
 * Extract dependencies from the Dependencies section.
 */
function extractDependencies(content: string): string[] {
  const depsSection = extractField(content, '## Dependencies', 50) ?? ''

  if (depsSection.toLowerCase().includes('no dependencies')) {
    return []
  }

  const deps: string[] = []
  const hashPattern = /#[a-f0-9]{16}/g
  const matches = depsSection.match(hashPattern)

  if (matches) {
    deps.push(...matches.map((h) => h.slice(1)))
  }

  return [...new Set(deps)] // Deduplicate
}

/**
 * Load artifact from disk and validate it.
 *
 * @param filePath - Path to the artifact file
 * @param artifactType - Type of artifact (proposal, gate, architecture)
 * @param additionalContext - Additional validation context (gateId, role, proposals, etc.)
 * @returns ValidationResult with allowed, errors, and warnings
 *
 * NOTE: Structure validation is MANDATORY and cannot be disabled.
 * All artifacts are validated against both format and structure requirements.
 */

export async function validateArtifactFile(
  filePath: string,
  artifactType: ArtifactType,
  additionalContext?: Partial<ArtifactValidationContext>
): Promise<ValidationResult> {
  try {
    const content = await readFile(filePath)

    // Load template sections + section specs for proposal/gate artifacts unless already supplied.
    let templateSections: TemplateSections | undefined = additionalContext?.templateSections
    let sectionSpecs: SectionSpec[] | undefined = additionalContext?.sectionSpecs
    if (artifactType === 'proposal' || artifactType === 'gate') {
      if (!templateSections) {
        try {
          templateSections = await loadTemplateSections(artifactType)
        } catch {
          // Non-fatal: template file may not be present in all environments.
        }
      }
      if (!sectionSpecs) {
        try {
          sectionSpecs = await loadSectionSpecs(artifactType)
        } catch {
          // Non-fatal: template file may not be present in all environments.
        }
      }
    }

    return validateArtifact({
      artifactType,
      artifactPath: filePath,
      content,
      ...additionalContext,
      ...(templateSections !== undefined ? { templateSections } : {}),
      ...(sectionSpecs !== undefined ? { sectionSpecs } : {}),
    })
  } catch (err) {
    logger.error('Failed to validate artifact', { filePath, error: err })
    return {
      allowed: false,
      errors: [`Failed to read artifact file: ${String(err)}`],
    }
  }
}
