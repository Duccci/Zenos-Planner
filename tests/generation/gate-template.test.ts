import { describe, it, expect, vi } from 'vitest';
import { renderGateTemplate, loadTemplate } from '../../src/generation/gate-template.js';
import { readFileSync } from 'fs';

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

describe('Gate Template', () => {
  it('renders template with gate data', () => {
    const template = '# Gate [XX]: [Gate Name]\n\n**Status**: pending\n**Type**: [feature | quality | rescope]\n\n## Overview\n\n[2-3 sentences describing what this gate accomplishes and how it moves the project closer to the end state. Focus on concrete deliverables.]';
    const data = {
      gateNumber: 1,
      gateName: 'Test Gate',
      status: 'pending',
      type: 'feature',
      created: '2023-01-01',
      sequence: '1 of 5',
      hash: 'abc123',
      overview: 'This is a test gate.',
      objectives: ['Objective 1', 'Objective 2'],
      context: {
        completedBefore: ['Previous work'],
        enables: ['Future work'],
        inScope: ['Feature A'],
        outOfScope: ['Feature B'],
      },
      projectRequirements: [{
        hash: 'req1',
        name: 'Requirement 1',
        type: 'functional',
        priority: 'must',
        howAddressed: 'Implemented here',
      }],
    };

    const result = renderGateTemplate(template, data);

    expect(result).toContain('Gate 1: Test Gate');
    expect(result).toContain('**Type**: feature');
    expect(result).toContain('This is a test gate.');
  });

  it('loads template from file', () => {
    const mockContent = 'Template content';
    (readFileSync as any).mockReturnValue(mockContent);

    const result = loadTemplate('gate-prd-template');

    expect(readFileSync).toHaveBeenCalled();
    expect(result).toBe(mockContent);
  });
});