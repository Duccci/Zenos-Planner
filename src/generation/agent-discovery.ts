import { promises as fs } from 'fs'
import * as path from 'path'

export interface Agent {
  id: string
  tier: 'focused' | 'expert' | 'phd' | string
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
    const parsed = JSON.parse(raw)
    let agents: any[] = []
    if (Array.isArray(parsed)) agents = parsed
    else if (parsed && Array.isArray(parsed.agents)) agents = parsed.agents
    else if (parsed && typeof parsed === 'object') {
      agents = Object.keys(parsed).map(k => ({ id: k, ...(parsed[k] as any) }))
    }
    // Ensure each agent has id, defaulting to name
    return agents.map(a => ({ id: a.id || a.name, ...a })) as Agent[]
  } catch {
    return []
  }
}
