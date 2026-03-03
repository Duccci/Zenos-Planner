/**
 * Section Implementation Validator
 *
 * Validates that each section of an artifact document is actually IMPLEMENTED
 * (filled with real content) not merely PRESENT (heading exists).
 *
 * Two complementary dimensions:
 *   Quantitative — word count, item count, checkbox count, table rows
 *   Qualitative  — absence of placeholder text, template boilerplate, LLM context
 *                  injections, stale markers
 *
 * Design:
 *   - ALL detection is DYNAMIC — derived from the template itself. There are no
 *     hardcoded lists of phrases, patterns, or expected sections.
 *   - `parseSectionSpecs` is pure: derives per-section requirements from the
 *     raw template string (no I/O). Callers control file reading.
 *   - `validateSectionImplementation` is pure: compares an in-memory document
 *     against the pre-parsed specs.
 *   - Scores are 0–100 per section; `overallScore` is the unweighted mean.
 *
 * Dynamic extraction (all derived from the template, zero hardcoded values):
 *   llmInstructionFragments — fingerprints of HTML comment blocks that are
 *     LLM instructions; these blocks MUST NOT appear in the artifact.
 *   scaffoldFingerprints    — fingerprints of non-placeholder instructional-prose
 *     lines in the template body that should be replaced with real content.
 *
 * Score deductions (cumulative, clamped to 0):
 *   -25  section body is empty or only whitespace / comments
 *   -20  each unreplaced bracket placeholder  ([...] that looks descriptive)
 *   -10  each double-brace template variable  ({{VAR}})
 *   -10  each stale marker                    (TBD | TODO | FIXME | PLACEHOLDER)
 *   -20  LLM instruction comment bleed detected in section
 *   - 5  each scaffold fingerprint found verbatim (max -20 per section)
 *   -10  word count below section minimum
 *
 * Errors are raised for required sections; warnings for optional sections.
 */

import { join } from 'path'
import { readFile } from '../../utils/file.js'
import type { ValidationResult } from './types.js'

// ---------------------------------------------------------------------------
// Base regex constants (structural, not content-specific)
// ---------------------------------------------------------------------------

/** Matches descriptive bracket placeholders, e.g. [2-3 sentence description].
 *  Excludes: Markdown links [text](url), checkboxes [x]/[ ], short labels (<4 chars). */
const BRACKET_PLACEHOLDER_RE = /\[[^\]]{4,120}\](?!\s*\()/g

/** Double-brace template variables: {{OBJECTIVE}}, {{DATE}} */
const DOUBLE_BRACE_RE = /\{\{[A-Za-z_][A-Za-z0-9_]*\}\}/g

/** Stale development markers */
const STALE_MARKER_RE = /\b(TBD|TODO|FIXME|PLACEHOLDER|COMING\s+SOON)\b/gi

/** HTML comment blocks — includes content that could bleed into artifacts */
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g

/** Markers that identify a line as pure markdown structure (not content) */
const MARKDOWN_STRUCTURE_RE = /^(?:#{1,6}\s|[-*]{3,}$|\|[-| :]+\||\s*$)/

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Per-section requirements inferred from the template body.
 * All fields are derived dynamically from the template — no hardcoded values.
 */
export interface SectionSpec {
  /** Full heading as it appears in the template, e.g. "## Summary" */
  heading: string
  /** True when the first non-empty body line starts with "[Optional" */
  isOptional: boolean
  /** Template body with HTML comments stripped */
  templateBody: string
  /** Number of placeholder patterns found in the template body */
  placeholderCount: number
  /** Template body contains at least one checkbox "- [ ]" or "- [x]" */
  requiresCheckboxes: boolean
  /** Template body contains at least one markdown list bullet */
  requiresList: boolean
  /** Template body contains at least one markdown table row */
  requiresTable: boolean
  /** Minimum word count expected in the implemented section */
  minWords: number
  /**
   * Fingerprints extracted from HTML instruction comment blocks in this
   * section's template body.  These represent LLM-context injections that
   * exist ONLY to guide generation — they must NOT appear in the final
   * artifact.  Each fingerprint is the first 60 chars of a qualifying
   * comment line (length >= 20, not pure decoration).
   */
  llmInstructionFragments: string[]
  /**
   * Fingerprints of instructional-prose lines in the template body
   * (after comment stripping) that should be replaced with real content.
   * Derived dynamically by extracting non-placeholder, non-structural lines
   * of sufficient length.  Each fingerprint is the first 45 chars of the
   * trimmed line (leading list markers removed).
   */
  scaffoldFingerprints: string[]
}

/**
 * Quality score for a single section.
 */
export interface SectionScore {
  /** Heading text, e.g. "## Summary" */
  section: string
  /** 0–100 composite score */
  score: number
  /** Word count in the implemented section body */
  wordCount: number
  /** Number of unreplaced placeholders remaining in the section */
  placeholderCount: number
  /** True when the section has meaningful content beyond placeholders */
  hasContent: boolean
  /** Human-readable issue descriptions (include severity prefix "error:" / "warn:") */
  issues: string[]
  /** LLM instruction fragments detected in the artifact section, if any */
  llmBleed?: string[]
}

/**
 * Aggregate result from implementation validation across all sections.
 */
export interface SectionImplementationResult extends ValidationResult {
  /** Unweighted mean score across all validated sections (0–100) */
  overallScore: number
  /** Per-section breakdown */
  sectionScores: SectionScore[]
}

// ---------------------------------------------------------------------------
// Dynamic extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract LLM instruction fragments from HTML comment blocks in a raw template
 * body string (before comment stripping).
 *
 * Strategy:
 *   1. Match every <!-- … --> block.
 *   2. Split each block into lines and keep lines that:
 *      - are at least 20 chars long
 *      - are not pure horizontal decoration (all dashes, equals, stars)
 *   3. Return up to 6 fingerprints per block (first 60 chars of each line).
 *
 * The fingerprints are used to detect if LLM instruction content has leaked
 * into the final artifact.
 */
export function extractLLMInstructionFragments(rawBody: string): string[] {
  const fragments: string[] = []
  let match: RegExpExecArray | null
  const commentPattern = /<!--([\s\S]*?)-->/g

   
  while ((match = commentPattern.exec(rawBody)) !== null) {
    const commentText = match[1] ?? ''
    let blockCount = 0
    for (const line of commentText.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length < 20) continue
      if (/^[-=*#\s]+$/.test(trimmed)) continue // pure decoration
      fragments.push(trimmed.slice(0, 60))
      blockCount++
      if (blockCount >= 6) break
    }
  }

  return fragments
}

/**
 * Extract scaffold fingerprints from a comment-stripped template section body.
 *
 * A "scaffold line" is an instructional-prose line in the template that an
 * implementer must replace with real content.  We identify scaffold lines
 * dynamically by the following criteria (all purely structural):
 *
 *   1. The line is non-empty after trimming.
 *   2. It is not a pure markdown structural element (heading, HR, table separator).
 *   3. It is not a lone placeholder token `[…]` (those are tracked separately).
 *   4. After stripping leading list markers (`-`, `*`, list continuation spaces)
 *      the remaining text is at least 25 chars and at least 4 words.
 *   5. The line is NOT itself a checkbox item `- [ ]` / `- [x]`.
 *
 * Each fingerprint = first 45 chars of the stripped line (deduplicated).
 */
export function extractScaffoldFingerprints(commentStrippedBody: string): string[] {
  const seen = new Set<string>()
  const fingerprints: string[] = []

  for (const rawLine of commentStrippedBody.split('\n')) {
    const trimmed = rawLine.trim()

    // Skip empty and structural markdown
    if (!trimmed || MARKDOWN_STRUCTURE_RE.test(trimmed)) continue

    // Skip checkbox items
    if (/^-\s+\[[ x]\]/i.test(trimmed)) continue

    // Strip leading list marker to get the content
    const content = trimmed.replace(/^[-*]\s+/, '')

    // Skip if too short or too few words
    if (content.length < 25) continue
    const words = content.split(/\s+/).filter((w) => w.length > 1)
    if (words.length < 4) continue

    // Skip if the entire content is a single bracket placeholder
    if (/^\[[^\]]{4,120}\]$/.test(content)) continue

    const fingerprint = content.slice(0, 45)
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint)
      fingerprints.push(fingerprint)
    }
  }

  return fingerprints
}

// ---------------------------------------------------------------------------
// parseSectionSpecs
// ---------------------------------------------------------------------------

/**
 * Parse a template string and return a `SectionSpec` for every `## ` section
 * found.  All detection is fully dynamic — derived from the template content,
 * no hardcoded values.
 */
export function parseSectionSpecs(templateContent: string): SectionSpec[] {
  const specs: SectionSpec[] = []

  const rawSections = templateContent.split(/(?=^## )/m)

  for (const chunk of rawSections) {
    const trimmed = chunk.trimStart()
    if (!trimmed.startsWith('## ')) continue

    const newlineIdx = trimmed.indexOf('\n')
    const heading = (newlineIdx === -1 ? trimmed : trimmed.slice(0, newlineIdx)).trimEnd()
    const rawBody = newlineIdx === -1 ? '' : trimmed.slice(newlineIdx + 1)

    // ── LLM instruction fragments (before stripping comments) ──────────────
    const llmInstructionFragments = extractLLMInstructionFragments(rawBody)

    // ── Strip comments for remaining analysis ──────────────────────────────
    const body = rawBody.replace(HTML_COMMENT_RE, '')

    // ── Optional detection ─────────────────────────────────────────────────
    const firstContentLine = body
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0)
    const isOptional = firstContentLine?.startsWith('[Optional') ?? false

    // ── Placeholder count ──────────────────────────────────────────────────
    const bracketMatches = body.match(BRACKET_PLACEHOLDER_RE) ?? []
    const doubleBraceMatches = body.match(DOUBLE_BRACE_RE) ?? []
    const placeholderCount = bracketMatches.length + doubleBraceMatches.length

    // ── Structural feature detection ───────────────────────────────────────
    const requiresCheckboxes = /- \[[ x]\]/i.test(body)
    const requiresList = /^\s*[-*]\s+\S/m.test(body)
    const requiresTable = /\|.+\|.+\|/.test(body)

    // ── Minimum word threshold (15% of template body density, min 5) ───────
    const cleanBody = body.replace(/[#|*`[]{}()>-]/g, ' ')
    const templateWords = cleanBody.split(/\s+/).filter((w) => w.length > 2).length
    const minWords = Math.max(5, Math.floor(templateWords * 0.15))

    // ── Scaffold fingerprints (dynamic) ────────────────────────────────────
    const scaffoldFingerprints = extractScaffoldFingerprints(body)

    specs.push({
      heading,
      isOptional,
      templateBody: body,
      placeholderCount,
      requiresCheckboxes,
      requiresList,
      requiresTable,
      minWords,
      llmInstructionFragments,
      scaffoldFingerprints,
    })
  }

  return specs
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function splitDocumentSections(content: string): Map<string, string> {
  const map = new Map<string, string>()
  const rawSections = content.split(/(?=^## )/m)

  for (const chunk of rawSections) {
    const trimmed = chunk.trimStart()
    if (!trimmed.startsWith('## ')) continue

    const newlineIdx = trimmed.indexOf('\n')
    const heading = (newlineIdx === -1 ? trimmed : trimmed.slice(0, newlineIdx)).trimEnd()
    const body = newlineIdx === -1 ? '' : trimmed.slice(newlineIdx + 1)
    map.set(heading, body)
  }

  return map
}

function countWords(text: string): number {
  return text
    .replace(HTML_COMMENT_RE, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#|*`[]{}()>_~-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2).length
}

/**
 * Count how many of this section's LLM instruction fragments appear in the
 * artifact body.  We check for the fragment (case-sensitive) or its fragment
 * inside an HTML comment block (which means the comment was copied verbatim).
 * Returns the matching fragments for diagnostic output.
 */
function findLLMBleed(artifactBody: string, fragments: string[]): string[] {
  return fragments.filter((fragment) => artifactBody.includes(fragment))
}

/**
 * Count how many scaffold fingerprints from the template appear unchanged in
 * the artifact body.  Only counts fingerprints that are NOT also substrings
 * of a placeholder (so real content that happens to start with the same chars
 * isn't incorrectly flagged).
 */
function countScaffoldMatches(artifactBody: string, fingerprints: string[]): number {
  let count = 0
  for (const fp of fingerprints) {
    if (artifactBody.includes(fp)) count++
  }
  return count
}

// ---------------------------------------------------------------------------
// scoreSection
// ---------------------------------------------------------------------------

function scoreSection(body: string, spec: SectionSpec): SectionScore {
  const issues: string[] = []
  let score = 100

  const cleanBody = body.replace(HTML_COMMENT_RE, '').trim()

  // ── emptiness check ──────────────────────────────────────────────────────
  if (cleanBody.length === 0) {
    return {
      section: spec.heading,
      score: 0,
      wordCount: 0,
      placeholderCount: 0,
      hasContent: false,
      issues: ['error: section body is empty'],
    }
  }

  // ── LLM instruction bleed ─────────────────────────────────────────────────
  // Check if any LLM context-injection fragments (from template HTML comments)
  // appear verbatim in the artifact section — they must not.
  const llmBleed = findLLMBleed(body, spec.llmInstructionFragments)
  if (llmBleed.length > 0) {
    score -= 20
    const firstFragmentPreview = llmBleed[0]?.slice(0, 40) ?? '(unknown)'
    issues.push(
      `${spec.isOptional ? 'warn' : 'error'}: LLM instruction content leaked into artifact ` +
        `(${String(llmBleed.length)} fragment(s) found ` +
        `e.g. "${firstFragmentPreview}…"`
    )
  }

  // ── placeholder check ────────────────────────────────────────────────────
  const remainingBracket = cleanBody.match(BRACKET_PLACEHOLDER_RE) ?? []
  const remainingDblBrace = cleanBody.match(DOUBLE_BRACE_RE) ?? []
  const remainingPlaceholders = remainingBracket.length + remainingDblBrace.length

  if (remainingPlaceholders > 0) {
    const deduction = Math.min(remainingPlaceholders * 20, 60)
    score -= deduction
    issues.push(
      `${spec.isOptional ? 'warn' : 'error'}: ${String(remainingPlaceholders)} unreplaced placeholder(s) found: ` +
        [...remainingBracket, ...remainingDblBrace].slice(0, 3).join(', ') +
        (remainingPlaceholders > 3 ? ` … (+${String(remainingPlaceholders - 3)} more)` : '')
    )
  }

  // ── stale markers ────────────────────────────────────────────────────────
  const staleMatches = cleanBody.match(STALE_MARKER_RE) ?? []
  const uniqueStale = [...new Set(staleMatches.map((m) => m.toUpperCase()))]
  if (uniqueStale.length > 0) {
    score -= uniqueStale.length * 10
    issues.push(
      `${spec.isOptional ? 'warn' : 'error'}: stale markers not replaced: ${uniqueStale.join(', ')}`
    )
  }

  // ── scaffold fingerprint check (fully dynamic — no hardcoded phrases) ─────
  const scaffoldCount = countScaffoldMatches(cleanBody, spec.scaffoldFingerprints)
  if (scaffoldCount > 0) {
    const deduction = Math.min(scaffoldCount * 5, 20)
    score -= deduction
    issues.push(
      `warn: ${String(scaffoldCount)} template scaffold line(s) appear unchanged — replace with real content`
    )
  }

  // ── word count ───────────────────────────────────────────────────────────
  const wordCount = countWords(cleanBody)
  if (wordCount < spec.minWords) {
    score -= 10
    issues.push(
      `warn: section word count (${String(wordCount)}) is below the expected minimum (${String(spec.minWords)})`
    )
  }

  // ── structural checks ────────────────────────────────────────────────────
  if (spec.requiresCheckboxes && !/- \[[ x]\]/i.test(cleanBody)) {
    score -= 10
    issues.push('warn: template requires checkboxes but none are present in this section')
  }

  if (spec.requiresList && !/^\s*[-*]\s+\S/m.test(cleanBody)) {
    score -= 5
    issues.push('warn: template requires a list but no list items found in this section')
  }

  if (spec.requiresTable && !/\|.+\|.+\|/.test(cleanBody)) {
    score -= 5
    issues.push('warn: template requires a table but no table row found in this section')
  }

  const hasContent = remainingPlaceholders === 0 && llmBleed.length === 0 && wordCount >= spec.minWords

  return {
    section: spec.heading,
    score: Math.max(0, score),
    wordCount,
    placeholderCount: remainingPlaceholders,
    hasContent,
    issues,
    ...(llmBleed.length > 0 ? { llmBleed } : {}),
  }
}

// ---------------------------------------------------------------------------
// validateSectionImplementation
// ---------------------------------------------------------------------------

/**
 * Validate that every section in `docContent` is implemented (not just present)
 * by comparing its body against the matching `SectionSpec` derived from the
 * template.
 *
 * Sections absent from the document are skipped here; heading-presence
 * checking in `validateTemplateSections` handles those.
 */
export function validateSectionImplementation(
  docContent: string,
  specs: SectionSpec[]
): SectionImplementationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sectionScores: SectionScore[] = []

  const docSections = splitDocumentSections(docContent)

  for (const spec of specs) {
    const body = docSections.get(spec.heading)
    if (body === undefined) continue // absence checked elsewhere

    const scored = scoreSection(body, spec)
    sectionScores.push(scored)

    for (const issue of scored.issues) {
      const isError = issue.startsWith('error:')
      const message = `"${spec.heading}" — ${issue.replace(/^(error|warn):\s*/, '')}`

      if (isError && !spec.isOptional) {
        errors.push(message)
      } else {
        warnings.push(message)
      }
    }
  }

  const overallScore =
    sectionScores.length > 0
      ? Math.round(sectionScores.reduce((sum, s) => sum + s.score, 0) / sectionScores.length)
      : 100

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    overallScore,
    sectionScores,
  }
}

// ---------------------------------------------------------------------------
// I/O helper with per-process cache
// ---------------------------------------------------------------------------

const _specCache = new Map<string, SectionSpec[]>()

export async function loadSectionSpecs(
  artifactType: 'proposal' | 'gate',
  projectRoot: string = process.cwd()
): Promise<SectionSpec[]> {
  const templateFile =
    artifactType === 'proposal' ? 'proposal-template.md' : 'gate-prd-template.md'
  const templatePath = join(projectRoot, 'templates', 'md-templates', templateFile)

  if (_specCache.has(templatePath)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return _specCache.get(templatePath)!
  }

  const content = await readFile(templatePath)
  const specs = parseSectionSpecs(content)
  _specCache.set(templatePath, specs)
  return specs
}

export function clearSectionSpecsCache(): void {
  _specCache.clear()
}
