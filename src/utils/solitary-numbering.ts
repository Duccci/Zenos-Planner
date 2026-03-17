/**
 * Solitary Proposal Numbering
 *
 * Computes auto-incremented sequence numbers for solitary proposals.
 *
 * Filename conventions:
 *   Standalone:  NN-slug.md        (NN = global sequence, e.g. 01, 02, 03)
 *   Chained:     NN-CC-slug.md     (NN = parent seq, CC = child seq)
 *
 * Parsing rule: if the filename starts with two consecutive 2-digit groups
 * (NN-CC-), treat it as a chained proposal; otherwise treat it as standalone.
 */

import { readdirSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { join } from 'node:path'
import { readFile } from './file.js'
import { parseProposalFrontmatter } from '../storage/frontmatter.js'

// Matches: NN-CC-  (chained — parent NN, child CC)
const CHAINED_RE = /^(\d{2})-(\d{2})-/

// Matches: NN-     (standalone)
const STANDALONE_RE = /^(\d{2})-/

export interface SolitaryNumbers {
  /** All top-level standalone sequence numbers found on disk */
  topLevel: number[]
  /** Map of parent sequence number → array of child sequence numbers */
  chained: Map<number, number[]>
}

/**
 * Scan the solitary proposals directory and parse all sequence numbers from
 * existing filenames.  Unknown or malformed filenames are silently skipped.
 */
export function parseSolitaryNumbers(dir: string): SolitaryNumbers {
  let files: string[]
  try {
    files = readdirSync(dir)
  } catch {
    files = []
  }

  const topLevel: number[] = []
  const chained = new Map<number, number[]>()

  for (const file of files) {
    if (!file.endsWith('.md')) continue

    // Try chained pattern first (more specific)
    const chainedMatch = CHAINED_RE.exec(file)
    if (chainedMatch) {
      const parent = parseInt(chainedMatch[1] ?? '0', 10)
      const child = parseInt(chainedMatch[2] ?? '0', 10)
      const children = chained.get(parent) ?? []
      children.push(child)
      chained.set(parent, children)
      continue
    }

    // Fall back to standalone pattern
    const standaloneMatch = STANDALONE_RE.exec(file)
    if (standaloneMatch) {
      topLevel.push(parseInt(standaloneMatch[1] ?? '0', 10))
    }
  }

  return { topLevel, chained }
}

/**
 * Return the next available global sequence number for a standalone solitary
 * proposal.  Counts both standalone and parent (chained) numbers.
 */
export function nextSolitaryNumber(solitaryDir: string): number {
  const { topLevel, chained } = parseSolitaryNumbers(solitaryDir)
  const allTopLevel = new Set([...topLevel, ...chained.keys()])
  const max = allTopLevel.size > 0 ? Math.max(...allTopLevel) : 0
  return max + 1
}

/**
 * Return the next available child sequence number for a given parent proposal
 * number.
 */
export function nextChainedNumber(solitaryDir: string, parentNumber: number): number {
  const { chained } = parseSolitaryNumbers(solitaryDir)
  const children = chained.get(parentNumber) ?? []
  const max = children.length > 0 ? Math.max(...children) : 0
  return max + 1
}

/**
 * Locate the top-level sequence number of the solitary proposal identified by
 * the given hash.  Reads frontmatter from matching `.md` files.
 *
 * Returns `null` when no matching file is found.
 */
export async function findSolitaryNumberForHash(
  solitaryDir: string,
  hash: string,
): Promise<number | null> {
  let files: string[]
  try {
    files = readdirSync(solitaryDir)
  } catch {
    return null
  }

  for (const file of files) {
    if (!file.endsWith('.md')) continue

    // Only look at files that could be the parent (standalone files have a top-level number)
    const standaloneMatch = STANDALONE_RE.exec(file)
    if (!standaloneMatch) continue

    try {
      const filePath = join(solitaryDir, file)
      const content = await readFile(filePath, 'utf-8')
      const fm = parseProposalFrontmatter(content)
      if (!fm?.hash) continue

      // Support partial hash matching (first N chars of the 16-char full hash)
      const storedHash = fm.hash
      if (
        storedHash === hash ||
        storedHash.startsWith(hash) ||
        hash.startsWith(storedHash)
      ) {
        return parseInt(standaloneMatch[1] ?? '0', 10)
      }
    } catch {
      // Skip unreadable files
    }
  }

  return null
}

/**
 * Zero-pad a sequence number to 2 digits (e.g. 1 → "01", 12 → "12").
 */
export function padSeq(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * After a solitary proposal is archived, renumber the remaining proposals so
 * there are no gaps in the sequence.
 *
 * Rules:
 *  - Standalone files (NN-slug.md) with NN > removedNumber → renamed to (NN-1)-slug.md
 *  - Chained files (NN-CC-slug.md) with NN > removedNumber → renamed to (NN-1)-CC-slug.md
 *  - Files with NN == removedNumber (orphaned children of the archived parent) are skipped.
 *
 * @returns Flat list of all affected absolute paths (old paths + new paths) for git staging.
 */
export async function reorderSolitaryProposals(
  solitaryDir: string,
  removedNumber: number,
): Promise<string[]> {
  let files: string[]
  try {
    files = readdirSync(solitaryDir)
  } catch {
    return []
  }

  const stagedPaths: string[] = []

  for (const file of files) {
    if (!file.endsWith('.md')) continue

    // Try chained pattern first (more specific)
    const chainedMatch = CHAINED_RE.exec(file)
    if (chainedMatch) {
      const parent = parseInt(chainedMatch[1] ?? '0', 10)
      if (parent > removedNumber) {
        const childNum = parseInt(chainedMatch[2] ?? '0', 10)
        const rest = file.slice(chainedMatch[0].length)
        const newFileName = `${padSeq(parent - 1)}-${padSeq(childNum)}-${rest}`
        const oldPath = join(solitaryDir, file)
        const newPath = join(solitaryDir, newFileName)
        await rename(oldPath, newPath)
        stagedPaths.push(oldPath, newPath)
      }
      continue
    }

    // Standalone pattern
    const standaloneMatch = STANDALONE_RE.exec(file)
    if (standaloneMatch) {
      const num = parseInt(standaloneMatch[1] ?? '0', 10)
      if (num > removedNumber) {
        const rest = file.slice(standaloneMatch[0].length)
        const newFileName = `${padSeq(num - 1)}-${rest}`
        const oldPath = join(solitaryDir, file)
        const newPath = join(solitaryDir, newFileName)
        await rename(oldPath, newPath)
        stagedPaths.push(oldPath, newPath)
      }
    }
  }

  return stagedPaths
}
