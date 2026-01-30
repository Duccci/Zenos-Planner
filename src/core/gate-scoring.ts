import { Gate, DecompositionContext } from './types.js';

/**
 * Calculates confidence scores for generated gates based on various factors.
 */
export function calculateConfidence(gate: Gate, context: DecompositionContext): number {
  let confidence = 50; // base confidence

  // Requirement coverage: higher if gate addresses specific requirements
  if (gate.objectives.some(obj => obj.acceptanceCriteria.length > 0)) {
    confidence += 20;
  }

  // Complexity clarity: lower confidence for very complex gates
  if (gate.estimatedComplexity > 80) {
    confidence -= 15;
  } else if (gate.estimatedComplexity < 20) {
    confidence += 10;
  }

  // Precedent: higher if similar gates exist (simplified - assume based on context)
  if (context.existingAnalysis) {
    confidence += 10;
  }

  // Dependencies: lower confidence if many dependencies (complexity)
  if (gate.dependencies.length > 3) {
    confidence -= 10;
  }

  // Ensure within bounds
  return Math.max(0, Math.min(100, confidence));
}