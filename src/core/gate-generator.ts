import { WorkDescription, DecompositionContext, GeneratedGates, Gate } from './types.js'
import { decomposeWork } from './zeno-engine.js'
import { sequenceGates } from './gate-sequencer.js'
import { calculateConfidence } from './gate-scoring.js'
import { getDatabase } from '../storage/database.js'
import { readProjectOverview, getGatesFromOverview } from '../utils/config.js'
import type { CodeMetrics } from '../analysis/types.js'

// Assuming these types from other modules
interface InitialAnalysisResult {
  metrics: {
    linesOfCode: number
    cyclomaticComplexity: number
    coupling: number
  }
  dependencies: string[]
}

interface AnalysisResult {
  gateId: string
  changedFiles: string[]
  newModules: Record<string, unknown> // Module type from analysis
  incrementalMetrics: CodeMetrics
  analysisTime: number
  errors: string[]
}

interface Requirement {
  id: string
  description: string
}

export interface RegenerationSuggestions {
  originalGates: Gate[]
  suggestedGates: Gate[]
  changes: {
    type: 'add' | 'modify' | 'remove'
    gateId: string
    reason: string
    confidence: number
  }[]
  reasoning: string
}

/**
 * Main orchestrator for gate generation.
 * Takes end state description and optional analysis/requirements to generate complete gate sequence.
 */
export function generateGates(
  endState: string,
  analysisResult?: InitialAnalysisResult,
  requirements?: Requirement[]
): GeneratedGates {
  // Convert inputs to WorkDescription
  const workDescription: WorkDescription = {
    description: endState,
    complexity: estimateInitialComplexity(endState, analysisResult, requirements),
    requirements: requirements ? requirements.map((r) => r.description) : [],
    existingCodebase: analysisResult
      ? {
          linesOfCode: analysisResult.metrics.linesOfCode,
          complexity: analysisResult.metrics.cyclomaticComplexity,
          dependencies: analysisResult.dependencies,
        }
      : undefined,
  }

  // Create decomposition context
  const context: DecompositionContext = {
    maxGateComplexity: 30, // configurable threshold
    projectRequirements: workDescription.requirements,
    existingAnalysis: analysisResult,
  }

  // Decompose work into gates
  const rawGates = decomposeWork(workDescription, context)

  // Sequence gates
  const sequenced = sequenceGates(rawGates)

  // Calculate final confidence for each gate
  const gatesWithConfidence: Gate[] = sequenced.gates.map((gate) => ({
    ...gate,
    confidence: calculateConfidence(gate, context),
  }))

  // Update sequenced with confidence
  const sequencedWithConfidence = {
    ...sequenced,
    gates: gatesWithConfidence,
  }

  // Calculate overall metrics
  const totalComplexity = gatesWithConfidence.reduce((sum, g) => sum + g.estimatedComplexity, 0)
  const averageConfidence =
    gatesWithConfidence.length > 0
      ? gatesWithConfidence.reduce((sum, g) => sum + g.confidence, 0) / gatesWithConfidence.length
      : 0

  return {
    gates: gatesWithConfidence,
    sequenced: sequencedWithConfidence,
    totalComplexity,
    confidence: averageConfidence,
  }
}

/**
 * Estimates initial complexity of the entire project.
 */
function estimateInitialComplexity(
  endState: string,
  analysisResult?: InitialAnalysisResult,
  requirements?: Requirement[]
): number {
  let complexity = 50 // base

  // Factor in existing codebase
  if (analysisResult) {
    complexity += analysisResult.metrics.linesOfCode / 1000 // rough estimate
    complexity += analysisResult.metrics.cyclomaticComplexity / 10
  }

  // Factor in requirements count
  if (requirements) {
    complexity += requirements.length * 5
  }

  // Factor in description length (rough proxy for scope)
  complexity += endState.length / 100

  return Math.min(100, complexity)
}

/**
 * Intelligently regenerates future gates by blending theoretical decomposition with analyzed metrics.
 * Automatically detects if analysis data is available:
 * - If analysis exists: Uses data-driven approach with empirical metrics
 * - If no analysis: Falls back to pure theoretical decomposition
 * - Combines both for most accurate gate sequencing
 */
export async function regenerateGatesWithAnalysis(
  fromGateId: string
): Promise<RegenerationSuggestions> {
  // Verify gate exists in project overview
  try {
    const overview = await readProjectOverview()
    const summaries = getGatesFromOverview(overview)
    if (!summaries.find((g) => g.id === fromGateId)) {
      return {
        originalGates: [],
        suggestedGates: [],
        changes: [],
        reasoning: `Gate ${fromGateId} not found in project overview.`,
      }
    }
  } catch {
    // overview unavailable — continue with regeneration anyway
  }

  // Check if analysis data exists in a separate table
  const db = getDatabase()
  let hasAnalysisData = false
  try {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='gate_analysis'")
      .get()
    if (table) {
      const row = db
        .prepare('SELECT 1 FROM gate_analysis WHERE gate_id = ? LIMIT 1')
        .get(fromGateId)
      hasAnalysisData = !!row
    }
  } catch {
    hasAnalysisData = false
  }

  // Use appropriate regeneration strategy
  if (hasAnalysisData) {
    return await regenerateGatesFromAnalysis(fromGateId)
  } else {
    // Fall back to theoretical regeneration if no analysis data yet
    return await regenerateGatesTheoretical(fromGateId)
  }
}

/**
 * Regenerates future gates based on analyzed code metrics from completed gates.
 * Compares theoretical decomposition with data-driven insights.
 */
async function regenerateGatesFromAnalysis(fromGateId: string): Promise<RegenerationSuggestions> {
  const overview = await readProjectOverview()
  const summaries = getGatesFromOverview(overview)

  if (!summaries.find((g) => g.id === fromGateId)) {
    throw new Error(`Gate ${fromGateId} not found`)
  }

  // Build gate list from project overview
  const allGates: Gate[] = summaries.map((s) => ({
    id: s.id,
    name: s.name,
    description: '',
    objectives: [],
    dependencies: [],
    estimatedComplexity: 0,
    confidence: 0,
    type: 'feature' as const,
    status: s.status as 'pending' | 'in_progress' | 'completed' | 'rejected',
  }))

  // Get analysis data from completed gates
  // TODO: Implement analysis data storage when analysis layer is added (Gate 4)
  const gateAnalyses: Record<string, AnalysisResult> = {}

  // Find the fromGate index
  const fromGateIndex = allGates.findIndex((g) => g.id === fromGateId)
  if (fromGateIndex === -1) {
    throw new Error(`Gate ${fromGateId} not found in project`)
  }

  // Get future gates (after fromGate)
  const futureGates = allGates.slice(fromGateIndex + 1)
  const completedGates = allGates.slice(0, fromGateIndex + 1)

  // Aggregate metrics from completed gates
  const aggregatedMetrics: CodeMetrics = {
    coupling: { modules: new Map(), averageInstability: 0, highCoupling: [] },
    complexity: { modules: new Map(), maxComplexity: 0, averageComplexity: 0 },
    loc: {
      files: new Map(),
      totalLines: 0,
      totalCodeLines: 0,
      totalBlankLines: 0,
      totalCommentLines: 0,
    },
  }

  let totalComplexity = 0
  let analysisCount = 0

  for (const gate of completedGates) {
    const analysis = gateAnalyses[gate.id]
    if (analysis) {
      // Merge coupling high coupling
      aggregatedMetrics.coupling.highCoupling.push(
        ...analysis.incrementalMetrics.coupling.highCoupling
      )

      // Average complexity
      totalComplexity += analysis.incrementalMetrics.complexity.averageComplexity
      analysisCount++

      // Sum LOC
      aggregatedMetrics.loc.totalCodeLines += analysis.incrementalMetrics.loc.totalCodeLines
    }
  }

  if (analysisCount > 0) {
    aggregatedMetrics.complexity.averageComplexity = totalComplexity / analysisCount
  }

  // Generate suggestions based on metrics
  const changes: RegenerationSuggestions['changes'] = []
  const suggestedGates = [...futureGates]

  // If high coupling detected, suggest refactoring gate
  if (aggregatedMetrics.coupling.highCoupling.length > 2) {
    const nextGateNum = allGates.length + 1
    changes.push({
      type: 'add',
      gateId: `gate-${nextGateNum.toString().padStart(2, '0')}`,
      reason: `High coupling detected in ${aggregatedMetrics.coupling.highCoupling.length.toString()} modules - recommend architectural refactoring`,
      confidence: 0.85,
    })
  }

  // If complexity is high, suggest breaking down complex gates
  if (aggregatedMetrics.complexity.averageComplexity > 15) {
    for (const gate of futureGates) {
      if (gate.estimatedComplexity > 25) {
        changes.push({
          type: 'modify',
          gateId: gate.id,
          reason: `Gate complexity ${gate.estimatedComplexity.toString()} exceeds recommended threshold - consider splitting`,
          confidence: 0.75,
        })
      }
    }
  }

  // If LOC growth is slow, suggest combining small gates
  const avgGateComplexity =
    futureGates.reduce((sum, g) => sum + g.estimatedComplexity, 0) / futureGates.length
  if (avgGateComplexity < 10 && futureGates.length > 3) {
    const lastGate = futureGates[futureGates.length - 1]
    if (lastGate) {
      changes.push({
        type: 'modify',
        gateId: lastGate.id,
        reason: 'Multiple low-complexity gates detected - consider combining for efficiency',
        confidence: 0.6,
      })
    }
  }

  const reasoning =
    `Analysis of ${completedGates.length.toString()} completed gates shows: ` +
    `${aggregatedMetrics.coupling.highCoupling.length.toString()} coupling hotspots, ` +
    `avg complexity ${aggregatedMetrics.complexity.averageComplexity.toFixed(1)}, ` +
    `total LOC ${aggregatedMetrics.loc.totalCodeLines.toString()}. ` +
    `Suggested ${changes.length.toString()} gate modifications.`

  return {
    originalGates: futureGates,
    suggestedGates,
    changes,
    reasoning,
  }
}

/**
 * Theoretical gate regeneration used when no analysis data is available and no completed gates exist.
 * Regenerates all gates from the project end state.
 */
export async function regenerateGatesTheoreticalFromProject(): Promise<RegenerationSuggestions> {
  // Get project overview (single source of truth)
  const projectOverview = await readProjectOverview()

  // Build gate list from project overview
  const allGates: Gate[] = getGatesFromOverview(projectOverview).map((s) => ({
    id: s.id,
    name: s.name,
    description: '',
    objectives: [],
    dependencies: [],
    estimatedComplexity: 0,
    confidence: 0,
    type: 'feature' as const,
    status: s.status as 'pending' | 'in_progress' | 'completed' | 'rejected',
  }))

  // Regenerate using theoretical decomposition
  const workDescription: WorkDescription = {
    description: projectOverview.endState,
    complexity: 50,
    requirements: [],
    existingCodebase: undefined,
  }

  const context: DecompositionContext = {
    maxGateComplexity: 30,
    projectRequirements: [],
    existingAnalysis: undefined,
  }

  const redecomposed = decomposeWork(workDescription, context)
  const resequenced = sequenceGates(redecomposed)

  const changes: RegenerationSuggestions['changes'] = []
  const reasoning =
    `Using theoretical decomposition based on project end state: "${projectOverview.endState}". ` +
    `Complete gates and run analysis to enable data-driven refinements.`

  return {
    originalGates: allGates,
    suggestedGates: resequenced.gates,
    changes,
    reasoning,
  }
}

/**
 * Theoretical gate regeneration used when no analysis data is available.
 * Uses decomposition-based approach to regenerate future gates.
 */
async function regenerateGatesTheoretical(fromGateId: string): Promise<RegenerationSuggestions> {
  const overview = await readProjectOverview()
  const summaries = getGatesFromOverview(overview)

  // Build gate list from project overview
  const allGates: Gate[] = summaries.map((s) => ({
    id: s.id,
    name: s.name,
    description: '',
    objectives: [],
    dependencies: [],
    estimatedComplexity: 0,
    confidence: 0,
    type: 'feature' as const,
    status: s.status as 'pending' | 'in_progress' | 'completed' | 'rejected',
  }))

  // Find the fromGate index
  const fromGateIndex = allGates.findIndex((g) => g.id === fromGateId)
  if (fromGateIndex === -1) {
    throw new Error(`Gate ${fromGateId} not found in project overview`)
  }

  // Get future gates
  const futureGates = allGates.slice(fromGateIndex + 1)

  // Regenerate using theoretical decomposition
  const workDescription: WorkDescription = {
    description: 'Complete the project implementation', // Default description since no project overview available
    complexity: 50,
    requirements: [],
    existingCodebase: undefined,
  }

  const context: DecompositionContext = {
    maxGateComplexity: 30,
    projectRequirements: [],
    existingAnalysis: undefined,
  }

  const redecomposed = decomposeWork(workDescription, context)
  const resequenced = sequenceGates(redecomposed)

  const changes: RegenerationSuggestions['changes'] = []
  const reasoning =
    `No analysis data available yet. Using theoretical decomposition. ` +
    `Complete gates and run analysis (zeno gates complete) to enable data-driven refinements.`

  return {
    originalGates: futureGates,
    suggestedGates: resequenced.gates,
    changes,
    reasoning,
  }
}
