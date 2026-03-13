/**
 * Proposal Phases Validator
 *
 * Prevents multi-phased proposals by detecting language and patterns that indicate
 * multiple implementation phases. If a proposal requires multiple phases, it must be
 * split into multiple proposals instead.
 *
 * Detects:
 * - Explicit phase numbering: "Phase 1", "Phase 2", etc.
 * - Sequential language: "then", "subsequently", "afterwards", "next step"
 * - Temporal indicators: "later implementation", "future work", "deferred"
 * - Multi-stage descriptions: Tasks/sections clearly separated as distinct phases
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type { ValidationResult } from './types.js'
export type { ValidationResult }

export interface ProposalPhasesValidationContext {
  /** Proposal title */
  title: string
  /** Proposal summary/description */
  summary: string
  /** Implementation notes */
  implementationNotes?: string
  /** Task descriptions */
  taskDescriptions: string[]
  /** Rollback/implications section */
  rollback?: string
}

/**
 * Patterns that indicate multi-phased proposals.
 * These should trigger an error requiring the proposal to be split.
 */
const MULTI_PHASE_PATTERNS = [
  // Explicit phase numbering
  /phase\s+([12-9]|one|two|three|four|five)/gi,
  /stage\s+([12-9]|one|two|three|four|five)/gi,
  // Sequential flow - various forms of "then"
  /,\s*then\s+/gi,
  /\.\s*then\s+/gi,
  / then\s+(?:the\s+)?(?:next|following|subsequent|implement|add|create|update)/gi,
  / then\s+(?=.+(?:phase|stage|step|process))/gi,
  /subsequently\s+/gi,
  /afterwards\s+/gi,
  /after\s+(?:that|this|completion|the\s+first)/gi,
  /in\s+(?:the\s+)?(?:second|next|final)\s+(?:phase|step|stage|pass)/gi,
  // Temporal deferral (work that should be split)
  /(?:will\s+)?implement.*later/gi,
  /defer(?:red)?\s+(?:to|until)/gi,
  /future\s+work/gi,
  /to\s+be\s+(?:done|completed|implemented).*(?:later|subsequently|in\s+phase)/gi,
  // Future gates/proposals (sign of scope overflow)
  /in\s+(?:a\s+)?(?:future|next|subsequent)\s+(?:gate|proposal|pr|pull\s+request)/gi,
  // Multi-pass implementation
  /(?:first|initial)\s+(?:pass|iteration)\s+.*then/gi,
  /refactor.*(?:later|subsequently|in\s+phase)/gi,
]

/**
 * Patterns that are acceptable and don't indicate multi-phasing.
 * Used to reduce false positives.
 */
const ACCEPTABLE_PATTERNS = [
  // Dependencies/blocking statements
  /unlocks|blocks|depends\s+on|required\s+by/gi,
  // Sequential dependencies (ordering is fine, phases are not)
  /this\s+proposal\s+(?:follows|comes\s+after)/gi,
  // Testing language
  /test\s+(?:coverage|scenarios|cases)/gi,
  // Documentation references
  /documentation|usage\s+example|see\s+also/gi,
  // Review/approval language
  /(?:human\s+)?review|approval|feedback/gi,
  // Code review comments
  /in\s+the\s+same\s+(?:pr|pull\s+request|commit)/gi,
  // Algorithm/workflow context words that clearly indicate processing steps (not work phases)
  /(?:algorithm|workflow|process|pipeline|stream|flow).*?then/gi,
  // Data transformation verbs (parse, process, validate, etc.) indicating a single processing phase
  /(?:parse|process|validate|transform|render|execute|filter|map|reduce|serialize|deserialize|compile|encode|decode|format|extract|normalize).*?then/gi,
]

/**
 * Check if text contains multi-phase indicators.
 * Returns error messages for each violation found.
 */
function detectMultiPhaseLanguage(content: string): {
  matches: RegExpExecArray[]
  patterns: RegExp[]
} {
  const matches: RegExpExecArray[] = []
  const detectedPatterns: RegExp[] = []

  for (const pattern of MULTI_PHASE_PATTERNS) {
    let match: RegExpExecArray | null
    pattern.lastIndex = 0 // Reset for global patterns
    while ((match = pattern.exec(content)) !== null) {
      // Check if this match is in an acceptable context
      const isAcceptable = ACCEPTABLE_PATTERNS.some((acceptable) => {
        acceptable.lastIndex = 0
        return acceptable.test(
          content.substring(Math.max(0, match!.index - 50), match!.index + 100)
        )
      })

      if (!isAcceptable) {
        matches.push(match)
        if (!detectedPatterns.includes(pattern)) {
          detectedPatterns.push(pattern)
        }
      }
    }
  }

  return { matches, patterns: detectedPatterns }
}

/**
 * Analyze task structure to detect inherent sequentiality.
 * Proposals with tasks that logically must be done in strict order are multi-phased.
 * Proposals with independent parallel tasks are fine (many tasks OK if parallelizable).
 */
function analyzeTaskPhasing(tasks: string[]): { isMultiPhased: boolean; reasoning: string[] } {
  const reasoning: string[] = []

  // Check for task naming patterns that suggest explicit phases
  const phaseTaskNames = tasks.filter((task) =>
    /phase|stage|part|step (?:[12-9]|one|two|three)/gi.test(task)
  )
  if (phaseTaskNames.length > 1) {
    reasoning.push(
      `Multiple tasks appear to be phases or stages: ${phaseTaskNames.map((t) => `"${t}"`).join(', ')}`
    )
  }

  // Check for explicit sequencing language within task descriptions
  // (not just "then" connections between summary and tasks, but within task definition)
  const logicalSeparations = tasks.filter((task) =>
    /(?:first|then|next|after\s+(?:that|this|completion)|before)/gi.test(task)
  )
  if (logicalSeparations.length >= 2) {
    reasoning.push(
      `Tasks show explicit sequencing suggesting enforced phases: ${logicalSeparations.map((t) => `"${t}"`).join(', ')}`
    )
  }

  return {
    isMultiPhased: reasoning.length > 0,
    reasoning,
  }
}

/**
 * Validate that proposal does not contain multiple phases.
 * Multi-phased proposals must be split into separate proposals.
 */
export function validateProposalPhases(context: ProposalPhasesValidationContext): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Combine all text content for analysis
  const fullContent = [
    context.title,
    context.summary,
    context.implementationNotes ?? '',
    context.taskDescriptions.join('\n'),
    context.rollback ?? '',
  ].join('\n')

  // Detect explicit multi-phase language
  const { matches: phaseMatches } = detectMultiPhaseLanguage(fullContent)

  if (phaseMatches.length > 0) {
    // Build error message with context
    const uniqueMatches = Array.from(new Set(phaseMatches.map((m) => m[0])))
    const matchExamples = uniqueMatches.slice(0, 3).join('", "')
    const additionalCount =
      uniqueMatches.length > 3 ? `, and ${String(uniqueMatches.length - 3)} more` : ''

    errors.push(
      `Proposal contains multi-phase language: "${matchExamples}${additionalCount}". ` +
        `Multi-phased proposals must be split into separate proposals. ` +
        `Each proposal should deliver a complete, testable unit of work within a single phase, ` +
        `and proposals may be sequenced via Dependencies (requires/blocks).`
    )
  }

  // Analyze task structure
  const taskAnalysis = analyzeTaskPhasing(context.taskDescriptions)

  // Only error on explicit phase patterns or severe task separation
  // Task count alone generates a warning, not an error
  const hasExplicitPhaseNames = taskAnalysis.reasoning.some((r) =>
    r.includes('appear to be phases')
  )
  const hasLogicalSeparation = taskAnalysis.reasoning.some((r) => r.includes('sequencing'))

  if ((hasExplicitPhaseNames || hasLogicalSeparation) && taskAnalysis.isMultiPhased) {
    errors.push(
      `Proposal appears to span multiple implementation phases:` +
        `\n  - ${taskAnalysis.reasoning.join('\n  - ')}\n` +
        `Consider splitting this proposal into multiple sequential proposals. ` +
        `Use Dependencies to establish ordering without multi-phasing.`
    )
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
