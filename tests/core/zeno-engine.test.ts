import { describe, it, expect } from 'vitest';
import { decomposeWork } from '../../src/core/zeno-engine.ts';
import { WorkDescription, DecompositionContext } from '../../src/core/types.ts';

describe('decomposeWork', () => {
  it('should return a single gate for simple work', () => {
    const work: WorkDescription = {
      description: 'Simple task',
      complexity: 20,
      requirements: ['req1']
    };

    const context: DecompositionContext = {
      maxGateComplexity: 30,
      projectRequirements: ['req1']
    };

    const gates = decomposeWork(work, context);

    expect(gates).toHaveLength(1);
    expect(gates[0].id).toBe('gate-01');
    expect(gates[0].description).toBe('Simple task');
  });

  it('should decompose complex work into multiple gates', () => {
    const work: WorkDescription = {
      description: 'Complex project',
      complexity: 80,
      requirements: ['req1', 'req2', 'req3', 'req4']
    };

    const context: DecompositionContext = {
      maxGateComplexity: 30,
      projectRequirements: work.requirements
    };

    const gates = decomposeWork(work, context);

    expect(gates.length).toBeGreaterThan(1);
    expect(gates.every(g => g.estimatedComplexity <= 30)).toBe(true);
  });

  it('should handle work with no requirements', () => {
    const work: WorkDescription = {
      description: 'No reqs task',
      complexity: 50,
      requirements: []
    };

    const context: DecompositionContext = {
      maxGateComplexity: 30,
      projectRequirements: []
    };

    const gates = decomposeWork(work, context);

    expect(gates.length).toBeGreaterThan(1);
  });
});