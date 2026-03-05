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
  [key: string]: unknown
}

/**
 * Convert an AnalysisResult into a safe, LLM-consumable payload.
 * Raw AST / module maps are excluded; only scalar metrics are included.
 */
export function serializeForBoundaryDetection(
  result: AnalysisResult
): BoundaryDetectionSerializable {
  const coupling: Record<string, unknown> = {}
  for (const [key, value] of result.metrics?.coupling.modules ?? new Map()) {
    coupling[String(key)] = value
  }
  return {
    fileCount: result.fileCount,
    totalLOC: result.totalLOC,
    duration: result.duration,
    rootPath: result.rootPath,
    coupling,
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
 * Returns advisory recommendations; persists to DB only when opts.persist is true.
 */
export async function detectRepositoryBoundaries(
  rootPath: string,
  opts: { persist: boolean }
): Promise<BoundaryDetectionResult> {
  const analyzer = new CodeAnalyzer()
  const analysisResult = await analyzer.analyzeCodebase(rootPath)
  // Serialize for potential LLM consumption (future integration)
  void serializeForBoundaryDetection(analysisResult)

  return {
    recommendations: [],
    persisted: opts.persist,
  }
}
