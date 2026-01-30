import { WorkDescription, DecompositionContext, GeneratedGates, Gate } from './types.js';
import { decomposeWork } from './zeno-engine.js';
import { sequenceGates } from './gate-sequencer.js';
import { calculateConfidence } from './gate-scoring.js';

// Assuming these types from other modules
interface AnalysisResult {
  metrics: {
    linesOfCode: number;
    cyclomaticComplexity: number;
    coupling: number;
  };
  dependencies: string[];
}

interface Requirement {
  id: string;
  description: string;
}

/**
 * Main orchestrator for gate generation.
 * Takes end state description and optional analysis/requirements to generate complete gate sequence.
 */
export function generateGates(
  endState: string,
  analysisResult?: AnalysisResult,
  requirements?: Requirement[]
): GeneratedGates {
  // Convert inputs to WorkDescription
  const workDescription: WorkDescription = {
    description: endState,
    complexity: estimateInitialComplexity(endState, analysisResult, requirements),
    requirements: requirements ? requirements.map(r => r.description) : [],
    existingCodebase: analysisResult ? {
      linesOfCode: analysisResult.metrics.linesOfCode,
      complexity: analysisResult.metrics.cyclomaticComplexity,
      dependencies: analysisResult.dependencies
    } : undefined
  };

  // Create decomposition context
  const context: DecompositionContext = {
    maxGateComplexity: 30, // configurable threshold
    projectRequirements: workDescription.requirements,
    existingAnalysis: analysisResult
  };

  // Decompose work into gates
  const rawGates = decomposeWork(workDescription, context);

  // Sequence gates
  const sequenced = sequenceGates(rawGates);

  // Calculate final confidence for each gate
  const gatesWithConfidence: Gate[] = sequenced.gates.map(gate => ({
    ...gate,
    confidence: calculateConfidence(gate, context)
  }));

  // Update sequenced with confidence
  const sequencedWithConfidence = {
    ...sequenced,
    gates: gatesWithConfidence
  };

  // Calculate overall metrics
  const totalComplexity = gatesWithConfidence.reduce((sum, g) => sum + g.estimatedComplexity, 0);
  const averageConfidence = gatesWithConfidence.length > 0
    ? gatesWithConfidence.reduce((sum, g) => sum + g.confidence, 0) / gatesWithConfidence.length
    : 0;

  return {
    gates: gatesWithConfidence,
    sequenced: sequencedWithConfidence,
    totalComplexity,
    confidence: averageConfidence
  };
}

/**
 * Estimates initial complexity of the entire project.
 */
function estimateInitialComplexity(
  endState: string,
  analysisResult?: AnalysisResult,
  requirements?: Requirement[]
): number {
  let complexity = 50; // base

  // Factor in existing codebase
  if (analysisResult) {
    complexity += analysisResult.metrics.linesOfCode / 1000; // rough estimate
    complexity += analysisResult.metrics.cyclomaticComplexity / 10;
  }

  // Factor in requirements count
  if (requirements) {
    complexity += requirements.length * 5;
  }

  // Factor in description length (rough proxy for scope)
  complexity += endState.length / 100;

  return Math.min(100, complexity);
}