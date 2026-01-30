import { describe, it, expect, vi } from 'vitest';
import { renderProposalTemplate, loadProposalTemplate } from '../../src/generation/proposal-template.js';
import { readFileSync } from 'fs';

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

describe('Proposal Template', () => {
  it('renders template with proposal data', () => {
    const template = '# Proposal: [Proposal Title]\n\n**Hash**: #[Generated SHA-256 first 16 chars]\n\n**Gate**: [Gate ID] - [Gate Name]';
    const data = {
      title: 'Test Proposal',
      hash: 'hash123',
      gateId: 'gate-01',
      gateName: 'Gate 1',
      requirement: 'req1',
      status: 'pending',
      created: '2023-01-01',
      summary: 'Test summary',
      context: {
        requirementsContext: 'Context',
        whyChange: 'Why',
        dependencies: [{
          hash: 'dep1',
          type: 'requires',
          description: 'Dependency',
        }],
      },
      tasks: [{
        title: 'Task 1',
        files: 'file.ts',
        action: 'create',
        description: 'Description',
        acceptance: ['Condition 1'],
      }],
      filesAffected: [{
        file: 'src/file.ts',
        action: 'create',
        description: 'New file',
      }],
      implementationNotes: 'Notes',
      rollback: 'Rollback',
    };

    const result = renderProposalTemplate(template, data);

    expect(result).toContain('Proposal: Test Proposal');
    expect(result).toContain('#hash123');
    expect(result).toContain('gate-01 - Gate 1');
  });

  it('loads proposal template', () => {
    const mockContent = 'Template';
    (readFileSync as any).mockReturnValue(mockContent);

    const result = loadProposalTemplate();

    expect(readFileSync).toHaveBeenCalled();
    expect(result).toBe(mockContent);
  });
});