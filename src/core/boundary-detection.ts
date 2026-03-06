import type { AnalysisResult } from '../analysis/types.js'
import { CodeAnalyzer } from '../analysis/code-analyzer.js'

export interface BoundaryRecommendation {
  name: string
  type: string
  path: string
  rationale?: string
}

export interface BoundaryDetectionResult {
  recommendations: BoundaryRecommendation[]
  persisted: boolean
}

export interface BoundaryDetectionSerializable {
  fileCount: number
  totalLOC: number
  duration: number
  rootPath: string
  coupling: Record<string, unknown>
  directoryFileCounts: Record<string, number>
  directoryLOC: Record<string, number>
  dependencyEdges: Array<{ source: string; target: string }>
}

/**
 * Abstracts LLM subagent invocation for boundary recommendation.
 * Implementations receive serialized analysis data and return advisory recommendations.
 */
export interface BoundaryAnalyzer {
  analyze(input: BoundaryDetectionSerializable): Promise<BoundaryRecommendation[]>
}

/**
 * Production implementation that builds a structured prompt for the architect-reviewer
 * subagent (awesome-claude-code-subagents/categories/04-quality-security/architect-reviewer.md).
 * Returns an empty list until a real LLM invocation layer is wired by a downstream proposal.
 */
export class ArchitectReviewerBoundaryAnalyzer implements BoundaryAnalyzer {
  async analyze(_input: BoundaryDetectionSerializable): Promise<BoundaryRecommendation[]> {
    // Structured prompt contract (stable field names used so the architect-reviewer
    // subagent can deterministically parse the input):
    //
    //   Root path: {input.rootPath}  Files: {input.fileCount}  LOC: {input.totalLOC}
    //   Coupling metrics:       JSON.stringify(input.coupling)
    //   Per-directory file counts: JSON.stringify(input.directoryFileCounts)
    //   Per-directory LOC:      JSON.stringify(input.directoryLOC)
    //   Dependency edges:       JSON.stringify(input.dependencyEdges)
    //   → parseBoundaryRecommendations(response) → BoundaryRecommendation[]
    //
    // Real subagent invocation is deferred to a downstream integration proposal.
    // Replace this return when the invocation layer is available.
    return []
  }
}

function getDirectory(relativePath: string): string {
  const lastSlash = relativePath.lastIndexOf('/')
  return lastSlash >= 0 ? relativePath.slice(0, lastSlash) : '.'
}

/**
 * Convert an AnalysisResult into a safe, LLM-consumable payload.
 * Raw AST / module maps are excluded; only scalar metrics are included.
 * Includes per-directory file counts, per-directory LOC, and dependency edges.
 */
export function serializeForBoundaryDetection(
  result: AnalysisResult
): BoundaryDetectionSerializable {
  const coupling: Record<string, unknown> = {}
  for (const [key, value] of result.metrics?.coupling.modules ?? new Map()) {
    coupling[String(key)] = value
  }

  const directoryFileCounts: Record<string, number> = {}
  const directoryLOC: Record<string, number> = {}
  const dependencyEdges: Array<{ source: string; target: string }> = []

  for (const [, module] of result.modules) {
    const dir = getDirectory(module.relativePath)
    directoryFileCounts[dir] = (directoryFileCounts[dir] ?? 0) + 1
    directoryLOC[dir] = (directoryLOC[dir] ?? 0) + module.linesOfCode
    for (const imp of module.dependencies.imports) {
      dependencyEdges.push({ source: module.relativePath, target: imp.source })
    }
  }

  return {
    fileCount: result.fileCount,
    totalLOC: result.totalLOC,
    duration: result.duration,
    rootPath: result.rootPath,
    coupling,
    directoryFileCounts,
    directoryLOC,
    dependencyEdges,
  }
}

/**
 * Parse a freeform LLM boundary-recommendation string into structured records.
 * Expects sections of the form:
 *   ### Boundary N: <name>
 *   - **Path**: <path>
 *   - **Type**: <type>
 *   - **Rationale**: <rationale>
 */
export function parseBoundaryRecommendations(llmResponse: string): BoundaryRecommendation[] {
  const recommendations: BoundaryRecommendation[] = []
  // Match each "### Boundary N: name" block up to the next boundary or end of string
  const blockRe = /###\s+Boundary\s+\d+:\s+(.+?)(?=###\s+Boundary|\s*$)/gs
  let blockMatch: RegExpExecArray | null

  while ((blockMatch = blockRe.exec(llmResponse)) !== null) {
    const [block = '', rawName = ''] = blockMatch
    const name = rawName.trim()
    const pathMatch = /\*\*Path\*\*:\s*(.+)/i.exec(block)
    const typeMatch = /\*\*Type\*\*:\s*(.+)/i.exec(block)
    const rationaleMatch = /\*\*Rationale\*\*:\s*(.+)/i.exec(block)

    const path = pathMatch?.[1]?.trim()
    const type = typeMatch?.[1]?.trim()
    if (path !== undefined && type !== undefined) {
      recommendations.push({
        name,
        path,
        type,
        rationale: rationaleMatch?.[1]?.trim(),
      })
    }
  }

  return recommendations
}

/**
 * Run boundary detection on a repository root.
 * Returns advisory recommendations; persisted is always false — persistence
 * is handled by the downstream storage layer (#1f01eca0).
 */
export async function detectRepositoryBoundaries(
  rootPath: string,
  _opts: { persist: boolean },
  analyzer: BoundaryAnalyzer = new ArchitectReviewerBoundaryAnalyzer()
): Promise<BoundaryDetectionResult> {
  const codeAnalyzer = new CodeAnalyzer()
  const analysisResult = await codeAnalyzer.analyzeCodebase(rootPath)
  const serialized = serializeForBoundaryDetection(analysisResult)
  const recommendations = await analyzer.analyze(serialized)

  return {
    recommendations,
    persisted: false,
  }
}
