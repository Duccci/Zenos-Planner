import { promises as fs } from 'fs'
import * as path from 'path'

export interface Proposal {
  hash: string
  title: string
  type: 'gate-specific' | 'solitary'
  status?: 'pending' | 'in_progress' | 'completed' | 'rejected'
  gateId?: string
  createdAt?: string
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  let entries: string[] = []
  try {
    entries = await fs.readdir(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e)
    const stat = await fs.stat(full)
    if (stat.isDirectory()) {
      out.push(...(await walk(full)))
    } else if (e.endsWith('.md')) {
      out.push(full)
    }
  }
  return out
}

export async function discoverProposals(projectRoot: string): Promise<Proposal[]> {
  const proposalsDir = path.join(projectRoot, 'zeno', 'proposals')
  const files = await walk(proposalsDir)
  const proposals: Proposal[] = []

  for (const full of files) {
    try {
      const rel = path.relative(projectRoot, full)
      const parts = rel.split(path.sep)
      const type = parts.includes('solitary') ? 'solitary' : 'gate-specific'
      const content = await fs.readFile(full, 'utf-8')
      const titleLine = content.split(/\r?\n/).find((l) => /^#\s+/.test(l)) ?? ''
      const titleCandidate = titleLine.replace(/^#\s+/, '').trim()
      const title = titleCandidate.length > 0 ? titleCandidate : path.basename(full, '.md')

      // Try to extract Hash and Status from content lines like "**Hash**: #abcd1234"
      const hashMatch = /\*\*Hash\*\*\s*:\s*#?([a-z0-9-]+)/i.exec(content)
      const statusMatch = /\*\*Status\*\*\s*:\s*([a-z_]+)/i.exec(content)
      const gateId = parts.find((p) => /^gate-\d{2}/.test(p))

      const statusValue = statusMatch?.[1]
      const status = statusValue && ['pending', 'in_progress', 'completed', 'rejected'].includes(statusValue)
        ? (statusValue as 'pending' | 'in_progress' | 'completed' | 'rejected')
        : 'pending'
      proposals.push({
        hash: hashMatch?.[1] ?? path.basename(full, '.md'),
        title,
        type,
        status,
        gateId,
      })
    } catch {
      // ignore
    }
  }

  return proposals
}

/**
 * Find proposal hashes that reference a given requirement hash (async).
 */
export async function findProposalsReferencingRequirement(
  projectRoot: string,
  requirementHash: string
): Promise<string[]> {
  const proposalsDir = path.join(projectRoot, 'zeno', 'proposals')
  const files = await walk(proposalsDir)
  const matches = new Set<string>()

  for (const full of files) {
    try {
      const content = await fs.readFile(full, 'utf-8')
      if (content.includes(requirementHash) || new RegExp(`#${requirementHash}\b`).test(content)) {
        const hashMatch = /\*\*Hash\*\*\s*:\s*#?([a-z0-9-]+)/i.exec(content)
        if (hashMatch?.[1]) matches.add(hashMatch[1])
      }
    } catch {
      // ignore individual file errors
    }
  }

  return Array.from(matches)
}

/**
 * Synchronous variant used by some non-async APIs.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
export function findProposalsReferencingRequirementSync(
  projectRoot: string,
  requirementHash: string
): string[] {
  const proposalsDir = path.join(projectRoot, 'zeno', 'proposals')
  const matches = new Set<string>()

  function walkSync(dir: string): void {
    let entries: string[] = []
    try {
      entries = readdirSync(dir)
    } catch (err) {
      // ignore directory traversal errors
      void err
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e)
      let stat
      try {
        stat = statSync(full)
      } catch (err) {
        // ignore file stat errors
        void err
        continue
      }
      if (stat.isDirectory()) {
        walkSync(full)
      } else if (e.endsWith('.md')) {
        try {
          const content = readFileSync(full, 'utf-8')
          if (
            content.includes(requirementHash) ||
            new RegExp(`#${requirementHash}\b`).test(content)
          ) {
            const hashMatch = /\*\*Hash\*\*\s*:\s*#?([a-z0-9-]+)/i.exec(content)
            if (hashMatch?.[1]) matches.add(hashMatch[1])
          }
        } catch (err) {
          // ignore file read errors
          void err
        }
      }
    }
  }

  walkSync(proposalsDir)
  return Array.from(matches)
}
