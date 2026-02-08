import { promises as fs } from 'fs'
import * as path from 'path'

export interface Agent {
  id: string
  tier: 'focused' | 'expert' | 'phd'
  category: string
  name: string
  description?: string
  role?: string
  tags?: string[]
}

export async function discoverAgents(projectRoot: string): Promise<Agent[]> {
  const manifestPath = path.join(projectRoot, 'agents', 'agent-manifest.json')
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)

    function isRecord(x: unknown): x is Record<string, unknown> {
      return typeof x === 'object' && x !== null && !Array.isArray(x)
    }

    function normalizeAgent(obj: unknown): Agent | null {
      if (!isRecord(obj)) return null
      const name =
        typeof obj['name'] === 'string'
          ? obj['name']
          : typeof obj['id'] === 'string'
            ? obj['id']
            : undefined
      if (!name) return null
      let tier: 'focused' | 'expert' | 'phd' = 'focused'
      if (typeof obj['tier'] === 'string') {
        if (obj['tier'] === 'focused' || obj['tier'] === 'expert' || obj['tier'] === 'phd') {
          tier = obj['tier']
        }
      }
      return {
        id: typeof obj['id'] === 'string' ? obj['id'] : name,
        tier,
        category: typeof obj['category'] === 'string' ? obj['category'] : '',
        name,
        description: typeof obj['description'] === 'string' ? obj['description'] : undefined,
        role: typeof obj['role'] === 'string' ? obj['role'] : undefined,
        tags: Array.isArray(obj['tags'])
          ? obj['tags'].filter((t: unknown): t is string => typeof t === 'string')
          : undefined,
      }
    }

    const agentsOut: Agent[] = []

    if (Array.isArray(parsed)) {
      for (const p of parsed) {
        const a = normalizeAgent(p)
        if (a) agentsOut.push(a)
      }
    } else if (isRecord(parsed)) {
      if (Array.isArray(parsed['agents'])) {
        for (const p of parsed['agents']) {
          const a = normalizeAgent(p)
          if (a) agentsOut.push(a)
        }
      } else {
        for (const [k, v] of Object.entries(parsed)) {
          const a = normalizeAgent({ id: k, ...(isRecord(v) ? v : {}) })
          if (a) agentsOut.push(a)
        }
      }
    }

    return agentsOut
  } catch {
    return []
  }
}
