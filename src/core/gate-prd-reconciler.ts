/**
 * Gate PRD Reconciler
 *
 * Rewrites the auto-managed sections of a gate PRD file (Requirements and
 * Proposals) with live data queried from the SQLite registry DB.
 *
 * Auto-managed sections are delimited by HTML comment markers:
 *   <!-- ZENO:AUTO:START:requirements --> … <!-- ZENO:AUTO:END:requirements -->
 *   <!-- ZENO:AUTO:START:proposals -->    … <!-- ZENO:AUTO:END:proposals -->
 *
 * On the first reconciliation pass (before markers exist) the function locates
 * the known placeholder strings and wraps them in the markers before replacing
 * content, so subsequent passes use the faster marker-based path.
 */

import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from '../utils/file.js'
import { findGateByGateId } from '../utils/artifact-locator.js'
import { getDatabase } from '../storage/database.js'
import { logger } from '../utils/logger.js'

const __installDir = fileURLToPath(new URL('../..', import.meta.url))

// ─── Marker constants ────────────────────────────────────────────────────────

const REQ_START = '<!-- ZENO:AUTO:START:requirements -->'
const REQ_END = '<!-- ZENO:AUTO:END:requirements -->'
const PROP_START = '<!-- ZENO:AUTO:START:proposals -->'
const PROP_END = '<!-- ZENO:AUTO:END:proposals -->'

// ─── DB row types ────────────────────────────────────────────────────────────

interface RequirementRow {
  hash: string
  name: string
  type: string
  priority: string
  status: string
}

interface ProposalRow {
  hash: string
  title: string | null
  status: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function computeTemplateHash(): string {
  const templatePath = join(__installDir, 'templates', 'md-templates', 'gate-prd-template.md')
  const raw = readFileSync(templatePath, 'utf-8')
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

function buildRequirementsBlock(rows: RequirementRow[]): string {
  const header = [
    '| Hash | Name | Type | Priority | Status |',
    '| ---- | ---- | ---- | -------- | ------ |',
  ]
  const dataRows =
    rows.length > 0
      ? rows.map(r => `| #${r.hash} | ${r.name} | ${r.type} | ${r.priority} | ${r.status} |`)
      : ['| — | No requirements generated yet | — | — | — |']
  return [...header, ...dataRows].join('\n')
}

function buildProposalsBlock(rows: ProposalRow[]): string {
  const header = [
    '| Proposal | Hash | Status |',
    '| -------- | ---- | ------ |',
  ]
  const dataRows =
    rows.length > 0
      ? rows.map(r => `| ${r.title ?? '(untitled)'} | #${r.hash} | ${r.status ?? 'pending'} |`)
      : ['| — | No proposals generated yet | — |']
  return [...header, ...dataRows].join('\n')
}

/**
 * Replace (or insert) the content between a pair of marker comments.
 *
 * If the markers are already present the content between them is replaced.
 * If they are absent the known placeholder text is wrapped in markers, then
 * the content is replaced. Returns the updated document string.
 */
function replaceMarkerSection(
  content: string,
  startMarker: string,
  endMarker: string,
  newBody: string,
  placeholderPattern: RegExp
): string {
  const startIdx = content.indexOf(startMarker)
  const endIdx = content.indexOf(endMarker)

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Markers already present — replace body between them.
    const before = content.slice(0, startIdx + startMarker.length)
    const after = content.slice(endIdx)
    return `${before}\n${newBody}\n${after}`
  }

  // Markers absent — locate placeholder and wrap it.
  const match = placeholderPattern.exec(content)
  if (!match) {
    // No placeholder found; nothing to do for this section.
    return content
  }

  const replaced = content.slice(0, match.index) +
    `${startMarker}\n${newBody}\n${endMarker}` +
    content.slice(match.index + match[0].length)
  return replaced
}

/**
 * Write `template_hash` into the YAML frontmatter of a gate PRD string.
 *
 * If a `template_hash` key already exists it is updated; otherwise it is
 * appended before the closing `---`.
 */
function upsertTemplateHash(content: string, hash: string): string {
  const frontmatterEnd = content.indexOf('\n---', 3)
  if (frontmatterEnd === -1) return content

  const existingHashRe = /^(\s*template_hash:\s*)(.+)$/m
  if (existingHashRe.test(content.slice(0, frontmatterEnd))) {
    return content.replace(existingHashRe, `$1'${hash}'`)
  }

  // Insert before the closing ---
  const insertAt = frontmatterEnd
  return content.slice(0, insertAt) + `\n  template_hash: '${hash}'` + content.slice(insertAt)
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Reconcile the gate PRD file for `gateId` with live DB data.
 *
 * - Replaces the auto-managed Requirements and Proposals sections with live rows.
 * - Embeds `template_hash` in YAML frontmatter.
 * - Preserves all user-edited content outside the auto-managed sections.
 * - Handles a missing gate file gracefully (logs a warning, returns without error).
 */
export async function reconcileGatePRD(
  gateId: string,
  projectRoot: string
): Promise<void> {
  const gatePath = await findGateByGateId(gateId, projectRoot)
  if (!gatePath || !existsSync(gatePath)) {
    logger.warn(`reconcileGatePRD: gate file not found for "${gateId}", skipping.`)
    return
  }

  let content = await readFile(gatePath)

  // ── Fetch live requirements ──────────────────────────────────────────────
  let reqRows: RequirementRow[] = []
  let propRows: ProposalRow[] = []
  try {
    const db = getDatabase(projectRoot)
    reqRows = db
      .prepare(
        `SELECT hash, name, type, priority, status
         FROM requirements
         WHERE gate_id LIKE ?
         ORDER BY created_at ASC`
      )
      .all(`%${gateId}%`) as RequirementRow[]

    propRows = db
      .prepare(
        `SELECT hash, title, status
         FROM proposals
         WHERE gate_id LIKE ?
         ORDER BY created_at ASC`
      )
      .all(`%${gateId}%`) as ProposalRow[]
  } catch (err) {
    logger.warn(`reconcileGatePRD: DB query failed for "${gateId}": ${String(err)}`)
    // Continue — still write template_hash even if DB is unavailable.
  }

  // ── Requirements section ─────────────────────────────────────────────────
  const reqPlaceholder =
    /\*\*Status\*\*: Requirements will be generated when gate is started\.\s*\n[^\n]*\n?/
  content = replaceMarkerSection(
    content,
    REQ_START,
    REQ_END,
    buildRequirementsBlock(reqRows),
    reqPlaceholder
  )

  // ── Proposals section ────────────────────────────────────────────────────
  const propPlaceholder =
    /\*\*Status\*\*: Proposals will be generated when gate is started\.\s*\n[^\n]*\n?/
  content = replaceMarkerSection(
    content,
    PROP_START,
    PROP_END,
    buildProposalsBlock(propRows),
    propPlaceholder
  )

  // ── template_hash in frontmatter ─────────────────────────────────────────
  const templateHash = computeTemplateHash()
  content = upsertTemplateHash(content, templateHash)

  await writeFile(gatePath, content)
}
