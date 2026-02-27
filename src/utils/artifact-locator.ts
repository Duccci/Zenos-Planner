/**
 * Artifact Locator
 *
 * Central helpers for resolving Zeno artifact files on disk.
 * Artifact files are NOT named by their identifier:
 *  - Proposal files: date-named (`YYYY-MM-DD-NN-title.md`), hash embedded in frontmatter
 *  - Gate files:     `gate-NN-full-name.md`, gate ID is the short prefix (`gate-NN`)
 *
 * All MCP tools and core modules should import from here instead of
 * maintaining their own path-construction logic.
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { existsSync } from 'node:fs'
import { getZenoDir } from './config.js'

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Walk a directory recursively, yielding `.md` file paths.
 * Skips `archive` subdirectories so archived artifacts are never matched.
 */
async function* walkMdFiles(dir: string): AsyncGenerator<string> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === 'archive') continue
    const full = join(dir, entry)
    try {
      const s = await stat(full)
      if (s.isDirectory()) {
        yield* walkMdFiles(full)
      } else if (s.isFile() && entry.endsWith('.md')) {
        yield full
      }
    } catch {
      continue
    }
  }
}

// ─── Proposal locator ────────────────────────────────────────────────────────

/**
 * Find a proposal file by its embedded hash frontmatter.
 *
 * Proposal files are named by date (e.g. `2026-02-24-01-title.md`), not by
 * hash, so every `.md` file under `zeno/proposals/` is scanned for a
 * `**Hash**: #?<hash>` line.
 *
 * @returns Absolute path to the matching file, or `null` if not found.
 */
export async function findProposalByHash(
  hash: string,
  projectRoot = process.cwd()
): Promise<string | null> {
  const proposalsDir = join(projectRoot, 'zeno', 'proposals')
  if (!existsSync(proposalsDir)) return null

  const hashPattern = new RegExp(`\\*\\*Hash\\*\\*:\\s*#?${hash}(?:[^a-zA-Z0-9_-]|$)`)

  for await (const filePath of walkMdFiles(proposalsDir)) {
    try {
      const content = await readFile(filePath, 'utf-8')
      if (hashPattern.test(content)) return filePath
    } catch {
      continue
    }
  }

  return null
}

/**
 * Derive gate relationship information from a resolved proposal file path.
 *
 * @returns `{ type: 'solitary' }` when in `proposals/solitary/`,
 *          `{ type: 'gate-tied', gateId }` when in `proposals/gate-XX/`
 */
export function resolveProposalGateInfo(
  filePath: string
): { type: 'gate-tied' | 'solitary'; gateId?: string } {
  const parentDir = basename(dirname(filePath))
  if (parentDir === 'solitary') {
    return { type: 'solitary' }
  }
  if (parentDir.startsWith('gate-')) {
    return { type: 'gate-tied', gateId: parentDir }
  }
  return { type: 'solitary' }
}

// ─── Gate locator ────────────────────────────────────────────────────────────

/**
 * Locate the gate PRD file for the given gate ID.
 *
 * Gate files are named `gate-NN-full-name.md` (e.g. `gate-06-api-layer.md`)
 * while the gate ID in the DB is the short prefix form (`gate-06`).
 *
 * Searches `zeno/gates/` for a filename that is either:
 * - exactly `${gateId}.md` (legacy), or
 * - starts with `${gateId}-` (canonical naming)
 *
 * @param gateId      Short gate ID, e.g. `gate-06`
 * @param projectRoot Optional project root; defaults to `getZenoDir()/../..`
 * @returns Absolute path to the gate file, or `null` if not found
 */
export async function findGateByGateId(
  gateId: string,
  projectRoot?: string
): Promise<string | null> {
  const gatesDir = projectRoot
    ? join(projectRoot, 'zeno', 'gates')
    : join(getZenoDir(), '..', 'gates')

  let entries: string[]
  try {
    entries = await readdir(gatesDir)
  } catch {
    return null
  }

  const match = entries.find((e) => e === `${gateId}.md` || e.startsWith(`${gateId}-`))
  return match ? join(gatesDir, match) : null
}
