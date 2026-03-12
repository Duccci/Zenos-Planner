/**
 * Core types for gate generation and Zeno engine
 */

/**
 * Proposal role taxonomy consolidating three dimensions:
 * - Location type: gate-tied vs solitary
 * - Test-driven phase: RED (test-suite) vs GREEN (test-cleanup) vs implementation
 * - Semantic role: feature, testing, cleanup, documentation
 * 
 * Each proposal may carry multiple roles, though typical patterns are:
 * - 'testing': test-suite or test-cleanup proposals (RED/GREEN phase)
 * - 'feature': implementation proposals with new functionality
 * - 'cleanup': refactoring or maintenance tasks
 * - 'documentation': docs-only changes
 * - 'solitary': not tied to a gate (any content)
 */
export type ProposalRole = 'testing' | 'feature' | 'cleanup' | 'documentation' | 'solitary'

export interface WorkDescription {
  description: string;
  complexity: number; // 0-100, estimated complexity
  requirements: string[]; // requirement hashes or descriptions
  existingCodebase?: {
    linesOfCode: number;
    complexity: number;
    dependencies: string[];
  };
}

export interface GateObjective {
  description: string;
  deliverables: string[];
  acceptanceCriteria: string[];
}

export interface Gate {
  id: string; // e.g., "gate-01"
  name: string;
  description: string;
  objectives: GateObjective[];
  dependencies: string[]; // gate ids that must complete before this
  estimatedComplexity: number;
  confidence: number; // 0-100
}

export interface DecompositionContext {
  maxGateComplexity: number; // threshold for when to stop decomposing
  projectRequirements: string[];
  existingAnalysis?: {
    metrics: {
      linesOfCode: number;
      cyclomaticComplexity: number;
      coupling: number;
    };
    dependencies: string[];
  };
}

export interface SequencedGates {
  gates: Gate[];
  dependencyGraph: Map<string, string[]>; // gate id -> dependencies
  parallelGroups: Gate[][]; // gates that can be worked on in parallel
}

export interface GeneratedGates {
  gates: Gate[];
  sequenced: SequencedGates;
  totalComplexity: number;
  confidence: number;
}
