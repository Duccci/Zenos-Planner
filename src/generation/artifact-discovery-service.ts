import * as path from 'path'
import { discoverTemplates, Template, copyTemplateToLocal, loadTemplateContent } from './template-discovery.js'
import { discoverAgents, Agent } from './agent-discovery.js'
import { discoverGates, Gate } from './gates-discovery.js'
import { discoverProposals, Proposal } from './proposals-discovery.js'

export type Artifact = Template | Agent | Gate | Proposal

export interface DiscoveryService {
  getTemplates(): Promise<Template[]>
  getAgents(): Promise<Agent[]>
  getGates(): Promise<Gate[]>
  getProposals(): Promise<Proposal[]>
  getArtifact(
    type: 'template' | 'agent' | 'gate' | 'proposal',
    id: string
  ): Promise<Artifact | null>
}

export function createDiscoveryService(projectRoot: string): DiscoveryService {
  const root = path.resolve(projectRoot)

  return {
    async getTemplates() {
      return discoverTemplates(root)
    },

    async getAgents() {
      return discoverAgents(root)
    },

    async getGates() {
      return discoverGates(root)
    },

    async getProposals() {
      return discoverProposals(root)
    },

    async getArtifact(type, id) {
      switch (type) {
        case 'template': {
          const templates = await discoverTemplates(root)
          const found = templates.find((t) => t.name === id || t.shortName === id)
          if (!found) return null
          try {
            const content = await loadTemplateContent(undefined, found.path)
            const localPath = await copyTemplateToLocal(root, found.path).catch(() => undefined)
            return { ...found, content, ...(localPath !== undefined && { localPath }) }
          } catch {
            return found
          }
        }

        case 'agent': {
          const agents = await discoverAgents(root)
          return agents.find((a) => a.id === id || a.name === id) ?? null
        }

        case 'gate': {
          const gates = await discoverGates(root)
          return gates.find((g) => g.id === id || g.name === id) ?? null
        }

        case 'proposal': {
          const proposals = await discoverProposals(root)
          return proposals.find((p) => p.hash === id || p.title === id) ?? null
        }

        default:
          return null
      }
    },
  }
}
