import { WorkDescription, Gate, DecompositionContext } from './types.js';

/**
 * Core iterative decomposition algorithm inspired by Zeno's paradox.
 * Recursively breaks down work until each piece is small enough to be a single gate.
 */
export function decomposeWork(
  remainingWork: WorkDescription,
  context: DecompositionContext,
  gateCounter: { count: number } = { count: 0 }
): Gate[] {
  // Base case: work is small enough for a single gate
  if (remainingWork.complexity <= context.maxGateComplexity) {
    gateCounter.count++;
    const countStr = String(gateCounter.count);
    const gateId = 'gate-' + countStr.padStart(2, '0');
    return [{
      id: gateId,
      name: `Gate ${String(gateCounter.count)}`,
      description: remainingWork.description,
      objectives: [{
        description: remainingWork.description,
        deliverables: [`Complete ${remainingWork.description}`],
        acceptanceCriteria: [`All requirements implemented: ${remainingWork.requirements.join(', ')}`]
      }],
      dependencies: [], // will be set by sequencer
      estimatedComplexity: remainingWork.complexity,
      confidence: calculateDecompositionConfidence(remainingWork, context)
    }];
  }

  // Recursive case: split work into smaller pieces
  const subWorks = splitWork(remainingWork);

  const gates: Gate[] = [];
  for (const subWork of subWorks) {
    gates.push(...decomposeWork(subWork, context, gateCounter));
  }

  return gates;
}

/**
 * Splits work into smaller, more manageable pieces.
 * Uses requirements and complexity to determine split points.
 */
function splitWork(work: WorkDescription): WorkDescription[] {
  const { requirements } = work;

  // If few requirements, split by complexity
  if (requirements.length <= 3) {
    const halfComplexity = Math.ceil(work.complexity / 2);
    return [
      {
        ...work,
        description: `${work.description} (Part 1)`,
        complexity: halfComplexity,
        requirements: requirements.slice(0, Math.ceil(requirements.length / 2))
      },
      {
        ...work,
        description: `${work.description} (Part 2)`,
        complexity: work.complexity - halfComplexity,
        requirements: requirements.slice(Math.ceil(requirements.length / 2))
      }
    ];
  }

  // Split by requirements if many
  const mid = Math.ceil(requirements.length / 2);
  const part1Reqs = requirements.slice(0, mid);
  const part2Reqs = requirements.slice(mid);

  // Estimate complexity split based on requirements
  const totalReqs = requirements.length;
  const part1Complexity = Math.ceil((part1Reqs.length / totalReqs) * work.complexity);
  const part2Complexity = work.complexity - part1Complexity;

  return [
    {
      ...work,
      description: `${work.description} (Requirements: ${part1Reqs.join(', ')})`,
      complexity: part1Complexity,
      requirements: part1Reqs
    },
    {
      ...work,
      description: `${work.description} (Requirements: ${part2Reqs.join(', ')})`,
      complexity: part2Complexity,
      requirements: part2Reqs
    }
  ];
}

/**
 * Calculates confidence in the decomposition based on work clarity and context.
 */
function calculateDecompositionConfidence(work: WorkDescription, context: DecompositionContext): number {
  let confidence = 50; // base confidence

  // Higher confidence if requirements are clear
  if (work.requirements.length > 0) {
    confidence += 20;
  }

  // Higher if existing codebase analysis available
  if (context.existingAnalysis) {
    confidence += 15;
  }

  // Lower if very high complexity
  if (work.complexity > 80) {
    confidence -= 10;
  }

  return Math.max(0, Math.min(100, confidence));
}