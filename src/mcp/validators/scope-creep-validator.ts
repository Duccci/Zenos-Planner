/**
 * Qualitative Scope Creep Validator
 *
 * Heuristically detects when an artifact's implementation has drifted from its
 * declared goals.  Complements the quantitative scope-validator (file-path
 * membership) with intent-level analysis.
 *
 * Three-tier result:
 *   Error   (allowed: false) — explicit out-of-scope violation: an item listed
 *           under "Out of Scope" in the Scope Boundaries section is found
 *           verbatim in the implementation content.
 *   Warning (allowed: true)  — suspicious signals: scope-expanding verbs
 *           appear in tasks but are absent from the declared objectives.
 *   Silent  (allowed: true)  — no signals detected; nothing emitted.
 *
 * Design:
 *   - Pure function — no I/O, deterministic given the same inputs.
 *   - Non-prescriptive — warns when signals exceed a threshold, never
 *     second-guesses otherwise legitimate content.
 *   - Fails open — if objectives or implementation content is missing,
 *     returns allowed: true rather than erroring.
 */

import type { ValidationResult } from './types.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScopeCreepValidationContext {
  /** Type of artifact being evaluated */
  artifactType: 'proposal' | 'gate'

  /**
   * The declared purpose/objectives of the artifact.
   *
   * For proposals  : gate objectives (preferred) or proposal summary.
   * For gates      : extracted Objectives section body.
   */
  objectives: string

  /**
   * The implementation / scope content to evaluate against the objectives.
   *
   * For proposals  : task descriptions + files affected block.
   * For gates      : Scope Boundaries + Requirements section bodies.
   */
  implementationContent: string

  /** Human-readable title of the artifact (for context in reported messages). */
  title: string

  /**
   * Explicitly declared "Out of Scope" items from the Scope Boundaries section.
   * Each entry is a phrase that must NOT appear in the implementation.
   * When provided, exact-phrase matches produce blocking errors.
   */
  outOfScopeItems?: string[]
}

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

/**
 * Verbs and phrases that frequently signal scope expansion beyond a stated goal.
 * Only flagged when they appear in implementation but NOT in objectives.
 */
const SCOPE_EXPANSION_SIGNALS = [
  'refactor',
  'redesign',
  'overhaul',
  'migrate',
  'rewrite',
  'reorganize',
  'restructure',
  'clean up',
  'cleanup',
  'simplify',
  'improve performance',
  'optimize',
  'introduce abstraction',
  'decouple',
  'extract.*module',
  'extract.*service',
  'generalize',
  'future.proof',
  'add support for',
  'extend to support',
]

const EXPANSION_RE = new RegExp(SCOPE_EXPANSION_SIGNALS.join('|'), 'i')

/**
 * Return tokens (lowercase words) from a text block for presence checks.
 */
function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s,;:.()[\]{}"'`/\\|<>!?@#$%^&*+=~-]+/)
      .filter((t) => t.length >= 4)
  )
}

/**
 * Normalize a phrase for loose substring matching:
 * collapse whitespace, strip punctuation, lowercase.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Heuristically evaluate an artifact for scope creep.
 *
 * @returns
 *   - `allowed: false` with errors when an explicit out-of-scope phrase is
 *     found verbatim in the implementation content.
 *   - `allowed: true` with warnings when scope-expansion signals appear in
 *     implementation but are absent from the declared objectives.
 *   - `allowed: true` (silent) when no signals are detected.
 */
export function evaluateScopeCreep(context: ScopeCreepValidationContext): ValidationResult {
  const { objectives, implementationContent, title, outOfScopeItems } = context

  // Skip if we have nothing meaningful to compare
  if (!objectives.trim() || !implementationContent.trim()) {
    return { allowed: true }
  }

  const errors: string[] = []
  const warnings: string[] = []

  const normImpl = normalize(implementationContent)
  const normObjectives = normalize(objectives)

  // ── 1) Hard check: explicit out-of-scope violations ────────────────────────
  // If the caller identified items declared "Out of Scope" and any appear
  // verbatim in the implementation, that is a concrete planning error.
  if (outOfScopeItems && outOfScopeItems.length > 0) {
    for (const item of outOfScopeItems) {
      const normItem = normalize(item)
      if (normItem.length >= 5 && normImpl.includes(normItem)) {
        errors.push(
          `Scope violation in "${title}": ` +
            `"${item}" is declared Out of Scope but appears in the implementation content. ` +
            `Remove this work or move it to a separate proposal.`
        )
      }
    }
  }

  // ── 2) Soft check: scope-expansion signal words ─────────────────────────────
  // Flag when expansion verbs appear in implementation but NOT in objectives.
  // This catches unsolicited refactoring, migrations, etc. that sneak in.
  if (EXPANSION_RE.test(normImpl)) {
    const objectivesTokens = tokens(normObjectives)
    const matchedSignals: string[] = []

    for (const signal of SCOPE_EXPANSION_SIGNALS) {
      const signalRe = new RegExp(signal, 'i')
      if (!signalRe.test(normImpl)) continue

      // Only flag if the signal word/phrase is absent from the objectives
      const signalBaseWord = signal.replace(/[.*?+]/g, ' ').trim().split(/\s+/)[0]
      if (signalBaseWord && !objectivesTokens.has(signalBaseWord)) {
        // Extract a short snippet for context
        const snippetMatch = new RegExp(`.{0,40}${signal}.{0,40}`, 'i').exec(normImpl)
        const snippet = snippetMatch ? `…${snippetMatch[0].trim()}…` : signal
        matchedSignals.push(snippet)
      }
    }

    if (matchedSignals.length > 0) {
      warnings.push(
        `Possible scope drift in "${title}": ` +
          `implementation contains scope-expanding language absent from the declared objectives. ` +
          `Verify each item is necessary to satisfy the gate goal, or split into a separate proposal. ` +
          `Signals: ${matchedSignals.slice(0, 3).map((s) => `"${s}"`).join(', ')}`
      )
    }
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

