import { describe, it, expect } from 'vitest';
import { sequenceGates } from '../../src/core/gate-sequencer.ts';
import { Gate } from '../../src/core/types.ts';

describe('sequenceGates', () => {
  it('should sequence gates with no dependencies', () => {
    const gates: Gate[] = [
      {
        id: 'gate-01',
        name: 'Gate 1',
        description: 'First gate',
        objectives: [],
        dependencies: [],
        estimatedComplexity: 20,
        confidence: 80
      },
      {
        id: 'gate-02',
        name: 'Gate 2',
        description: 'Second gate',
        objectives: [],
        dependencies: [],
        estimatedComplexity: 20,
        confidence: 80
      }
    ];

    const result = sequenceGates(gates);

    expect(result.gates).toHaveLength(2);
    expect(result.parallelGroups).toHaveLength(1); // all parallel
  });

  it('should sequence gates with dependencies', () => {
    const gates: Gate[] = [
      {
        id: 'gate-01',
        name: 'Gate 1',
        description: 'First gate',
        objectives: [],
        dependencies: [],
        estimatedComplexity: 20,
        confidence: 80
      },
      {
        id: 'gate-02',
        name: 'Gate 2',
        description: 'Second gate',
        objectives: [],
        dependencies: ['gate-01'],
        estimatedComplexity: 20,
        confidence: 80
      }
    ];

    const result = sequenceGates(gates);

    expect(result.gates[0].id).toBe('gate-01');
    expect(result.gates[1].id).toBe('gate-02');
  });

  it('should detect circular dependencies', () => {
    const gates: Gate[] = [
      {
        id: 'gate-01',
        name: 'Gate 1',
        description: 'First gate',
        objectives: [],
        dependencies: ['gate-02'],
        estimatedComplexity: 20,
        confidence: 80
      },
      {
        id: 'gate-02',
        name: 'Gate 2',
        description: 'Second gate',
        objectives: [],
        dependencies: ['gate-01'],
        estimatedComplexity: 20,
        confidence: 80
      }
    ];

    expect(() => sequenceGates(gates)).toThrow('Circular dependency detected');
  });
});