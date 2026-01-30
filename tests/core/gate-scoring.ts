import { describe, it, expect } from 'vitest';
import { calculateConfidence } from '../core/gate-scoring.js';
import { Gate, DecompositionContext } from '../core/types.js';

describe('calculateConfidence', () => {
  it('should calculate confidence for a simple gate', () => {
    const gate: Gate = {
      id: 'gate-01',
      name: 'Gate 1',
      description: 'Simple gate',
      objectives: [{
        description: 'Do something',
        deliverables: ['Deliverable 1'],
        acceptanceCriteria: ['Criteria 1']
      }],
      dependencies: [],
      estimatedComplexity: 20,
      confidence: 0 // will be calculated
    };

    const context: DecompositionContext = {
      maxGateComplexity: 30,
      projectRequirements: ['req1']
    };

    const confidence = calculateConfidence(gate, context);

    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(100);
  });

  it('should give higher confidence for gates with acceptance criteria', () => {
    const gateWithCriteria: Gate = {
      id: 'gate-01',
      name: 'Gate 1',
      description: 'Gate with criteria',
      objectives: [{
        description: 'Do something',
        deliverables: ['Deliverable 1'],
        acceptanceCriteria: ['Criteria 1', 'Criteria 2']
      }],
      dependencies: [],
      estimatedComplexity: 20,
      confidence: 0
    };

    const gateWithoutCriteria: Gate = {
      id: 'gate-02',
      name: 'Gate 2',
      description: 'Gate without criteria',
      objectives: [{
        description: 'Do something',
        deliverables: ['Deliverable 1'],
        acceptanceCriteria: []
      }],
      dependencies: [],
      estimatedComplexity: 20,
      confidence: 0
    };

    const context: DecompositionContext = {
      maxGateComplexity: 30,
      projectRequirements: ['req1']
    };

    const confidenceWith = calculateConfidence(gateWithCriteria, context);
    const confidenceWithout = calculateConfidence(gateWithoutCriteria, context);

    expect(confidenceWith).toBeGreaterThan(confidenceWithout);
  });

  it('should reduce confidence for high complexity gates', () => {
    const lowComplexityGate: Gate = {
      id: 'gate-01',
      name: 'Low complexity',
      description: 'Simple',
      objectives: [],
      dependencies: [],
      estimatedComplexity: 10,
      confidence: 0
    };

    const highComplexityGate: Gate = {
      id: 'gate-02',
      name: 'High complexity',
      description: 'Complex',
      objectives: [],
      dependencies: [],
      estimatedComplexity: 90,
      confidence: 0
    };

    const context: DecompositionContext = {
      maxGateComplexity: 30,
      projectRequirements: []
    };

    const lowConfidence = calculateConfidence(lowComplexityGate, context);
    const highConfidence = calculateConfidence(highComplexityGate, context);

    expect(lowConfidence).toBeGreaterThan(highConfidence);
  });
});