/**
 * Write-Time Analysis Engine
 * Performs incremental code analysis for gate completion
 * Analyzes only files changed during a gate's development
 */

import path from 'path'
import { execSync } from 'child_process'
import type { Module, CodeMetrics } from '../analysis/types.js'

import { findProjectRoot } from '../utils/config.js'
import { getDatabase } from '../storage/database.js'

interface GateRow {
  id: string
  project_id: string
  sequence: number
  name: string
  description: string | null
  status: string
  type: string
  completion_description: string | null
  proposal_hashes: string | null
  depends_on: string | null
  hash: string
  created_at: string
  completed_at: string | null
}

export interface GateAnalysisResult {
  gateId: string
  changedFiles: string[]
  newModules: Map<string, Module>
  incrementalMetrics: CodeMetrics
  analysisTime: number
  errors: string[]
}

/**
 * Analyzes code changes for a completed gate
 * @param gateId - The gate ID to analyze changes for
 * @returns Analysis result with incremental metrics
 */
export async function analyzeGateChanges(gateId: string): Promise<GateAnalysisResult> {
  const startTime = Date.now()
  const errors: string[] = []

  try {
    const projectRoot = findProjectRoot(process.cwd())
    if (!projectRoot) {
      throw new Error('Not in a Zeno project')
    }
    const db = getDatabase(projectRoot)

    // Get gate information
    const gate = db.prepare('SELECT * FROM gates WHERE id = ?').get(gateId) as GateRow | undefined
    if (!gate) {
      throw new Error(`Gate ${gateId} not found`)
    }

    // Debug: gate row and creation timestamp

    console.debug('gate row:', gate)

    // Get changed files since gate creation
    const changedFiles = getChangedFilesSince(projectRoot, gate.created_at)

    // Debug: changed files list

    console.debug('changedFiles (after git):', changedFiles)

    // Filter to code files
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
    const codeFiles = changedFiles.filter((file) => codeExtensions.includes(path.extname(file)))

    if (codeFiles.length === 0) {
      return {
        gateId,
        changedFiles: [],
        newModules: new Map(),
        incrementalMetrics: {
          coupling: { modules: new Map(), averageInstability: 0, highCoupling: [] },
          complexity: { modules: new Map(), maxComplexity: 0, averageComplexity: 0 },
          loc: {
            files: new Map(),
            totalLines: 0,
            totalCodeLines: 0,
            totalBlankLines: 0,
            totalCommentLines: 0,
          },
        },
        analysisTime: Date.now() - startTime,
        errors: [],
      }
    }

    // Analyze only the changed files
    const { CodeAnalyzer } = await import('../analysis/code-analyzer.js')
    const analyzer = new CodeAnalyzer()
    const analysisResult = await analyzer.analyzeCodebase(projectRoot)

    // Filter modules to only changed files and use relative keys for consistency
    const newModules = new Map<string, Module>()
    const normalize = (p: string): string => p.replace(/\\/g, '/').replace(/\/+/g, '/')

    for (const filePath of codeFiles) {
      const absolutePath = normalize(path.resolve(projectRoot, filePath))
      const relPath = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')

      // Try to find module by absolute path, by provided relative path, or by matching module.relativePath
      let module = analysisResult.modules.get(absolutePath)
      module ??= analysisResult.modules.get(relPath)

      // More robust matching: allow modules keyed with different path formats
      if (!module) {
        for (const [key, m] of analysisResult.modules) {
          const normalizedKey = key.replace(/\\/g, '/').replace(/\/+/g, '/')
          const mm = m
          const candidateFilePath = mm.filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
          const candidateRel = mm.relativePath.replace(/\\/g, '/').replace(/\/+/g, '')

          // Match by key ending with relative path
          if (normalizedKey.endsWith(`/${relPath}`) || normalizedKey === relPath) {
            module = m
            break
          }

          // Match by module.filePath ending with relative path
          if (candidateFilePath.endsWith(`/${relPath}`)) {
            module = m
            break
          }

          // Match by explicit relativePath
          if (candidateRel === relPath) {
            module = m
            break
          }
        }
      }

      if (module) {
        // Use relative path as the key for newModules map (consistent with tests)
        newModules.set(relPath, module)
      }
    }

    // Get metrics for changed files only (be tolerant of analyzer API shape)
    let incrementalMetrics: CodeMetrics | undefined
    interface AnalyzerWithMetrics {
      getMetrics?: () => CodeMetrics
    }
    const analyzerWithMetrics = analyzer as unknown as AnalyzerWithMetrics
    if (typeof analyzerWithMetrics.getMetrics === 'function') {
      incrementalMetrics = analyzerWithMetrics.getMetrics()
    } else {
      const metricsVar = (analysisResult as unknown as { metrics?: CodeMetrics }).metrics
      if (metricsVar) {
        incrementalMetrics = metricsVar
      }
    }

    incrementalMetrics ??= {
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

    return {
      gateId,
      changedFiles: codeFiles,
      newModules,
      incrementalMetrics,
      analysisTime: Date.now() - startTime,
      errors,
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
    return {
      gateId,
      changedFiles: [],
      newModules: new Map(),
      incrementalMetrics: {
        coupling: { modules: new Map(), averageInstability: 0, highCoupling: [] },
        complexity: { modules: new Map(), maxComplexity: 0, averageComplexity: 0 },
        loc: {
          files: new Map(),
          totalLines: 0,
          totalCodeLines: 0,
          totalBlankLines: 0,
          totalCommentLines: 0,
        },
      },
      analysisTime: Date.now() - startTime,
      errors,
    }
  }
}

/**
 * Get files changed since a specific timestamp using git
 * @param projectRoot - Project root directory
 * @param sinceTimestamp - ISO timestamp to check changes since
 * @returns Array of changed file paths relative to project root
 */
function getChangedFilesSince(projectRoot: string, sinceTimestamp: string): string[] {
  try {
    // Use git log to find commits since the timestamp
    const gitCommand = `git log --since="${sinceTimestamp}" --name-only --pretty=format: | sort | uniq`
    const output = execSync(gitCommand, {
      cwd: projectRoot,
      encoding: 'utf-8',
    })

    // Parse the output - git log --name-only lists files after commit info
    const lines = output.split('\n').filter((line) => line.trim() && !line.startsWith('commit '))
    return [...new Set(lines)] // Remove duplicates
  } catch (error) {
    // If git fails, fall back to checking all files (less efficient but works)
    console.warn('Git diff failed, falling back to full analysis:', error)
    return []
  }
}
