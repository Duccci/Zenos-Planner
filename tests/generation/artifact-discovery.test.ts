import { describe, it, expect } from 'vitest'
import { discoverTemplates } from '../../src/generation/template-discovery.js'
import { discoverAgents } from '../../src/generation/agent-discovery.js'
import { discoverGates } from '../../src/generation/gates-discovery.js'
import { discoverProposals } from '../../src/generation/proposals-discovery.js'
import * as path from 'path'

const projectRoot = process.cwd()

describe('Artifact Discovery', () => {
  describe('discoverTemplates', () => {
    it('should discover templates from filesystem', async () => {
      const templates = await discoverTemplates(projectRoot)
      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBeGreaterThan(0)

      for (const template of templates) {
        expect(template).toHaveProperty('name')
        expect(template).toHaveProperty('shortName')
        expect(template).toHaveProperty('path')
        expect(template).toHaveProperty('description')
        expect(template).toHaveProperty('category')
        expect(['markdown', 'architecture']).toContain(template.category)
      }
    })

    it('should handle missing templates directory gracefully', async () => {
      const templates = await discoverTemplates('/nonexistent/path')
      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBe(0)
    })
  })

  describe('discoverAgents', () => {
    it('should discover agents from manifest', async () => {
      const agents = await discoverAgents(projectRoot)
      expect(Array.isArray(agents)).toBe(true)

      if (agents.length > 0) {
        for (const agent of agents) {
          expect(agent).toHaveProperty('id')
          expect(agent).toHaveProperty('tier')
          expect(agent).toHaveProperty('category')
          expect(agent).toHaveProperty('name')
          expect(['focused', 'expert', 'phd']).toContain(agent.tier)
        }
      }
    })

    it('should handle missing manifest gracefully', async () => {
      const agents = await discoverAgents('/nonexistent/path')
      expect(Array.isArray(agents)).toBe(true)
      expect(agents.length).toBe(0)
    })
  })

  describe('discoverGates', () => {
    it('should discover gates from filesystem', async () => {
      const gates = await discoverGates(projectRoot)
      expect(Array.isArray(gates)).toBe(true)

      for (const gate of gates) {
        expect(gate).toHaveProperty('id')
        expect(gate).toHaveProperty('sequence')
        expect(gate).toHaveProperty('name')
        expect(gate).toHaveProperty('status')
        expect(['pending', 'in_progress', 'completed', 'rejected']).toContain(gate.status)
        expect(typeof gate.sequence).toBe('number')
      }

      // Should be sorted by sequence
      for (let i = 1; i < gates.length; i++) {
        expect(gates[i].sequence).toBeGreaterThan(gates[i - 1].sequence)
      }
    })

    it('should handle missing gates directory gracefully', async () => {
      const gates = await discoverGates('/nonexistent/path')
      expect(Array.isArray(gates)).toBe(true)
      expect(gates.length).toBe(0)
    })
  })

  describe('discoverProposals', () => {
    it('should discover proposals from filesystem', async () => {
      const proposals = await discoverProposals(projectRoot)
      expect(Array.isArray(proposals)).toBe(true)

      for (const proposal of proposals) {
        expect(proposal).toHaveProperty('hash')
        expect(proposal).toHaveProperty('title')
        expect(proposal).toHaveProperty('type')
        expect(proposal).toHaveProperty('status')
        expect(['gate-specific', 'solitary']).toContain(proposal.type)
        expect(['pending', 'in_progress', 'completed', 'rejected']).toContain(proposal.status)
      }
    })

    it('should handle missing proposals directory gracefully', async () => {
      const proposals = await discoverProposals('/nonexistent/path')
      expect(Array.isArray(proposals)).toBe(true)
      expect(proposals.length).toBe(0)
    })
  })
})