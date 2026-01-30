import { describe, it, expect } from 'vitest';
import { generateAgentsMD } from '../../src/generation/agents-generator.js';

describe('Agents Generator', () => {
  it('generates AGENTS.md content', () => {
    const projectConfig = {
      projectName: 'Test Project',
      version: '1.0.0',
      qualityThresholds: {
        codeCoverage: 90,
        securityVulnerabilities: 0,
        lintingErrorRate: 0.01,
        typeCheckingErrors: 0,
      },
    };

    const gates = [
      {
        id: 'gate-01',
        name: 'Gate 1',
        description: 'First gate',
        objectives: [],
        dependencies: [],
        estimatedComplexity: 5,
        confidence: 80,
      },
    ];

    const requirements = [
      {
        id: 'req1',
        gateId: null,
        parentId: null,
        projectRequirementId: null,
        type: 'functional',
        priority: 'must',
        level: 'project',
        source: 'generated',
        description: 'Test requirement',
        acceptanceCriteria: '',
        hash: 'hash1',
        status: 'pending',
        sourceGateId: undefined,
        createdAt: new Date(),
      },
    ];

    const result = generateAgentsMD(projectConfig, gates, requirements);

    expect(result).toContain('# Test Project: AI Agent Instructions');
    expect(result).toContain('- **Version**: 1.0.0');
    expect(result).toContain('Code Coverage: 90%');
    expect(result).toContain('Gate 1');
    expect(result).toContain('#hash1');
  });
});