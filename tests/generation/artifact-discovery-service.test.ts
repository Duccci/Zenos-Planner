import { describe, it, expect } from 'vitest'
import { createDiscoveryService } from '../../src/generation/artifact-discovery-service.js'
import * as path from 'path'

const projectRoot = process.cwd()

describe('Artifact Discovery Service', () => {
  const service = createDiscoveryService(projectRoot)

  describe('getTemplates', () => {
    it('should return templates array', async () => {
      const templates = await service.getTemplates()
      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBeGreaterThan(0)
    })
  })

  describe('getAgents', () => {
    it('should return agents array', async () => {
      const agents = await service.getAgents()
      expect(Array.isArray(agents)).toBe(true)
    })
  })

  describe('getGates', () => {
    it('should return gates array', async () => {
      const gates = await service.getGates()
      expect(Array.isArray(gates)).toBe(true)
    })
  })

  describe('getProposals', () => {
    it('should return proposals array', async () => {
      const proposals = await service.getProposals()
      expect(Array.isArray(proposals)).toBe(true)
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