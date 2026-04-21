/**
 * Frontmatter Utilities
 *
 * Reads and writes a `zeno:` YAML block at the top of gate and proposal
 * markdown files.  The frontmatter is the machine-readable source of truth
 * that lets `zeno registry rebuild` reconstruct the SQLite registry from
 * version-controlled files alone.
 *
 * Format (exactly two `---` fence lines, YAML content in between):
 *
 *   ---
 *   zeno:
 *     hash: 1f01eca0
 *     gate_id: gate-06
 *     status: validated
 *     created_at: '2026-03-01'
 *   ---
 *
 *   # Proposal: …
 *
 * Parsing strategy
 *   1. Try to parse the `zeno:` sub-tree from YAML frontmatter.
 *   2. If absent or invalid, fall back to the caller's regex-based extraction.
 *
 * Writing strategy
 *   - `serializeProposalFrontmatter` / `serializeGateFrontmatter` produce the
 *     block from scratch, omitting null / undefined values.
 *   - `patchFrontmatter` replaces the existing block (or prepends a new one)
 *     with updated data — used by approval / rejection / start handlers to
 *     keep the file in sync with lifecycle changes.
 */

import yaml from 'js-yaml'

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface ZenoProposalFrontmatter {
  hash: string
  gate_id?: string | null
  requirement_id?: string | null
  status?: string
  created_at?: string | null
  parallel_set_index?: number | null
  // lifecycle fields — only present after the relevant event
  approved_at?: string | null
  approved_by?: string | null
  rejected_at?: string | null
  rejected_by?: string | null
  started_at?: string | null
  started_by?: string | null
  implemented_at?: string | null
}

export interface ZenoGateFrontmatter {
  id: string
  name: string
  sequence: number
  type: string
  status: string
  hash: string
  project_id?: string
  created_at?: string | null
  completed_at?: string | null
  depends_on?: string[]
  /** Delivery milestone labels (e.g. 1, 'MVP', 'Post-MVP', 'May Demo'). Multiple allowed. */
  milestones?: (number | string)[]
}

type ZenoFrontmatter = ZenoProposalFrontmatter | ZenoGateFrontmatter

interface RawFrontmatter {
  zeno?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Matches the opening ---…--- frontmatter block (must start at line 1). */
const FENCE_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

/** Replace the YAML/frontmatter status line when a zeno block is present. */
function patchFrontmatterStatusLine(content: string, status: string): string {
  const match = FENCE_RE.exec(content)
  if (!match?.[0] || !match[1]) return content

  const patchedInner = match[1].replace(/^(\s*status:\s*).+$/m, `$1${status}`)
  if (patchedInner === match[1]) return content

  return content.replace(match[0], match[0].replace(match[1], patchedInner))
}

/** Replace the top-level markdown header status line before the first section. */
function patchHeaderStatusLine(content: string, status: string): string {
  const frontmatterLength = FENCE_RE.exec(content)?.[0].length ?? 0
  const firstSectionIndex = content.indexOf('\n## ', frontmatterLength)
  const headerEnd = firstSectionIndex === -1 ? content.length : firstSectionIndex
  const header = content.slice(frontmatterLength, headerEnd)
  const patchedHeader = header.replace(/^(\*\*Status\*\*:\s*).+$/m, `$1${status}`)

  if (patchedHeader === header) return content
  return content.slice(0, frontmatterLength) + patchedHeader + content.slice(headerEnd)
}

/**
 * Remove the frontmatter fence (if present) and return the rest of the file.
 */
export function stripFrontmatter(content: string): string {
  return content.replace(FENCE_RE, '')
}

/**
 * Parse the raw YAML inside the `---` fence and return the `zeno:` sub-object,
 * or `null` when the block is absent, malformed, or has no `zeno` key.
 */
export function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = FENCE_RE.exec(content)
  if (!match?.[1]) return null
  try {
    const parsed = yaml.load(match[1]) as RawFrontmatter | null
    if (!parsed?.zeno || typeof parsed.zeno !== 'object') return null
    return parsed.zeno
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize a zeno metadata object into a YAML frontmatter block string.
 * Entries whose value is `null` or `undefined` are omitted to keep files tidy.
 */
function serialize(data: ZenoFrontmatter): string {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
  ) as Record<string, unknown>

  // Emit arrays (depends_on) with block style for readability
  const dumped = yaml.dump({ zeno: clean }, { indent: 2, lineWidth: 120 })
  return `---\n${dumped}---\n`
}

/** Build a frontmatter block for a newly generated proposal. */
export function serializeProposalFrontmatter(data: ZenoProposalFrontmatter): string {
  return serialize(data)
}

/** Build a frontmatter block for a gate markdown file. */
export function serializeGateFrontmatter(data: ZenoGateFrontmatter): string {
  return serialize(data)
}

// ─────────────────────────────────────────────────────────────────────────────
// In-place patching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add or replace the `---…---` frontmatter in a markdown file's content with
 * `data`.  Non-zeno keys that existed in the original frontmatter are
 * preserved.
 *
 * Used by lifecycle-transition handlers (approve, reject, start) to write
 * updated metadata back to the `.md` file after a DB state change.
 */
export function patchFrontmatter(content: string, data: ZenoFrontmatter): string {
  const body = stripFrontmatter(content)
  return serialize(data) + body
}

/**
 * Keep the machine-readable zeno frontmatter and the human-readable markdown
 * header aligned for lifecycle status transitions.
 */
export function patchZenoStatus(content: string, status: string): string {
  return patchHeaderStatusLine(patchFrontmatterStatusLine(content, status), status)
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed parsers
// ─────────────────────────────────────────────────────────────────────────────

/** Parse proposal-flavoured frontmatter.  Returns null when absent. */
export function parseProposalFrontmatter(content: string): ZenoProposalFrontmatter | null {
  const raw = parseFrontmatter(content)
  if (!raw) return null
  if (typeof raw['hash'] !== 'string') return null
  return {
    hash: raw['hash'],
    gate_id: (raw['gate_id'] as string | null | undefined) ?? null,
    requirement_id: (raw['requirement_id'] as string | null | undefined) ?? null,
    status: raw['status'] as string | undefined,
    created_at: (raw['created_at'] as string | null | undefined) ?? null,
    approved_at: (raw['approved_at'] as string | null | undefined) ?? null,
    approved_by: (raw['approved_by'] as string | null | undefined) ?? null,
    rejected_at: (raw['rejected_at'] as string | null | undefined) ?? null,
    rejected_by: (raw['rejected_by'] as string | null | undefined) ?? null,
    started_at: (raw['started_at'] as string | null | undefined) ?? null,
    started_by: (raw['started_by'] as string | null | undefined) ?? null,
    implemented_at: (raw['implemented_at'] as string | null | undefined) ?? null,
  }
}

/** Parse gate-flavoured frontmatter.  Returns null when absent. */
export function parseGateFrontmatter(content: string): ZenoGateFrontmatter | null {
  const raw = parseFrontmatter(content)
  if (!raw) return null
  if (typeof raw['id'] !== 'string') return null
  if (typeof raw['name'] !== 'string') return null
  if (typeof raw['hash'] !== 'string') return null
  return {
    id: raw['id'],
    name: raw['name'],
    sequence: Number(raw['sequence'] ?? 0),
    type: (raw['type'] as string | undefined) ?? 'feature',
    status: (raw['status'] as string | undefined) ?? 'pending',
    hash: raw['hash'],
    project_id: (raw['project_id'] as string | undefined) ?? 'default-project',
    created_at: (raw['created_at'] as string | null | undefined) ?? null,
    completed_at: (raw['completed_at'] as string | null | undefined) ?? null,
    depends_on: Array.isArray(raw['depends_on']) ? raw['depends_on'] as string[] : [],
    milestones: Array.isArray(raw['milestones']) ? raw['milestones'] as (number | string)[] : undefined,
  }
}
