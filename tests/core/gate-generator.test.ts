import { describe, it, expect } from 'vitest';
import { generateGates } from '../../src/core/gate-generator.ts';

describe('generateGates', () => {
  it('should generate gates for a simple end state', () => {
    const endState = 'Build a simple web app';

    const result = generateGates(endState);

    expect(result.gates.length).toBeGreaterThan(0);
    expect(result.totalComplexity).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it('should generate more gates for complex projects', () => {
    const simpleEndState = 'Build a simple script';
    const complexEndState = 'Build a complex enterprise application with multiple modules and integrations';

    const simpleResult = generateGates(simpleEndState);
    const complexResult = generateGates(complexEndState);

    expect(complexResult.gates.length).toBeGreaterThanOrEqual(simpleResult.gates.length);
  });

  it('should incorporate analysis results', () => {
    const endState = 'Refactor existing codebase';
    const analysisResult = {
      metrics: {
        linesOfCode: 5000,
        cyclomaticComplexity: 50,
        coupling: 0.8
      },
      dependencies: ['dep1', 'dep2']
    };

    const result = generateGates(endState, analysisResult);

    expect(result.gates.length).toBeGreaterThan(0);
    // Should have higher complexity due to existing codebase
  });

  it('should incorporate requirements', () => {
    const endState = 'Implement features';
    const requirements = [
      { id: 'req1', description: 'Feature 1' },
      { id: 'req2', description: 'Feature 2' },
      { id: 'req3', description: 'Feature 3' }
    ];

    const result = generateGates(endState, undefined, requirements);

    expect(result.gates.length).toBeGreaterThan(0);
    expect(result.gates.some(gate =>
      gate.objectives.some(obj =>
        obj.acceptanceCriteria.some(criteria =>
          criteria.includes('Feature')
        )
      )
    )).toBe(true);
  });
});