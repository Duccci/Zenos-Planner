/**
 * Template Sections Validator
 *
 * Parses required and optional sections from Zeno markdown templates, then
 * validates that a proposal (or gate) document contains every required section.
 *
 * Design:
 *   - `parseTemplateSections` is pure: it only reads the template string you
 *     supply, so callers control where / when I/O happens.
 *   - `validateTemplateSections` is pure: it works only with in-memory strings.
 *   - `loadTemplateSections` handles the async file-read and caches the result
 *     per template path to avoid redundant I/O within a single process.
 *
 * A template section is marked **optional** when the first non-empty line of
 * its body starts with `[Optional` (matching the convention used in
 * `proposal-template.md` and `gate-prd-template.md`).
 */

import { join } from 'path'
import { readFile } from '../../utils/file.js'
import type { ValidationResult } from './types.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateSections {
  required: string[]
  optional: string[]
  /** True when the template itself begins with a YAML frontmatter block (---). */
  hasFrontmatter: boolean
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

/**
 * Extract all level-2 (`##`) headings from a markdown template string, split
 * into required vs optional buckets.
 *
 * Optional detection: the first non-blank line of a section body that starts
 * with `[Optional` (case-sensitive, matches template convention).
 */
export function parseTemplateSections(templateContent: string): TemplateSections {
  const required: string[] = []
  const optional: string[] = []
  const hasFrontmatter = /^---\s*\n[\s\S]*?\n---/m.test(templateContent.trimStart())

  // Split on lines that start with '## ', retaining the delimiter so each
  // chunk begins with its own heading.
  const rawSections = templateContent.split(/(?=^## )/m)

  for (const chunk of rawSections) {
    const trimmed = chunk.trimStart()
    if (!trimmed.startsWith('## ')) continue // skip preamble / h3+ sections

    const newlineIdx = trimmed.indexOf('\n')
    const headingRaw = newlineIdx === -1 ? trimmed : trimmed.slice(0, newlineIdx)
    // Strip trailing whitespace / carriage returns from the heading line
    const heading = headingRaw.trimEnd()
    const body = newlineIdx === -1 ? '' : trimmed.slice(newlineIdx + 1)

    // Inspect the first non-blank line of the body to detect [Optional
    const firstContentLine = body
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0)

    if (firstContentLine?.startsWith('[Optional')) {
      optional.push(heading)
    } else {
      required.push(heading)
    }
  }

  return { required, optional, hasFrontmatter }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that a proposal document contains every required section defined
 * in the template.  Missing required sections are errors; missing optional
 * sections are warnings.
 *
 * @param proposalContent - The content of the proposal document
 * @param templateSections - Parsed template sections (required vs optional)
 * @param isGateTied - True if this is a gate-tied proposal (skips solitary-only sections like "## Single-Phase Requirement")
 */
export function validateTemplateSections(
  proposalContent: string,
  templateSections: TemplateSections,
  isGateTied?: boolean
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check frontmatter presence (warning only — existing files may predate the template update)
  if (templateSections.hasFrontmatter && !/^---\s*\n[\s\S]*?\n---/m.test(proposalContent.trimStart())) {
    warnings.push(
      'Missing zeno frontmatter block (---\nzeno:\n  ...\n---). ' +
        'Add the frontmatter header so registry rebuild can reconstruct this entry without regex fallback.'
    )
  }

  for (const section of templateSections.required) {
    if (!proposalContent.includes(section)) {
      errors.push(`Missing required section: "${section}"`)
    }
  }

  for (const section of templateSections.optional) {
    // Skip "## Single-Phase Requirement" for gate-tied proposals.
    // This section is guidance for solitary proposals only; gate-tied proposals
    // enforce single-phase through the test-first gate pattern (testing/implementation/cleanup roles).
    if (isGateTied && section === '## Single-Phase Requirement') {
      continue
    }

    if (!proposalContent.includes(section)) {
      warnings.push(`Missing optional section: "${section}"`)
    }
  }

  // Warn about sections in the document that are not defined in the template.
  // Only meaningful when the template itself declares at least one section.
  const knownSections = new Set([...templateSections.required, ...templateSections.optional])
  if (knownSections.size > 0) {
    const contentHeadings = [...proposalContent.matchAll(/^(## .+)$/gm)].map((m) =>
      (m[1] ?? '').trimEnd()
    )
    for (const heading of contentHeadings) {
      if (!knownSections.has(heading)) {
        warnings.push(`Extraneous section: "${heading}" is not defined in the template`)
      }
    }
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

// ---------------------------------------------------------------------------
// I/O helper with per-process cache
// ---------------------------------------------------------------------------

const _sectionCache = new Map<string, TemplateSections>()

/**
 * Load the appropriate template for the given artifact type, parse its
 * sections, and return them.  Results are cached by file path so the template
 * is only read once per process lifetime.
 *
 * @param artifactType - 'proposal' | 'gate'
 * @param projectRoot  - Absolute path to the project root (defaults to cwd)
 */
export async function loadTemplateSections(
  artifactType: 'proposal' | 'gate',
  projectRoot: string = process.cwd()
): Promise<TemplateSections> {
  const templateFile =
    artifactType === 'proposal' ? 'proposal-template.md' : 'gate-prd-template.md'

  const templatePath = join(projectRoot, 'templates', 'md-templates', templateFile)

  if (_sectionCache.has(templatePath)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return _sectionCache.get(templatePath)!
  }

  const content = await readFile(templatePath)
  const sections = parseTemplateSections(content)
  _sectionCache.set(templatePath, sections)
  return sections
}

/**
 * Clear the section cache (useful in tests and after template edits).
 */
export function clearTemplateSectionsCache(): void {
  _sectionCache.clear()
}
