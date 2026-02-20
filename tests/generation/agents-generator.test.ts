import { describe, it, expect } from 'vitest'
import { generateAgentsMD } from '../../src/generation/agents-generator.js'
import type { ZenoConfig } from '../../src/utils/config.js'
import type { Requirement } from '../../src/generation/types.js'

// Helper to create minimal config
function createTestConfig(overrides: Partial<ZenoConfig> = {}): ZenoConfig {
  return {
    projectName: 'Test Project',
    version: '1.0.0',
    hashAlgorithm: 'sha256',
    hashLength: 16,
    versioning: {
      enabled: true,
      proposalBump: 'patch',
      gateBump: 'minor',
      lifecycleBump: 'major',
    },
    workflowMode: 'solo',
    qualityThresholds: {
      codeCoverage: 90,
      securityVulnerabilities: 0,
      lintingErrorRate: 0.01,
      typeCheckingErrors: 0,
    },
    ...overrides,
  } as ZenoConfig
}

describe('Agents Generator - Branch Coverage', () => {
  describe('generateAgentsMD - edge cases', () => {
    it('should handle empty gates array', () => {
      const projectConfig = createTestConfig({
        projectName: 'Empty Project',
      })

      const gates: any[] = []
      const requirements: any[] = []

      const result = generateAgentsMD(projectConfig, gates, requirements)

      expect(result).toContain('# Empty Project: AI Agent Instructions')
      expect(result).toContain('Empty Project')
      expect(result).toContain('## Gate Roadmap')
      expect(result).not.toContain('gate-01')
    })

    it('should handle empty requirements array', () => {
      const projectConfig = createTestConfig({
        projectName: 'Test Project',
        version: '2.0.0',
        qualityThresholds: {
          codeCoverage: 85,
          securityVulnerabilities: 1,
          lintingErrorRate: 0.02,
          typeCheckingErrors: 5,
        },
      })

      const gates = [
        {
          id: 'gate-01',
          name: 'Setup',
          description: 'Initial setup',
          objectives: [],
          dependencies: [],
          estimatedComplexity: 5,
          confidence: 80,
          type: 'feature' as const,
          status: 'pending' as const,
          hash: 'gatefhash1',
          createdAt: new Date(),
          completedAt: null,
          proposal_hashes: null,
          depends_on: null,
        },
      ]
      const requirements: any[] = []

      const result = generateAgentsMD(projectConfig, gates, requirements)

      expect(result).toContain('Setup')
      expect(result).toContain('## Requirements')
      // Empty requirements should produce sections but with no listed items
      expect(result).toContain('### Project-Level Requirements')
      expect(result).toContain('### Gate-Specific Requirements')
    })

    it('should handle mixed project and gate-level requirements', () => {
      const projectConfig = createTestConfig({
        projectName: 'Full Project',
      })

      const gates = [
        {
          id: 'gate-01',
          name: 'Foundation',
          description: 'Foundation gate',
          objectives: [],
          dependencies: [],
          estimatedComplexity: 10,
          confidence: 85,
          type: 'feature' as const,
          status: 'pending' as const,
          hash: 'gatehash1',
          createdAt: new Date(),
          completedAt: null,
          proposal_hashes: null,
          depends_on: null,
        },
        {
          id: 'gate-02',
          name: 'Build',
          description: 'Build implementation',
          objectives: [],
          dependencies: [],
          estimatedComplexity: 15,
          confidence: 80,
          type: 'feature' as const,
          status: 'pending' as const,
          hash: 'gatehash2',
          createdAt: new Date(),
          completedAt: null,
          proposal_hashes: null,
          depends_on: null,
        },
      ]

      const requirements: Requirement[] = [
        {
          id: 'req1',
          projectId: 'default',
          gateId: null,
          parentId: null,
          type: 'functional',
          priority: 'must',
          description: 'System must be secure',
          acceptanceCriteria: '',
          hash: 'projreqhash1',
          createdAt: new Date(),
        },
        {
          id: 'req2',
          projectId: 'default',
          gateId: 'gate-01',
          parentId: null,
          type: 'functional',
          priority: 'must',
          description: 'Setup authentication',
          acceptanceCriteria: '',
          hash: 'gatereqhash1',
          createdAt: new Date(),
        },
        {
          id: 'req3',
          projectId: 'default',
          gateId: 'gate-02',
          parentId: null,
          type: 'functional',
          priority: 'should',
          description: 'Implement caching',
          acceptanceCriteria: '',
          hash: 'gatereqhash2',
          createdAt: new Date(),
        },
      ]

      const result = generateAgentsMD(projectConfig, gates, requirements)

      expect(result).toContain('# Full Project: AI Agent Instructions')
      expect(result).toContain('### Project-Level Requirements')
      expect(result).toContain('### Gate-Specific Requirements')
      expect(result).toContain('System must be secure')
      expect(result).toContain('Setup authentication')
      expect(result).toContain('Implement caching')
      expect(result).toContain('gate-01')
      expect(result).toContain('gate-02')
      expect(result).toContain('Foundation')
      expect(result).toContain('Build implementation')
    })

    it('should format quality thresholds correctly', () => {
      const projectConfig = createTestConfig({
        projectName: 'QA Project',
        qualityThresholds: {
          codeCoverage: 95,
          securityVulnerabilities: 0,
          lintingErrorRate: 0.005,
          typeCheckingErrors: 2,
        },
      })

      const gates: any[] = []
      const requirements: any[] = []

      const result = generateAgentsMD(projectConfig, gates, requirements)

      expect(result).toContain('Code Coverage: 95% minimum')
      expect(result).toContain('Security Vulnerabilities: 0 allowed')
      expect(result).toContain('Linting Error Rate: <0.005%')
      expect(result).toContain('Type Checking: 2 TypeScript errors')
    })

    it('should include version and timestamp', () => {
      const projectConfig = createTestConfig({
        projectName: 'Versioned Project',
        version: '2.5.1',
      })

      const gates: any[] = []
      const requirements: any[] = []

      const result = generateAgentsMD(projectConfig, gates, requirements)

      expect(result).toContain('2.5.1')
      expect(result).toContain('Versioned Project')
      expect(result).toMatch(/Last Updated.*\d{4}-\d{2}-\d{2}/)
    })
  })
})
