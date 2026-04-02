import { describe, it, expect } from 'vitest'
import { createDiscoveryService } from '../../src/generation/artifact-discovery-service.js'
import * as path from 'path'

const projectRoot = process.cwd()

describe('Artifact Discovery Service', () => {
  const service = createDiscoveryService(projectRoot)
  const missingService = createDiscoveryService('/nonexistent/path')

  describe('getTemplates', () => {
    it('should return templates array with required fields', async () => {
      const templates = await service.getTemplates()
      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBeGreaterThan(0)
      for (const t of templates) {
        expect(t).toHaveProperty('name')
        expect(t).toHaveProperty('shortName')
        expect(t).toHaveProperty('path')
        expect(t).toHaveProperty('description')
        expect(t).toHaveProperty('category')
        expect(['markdown', 'architecture', 'misc']).toContain(t.category)
      }
    })

    it('should return templates even when project path is missing (templates ship with package)', async () => {
      const templates = await missingService.getTemplates()
      expect(Array.isArray(templates)).toBe(true)
      // Templates are resolved from the package install dir, not the project root
      expect(templates.length).toBeGreaterThan(0)
    })
  })

  describe('getAgents', () => {
    it('should return agents array', async () => {
      const agents = await service.getAgents()
      expect(Array.isArray(agents)).toBe(true)
    })

    it('should return empty array for missing agents manifest', async () => {
      const agents = await missingService.getAgents()
      expect(Array.isArray(agents)).toBe(true)
      expect(agents.length).toBe(0)
    })
  })

  describe('getGates', () => {
    it('should return gates array sorted by sequence', async () => {
      const gates = await service.getGates()
      expect(Array.isArray(gates)).toBe(true)
      for (let i = 1; i < gates.length; i++) {
        expect(gates[i].sequence).toBeGreaterThan(gates[i - 1].sequence)
      }
    })

    it('should return empty array for missing gates directory', async () => {
      const gates = await missingService.getGates()
      expect(Array.isArray(gates)).toBe(true)
      expect(gates.length).toBe(0)
    })
  })

  describe('getProposals', () => {
    it('should return proposals array with valid types and statuses', async () => {
      const proposals = await service.getProposals()
      expect(Array.isArray(proposals)).toBe(true)
      for (const p of proposals) {
        expect(p).toHaveProperty('hash')
        expect(p).toHaveProperty('title')
        expect(['gate-specific', 'solitary']).toContain(p.type)
        expect(['pending', 'validated', 'in_progress', 'completed', 'rejected']).toContain(p.status)
      }
    })

    it('should return empty array for missing proposals directory', async () => {
      const proposals = await missingService.getProposals()
      expect(Array.isArray(proposals)).toBe(true)
      expect(proposals.length).toBe(0)
    })
  })

  describe('getArtifact', () => {
    it('should return template by name', async () => {
      const templates = await service.getTemplates()
      if (templates.length > 0) {
        const first = templates[0]
        const artifact = await service.getArtifact('template', first.name)
        expect(artifact).toBeTruthy()
        expect(artifact).toHaveProperty('name', first.name)
      }
    })

    it('should return template by shortName', async () => {
      const templates = await service.getTemplates()
      if (templates.length > 0) {
        const first = templates[0]
        const artifact = await service.getArtifact('template', first.shortName)
        expect(artifact).toBeTruthy()
        expect(artifact).toHaveProperty('shortName', first.shortName)
      }
    })

    it('should return null for non-existent template', async () => {
      const artifact = await service.getArtifact('template', 'nonexistent-template')
      expect(artifact).toBeNull()
    })

    it('should return agent by id', async () => {
      const agents = await service.getAgents()
      if (agents.length > 0) {
        const first = agents[0]
        const artifact = await service.getArtifact('agent', first.id)
        expect(artifact).toBeTruthy()
        expect(artifact).toHaveProperty('id', first.id)
      }
    })

    it('should return null for non-existent agent', async () => {
      const artifact = await service.getArtifact('agent', 'nonexistent-agent')
      expect(artifact).toBeNull()
    })

    it('should return gate by id', async () => {
      const gates = await service.getGates()
      if (gates.length > 0) {
        const first = gates[0]
        const artifact = await service.getArtifact('gate', first.id)
        expect(artifact).toBeTruthy()
        expect(artifact).toHaveProperty('id', first.id)
      }
    })

    it('should return null for non-existent gate', async () => {
      const artifact = await service.getArtifact('gate', 'nonexistent-gate')
      expect(artifact).toBeNull()
    })

    it('should return proposal by hash', async () => {
      const proposals = await service.getProposals()
      if (proposals.length > 0) {
        const first = proposals[0]
        const artifact = await service.getArtifact('proposal', first.hash)
        expect(artifact).toBeTruthy()
        expect(artifact).toHaveProperty('hash', first.hash)
      }
    })

    it('should return null for non-existent proposal', async () => {
      const artifact = await service.getArtifact('proposal', 'nonexistent-hash')
      expect(artifact).toBeNull()
    })
  })
})
