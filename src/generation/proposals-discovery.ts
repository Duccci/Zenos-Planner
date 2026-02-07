import { promises as fs } from 'fs'
import * as path from 'path'

export interface Proposal {
  hash: string
  title: string
  type: 'gate-specific' | 'solitary' | string
  status?: 'pending' | 'in_progress' | 'completed' | 'rejected' | string
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
      if (e.toLowerCase() === 'archive') continue
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
      const titleLine = content.split(/\r?\n/).find(l => /^#\s+/.test(l)) || ''
      const title = titleLine.replace(/^#\s+/, '').trim() || path.basename(full, '.md')

      // Try to extract Hash and Status from content lines like "**Hash**: #abcd1234"
      const hashMatch = /\*\*Hash\*\*\s*:\s*#?([a-z0-9]+)/i.exec(content)
      const statusMatch = /\*\*Status\*\*\s*:\s*([a-z_]+)/i.exec(content)
      const gateId = parts.find(p => /^gate-\d{2}/.test(p))

      proposals.push({
        hash: hashMatch ? hashMatch[1] : path.basename(full, '.md'),
        title,
        type,
        status: statusMatch ? statusMatch[1] : 'pending',
        gateId: gateId || undefined
      })
    } catch {
      // ignore
    }
  }

  return proposals
}
