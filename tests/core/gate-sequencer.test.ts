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

  it('should group independent gates into a parallel group when they share a common dependent', () => {
    const gates: Gate[] = [
      {
        id: 'gate-01',
        name: 'Gate 1',
        description: 'Independent A',
        objectives: [],
        dependencies: [],
        estimatedComplexity: 20,
        confidence: 80
      },
      {
        id: 'gate-02',
        name: 'Gate 2',
        description: 'Independent B',
        objectives: [],
        dependencies: [],
        estimatedComplexity: 20,
        confidence: 80
      },
      {
        id: 'gate-03',
        name: 'Gate 3',
        description: 'Depends on both',
        objectives: [],
        dependencies: ['gate-01', 'gate-02'],
        estimatedComplexity: 20,
        confidence: 80
      }
    ];

    const result = sequenceGates(gates);

    // gate-01 and gate-02 have no deps between them → merged into one parallel group
    expect(result.parallelGroups).toHaveLength(2);
    const firstGroup = result.parallelGroups[0];
    expect(firstGroup?.map(g => g.id)).toEqual(expect.arrayContaining(['gate-01', 'gate-02']));
    expect(result.parallelGroups[1]?.[0]?.id).toBe('gate-03');
  });

  it('keeps sequential gate ordering via topological sort in fully-chained scenario', () => {
    const gates: Gate[] = [
      {
        id: 'gate-01',
        name: 'Gate 1',
        description: 'First',
        objectives: [],
        dependencies: [],
        estimatedComplexity: 20,
        confidence: 80
      },
      {
        id: 'gate-02',
        name: 'Gate 2',
        description: 'Depends on gate-01',
        objectives: [],
        dependencies: ['gate-01'],
        estimatedComplexity: 20,
        confidence: 80
      },
      {
        id: 'gate-03',
        name: 'Gate 3',
        description: 'Depends on gate-02',
        objectives: [],
        dependencies: ['gate-02'],
        estimatedComplexity: 20,
        confidence: 80
      }
    ];

    const result = sequenceGates(gates);

    // Topological order must place gate-01 before gate-02 before gate-03
    const ids = result.gates.map(g => g.id);
    expect(ids.indexOf('gate-01')).toBeLessThan(ids.indexOf('gate-02'));
    expect(ids.indexOf('gate-02')).toBeLessThan(ids.indexOf('gate-03'));
  });
});