import { promises as fs } from 'fs'
import * as path from 'path'

export interface Gate {
  id: string
  sequence: number
  name: string
  description?: string
  status?: 'pending' | 'validated' | 'in_progress' | 'completed' | 'rejected'
}

export async function discoverGates(projectRoot: string): Promise<Gate[]> {
  const gatesDir = path.join(projectRoot, 'zeno', 'gates')
  let entries: string[] = []
  try {
    entries = await fs.readdir(gatesDir)
  } catch {
    return []
  }

  const gates: Gate[] = []

  for (const name of entries) {
    if (!name.endsWith('.md')) continue
    if (name.toLowerCase().startsWith('archive')) continue
    const m = /^gate-(\d{2})-(.*)\.md$/i.exec(name)
    const full = path.join(gatesDir, name)
    try {
      const content = await fs.readFile(full, 'utf-8')
      const firstHeading = content.split(/\r?\n/).find((l) => /^#\s+/.test(l))
      const desc = content.split(/\r?\n\r?\n/)[1]
      if (m) {
        const [, seqStr = '', titlePart = ''] = m
        const seq = parseInt(seqStr, 10)
        const id = `gate-${seqStr}`
        gates.push({
          id,
          sequence: seq,
          name: firstHeading
            ? firstHeading.replace(/^#\s+/, '').trim()
            : titlePart.replace(/-/g, ' '),
          description: desc ? desc.trim().split('\n')[0] : undefined,
          status: 'pending',
        })
      }
    } catch {
      // ignore
    }
  }

  return gates.sort((a, b) => a.sequence - b.sequence)
}
