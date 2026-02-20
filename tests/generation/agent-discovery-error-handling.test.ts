import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { discoverAgents } from '../../src/generation/agent-discovery.js'
import { promises as fs } from 'fs'
import * as path from 'path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

vi.mock('fs')

describe('Agent Discovery - Error Handling', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `test-agents-${randomUUID()}`)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('discoverAgents - error handling', () => {
    it('should return empty array when manifest file not found', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('ENOENT: no such file'))

      const agents = await discoverAgents(tempDir)

      expect(agents).toEqual([])
    })

    it('should return empty array for invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce('{ invalid json' as any)

      const agents = await discoverAgents(tempDir)

      expect(agents).toEqual([])
    })

    it('should parse JSON array format', async () => {
      const manifest = JSON.stringify([
        {
          id: 'agent-1',
          tier: 'expert',
          category: 'api-design',
          name: 'API Expert',
          description: 'Expert in API design',
        },
        {
          id: 'agent-2',
          tier: 'focused',
          category: 'testing',
          name: 'Testing User',
        },
      ])

      vi.mocked(fs.readFile).mockResolvedValueOnce(manifest as any)

      const agents = await discoverAgents(tempDir)

      expect(agents).toHaveLength(2)
      expect(agents[0]).toMatchObject({
        id: 'agent-1',
        tier: 'expert',
        category: 'api-design',
        name: 'API Expert',
      })
    })

    it('should parse JSON object format with agents array', async () => {
      const manifest = JSON.stringify({
        agents: [
          {
            id: 'agent-1',
            tier: 'phd',
            category: 'security',
            name: 'Security PhD',
            role: 'reviewer',
          },
        ],
      })

      vi.mocked(fs.readFile).mockResolvedValueOnce(manifest as any)

      const agents = await discoverAgents(tempDir)

      expect(agents).toHaveLength(1)
      expect(agents[0].tier).toBe('phd')
      expect(agents[0].role).toBe('reviewer')
    })

    it('should parse JSON object format with inline agents', async () => {
      const manifest = JSON.stringify({
        'agent-1': {
          tier: 'expert',
          category: 'backend',
          name: 'Backend Expert',
        },
        'agent-2': {
          tier: 'focused',
          category: 'frontend',
          name: 'Frontend Focused',
          tags: ['react', 'typescript'],
        },
      })

      vi.mocked(fs.readFile).mockResolvedValueOnce(manifest as any)

      const agents = await discoverAgents(tempDir)

      expect(agents).toHaveLength(2)
      expect(agents.some((a) => a.id === 'agent-1')).toBe(true)
      expect(agents.some((a) => a.tags?.includes('react'))).toBe(true)
    })

    it('should handle null tier gracefully', async () => {
      const manifest = JSON.stringify([
        {
          id: 'agent-1',
          name: 'Generic Agent',
          // tier is missing, should default to 'focused'
        },
      ])

      vi.mocked(fs.readFile).mockResolvedValueOnce(manifest as any)

      const agents = await discoverAgents(tempDir)

      expect(agents).toHaveLength(1)
      expect(agents[0].tier).toBe('focused')
    })

    it('should filter out invalid agents', async () => {
      const manifest = JSON.stringify([
        {
          id: 'agent-1',
          tier: 'expert',
          category: 'api',
          name: 'Valid Agent',
        },
        {
          // Missing name and id, should be filtered
          tier: 'focused',
          category: 'testing',
        },
        {
          // Valid, uses id as name
          id: 'agent-3',
          tier: 'phd',
          category: 'security',
        },
      ])

      vi.mocked(fs.readFile).mockResolvedValueOnce(manifest as any)

      const agents = await discoverAgents(tempDir)

      // Should only include valid agents
      expect(agents.length).toBeGreaterThanOrEqual(1)
      expect(agents.every((a) => a.name && a.id)).toBe(true)
    })
  })
})
