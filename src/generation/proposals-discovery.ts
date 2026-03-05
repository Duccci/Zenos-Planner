import { promises as fs } from 'fs'
import * as path from 'path'
import { walkDir, walkDirSync } from '../utils/file.js'
import { parseProposalMetadata } from '../core/proposal-parser.js'

export interface Proposal {
  hash: string
  title: string
  type: 'gate-specific' | 'solitary'
  status?: 'pending' | 'validated' | 'in_progress' | 'completed' | 'rejected'
  gateId?: string
  createdAt?: string
}

export async function discoverProposals(projectRoot: string): Promise<Proposal[]> {
  const proposalsDir = path.join(projectRoot, 'zeno', 'proposals')
  const files = await walkDir(proposalsDir)
  const proposals: Proposal[] = []

  for (const full of files) {
    try {
      const rel = path.relative(projectRoot, full)
      const parts = rel.split(path.sep)
      const type = parts.includes('solitary') ? 'solitary' : 'gate-specific'
      const content = await fs.readFile(full, 'utf-8')

      // Extract metadata from proposal frontmatter
      const metadata = parseProposalMetadata(content)

      // Get title from metadata or file
      const title = metadata.title ?? path.basename(full, '.md')

      const gateId = parts.find((p) => /^gate-\d{2}/.test(p))
      const statusValue = metadata.status
      const status = statusValue && ['pending', 'validated', 'in_progress', 'completed', 'rejected'].includes(statusValue)
        ? (statusValue as 'pending' | 'validated' | 'in_progress' | 'completed' | 'rejected')
        : 'pending'
      proposals.push({
        hash: metadata.hash ?? path.basename(full, '.md'),
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
  const files = await walkDir(proposalsDir)
  const matches = new Set<string>()

  for (const full of files) {
    try {
      const content = await fs.readFile(full, 'utf-8')
      if (content.includes(requirementHash) || new RegExp(`#${requirementHash}\b`).test(content)) {
        const metadata = parseProposalMetadata(content)
        if (metadata.hash) matches.add(metadata.hash)
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
import { readFileSync } from 'fs'
export function findProposalsReferencingRequirementSync(
  projectRoot: string,
  requirementHash: string
): string[] {
  const proposalsDir = path.join(projectRoot, 'zeno', 'proposals')
  const proposalFiles = walkDirSync(proposalsDir)
  const matches = new Set<string>()

  for (const full of proposalFiles) {
    try {
      const content = readFileSync(full, 'utf-8')
      if (
        content.includes(requirementHash) ||
        new RegExp(`#${requirementHash}\b`).test(content)
      ) {
        const hashMatch = /\*\*Hash\*\*\s*:\s*#?([a-z0-9-]+)/i.exec(content)
        if (hashMatch?.[1]) matches.add(hashMatch[1])
      }
    } catch {
      // ignore file read errors
    }
  }
  return Array.from(matches)
}
