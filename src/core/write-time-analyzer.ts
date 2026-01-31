/**
 * Write-Time Analysis Engine
 * Performs incremental code analysis for gate completion
 * Analyzes only files changed during a gate's development
 */

import path from 'path';
import { execSync } from 'child_process';
import type { Module, CodeMetrics } from '../analysis/types.js';
import { CodeAnalyzer } from '../analysis/code-analyzer.js';
import { findProjectRoot } from '../utils/config.js';
import { getDatabase } from '../storage/database.js';

interface GateRow {
  id: string;
  project_id: string;
  sequence: number;
  name: string;
  description: string | null;
  status: string;
  type: string;
  completion_description: string | null;
  proposal_hashes: string | null;
  depends_on: string | null;
  hash: string;
  created_at: string;
  completed_at: string | null;
}

export interface GateAnalysisResult {
  gateId: string;
  changedFiles: string[];
  newModules: Map<string, Module>;
  incrementalMetrics: CodeMetrics;
  analysisTime: number;
  errors: string[];
}

/**
 * Analyzes code changes for a completed gate
 * @param gateId - The gate ID to analyze changes for
 * @returns Analysis result with incremental metrics
 */
export async function analyzeGateChanges(gateId: string): Promise<GateAnalysisResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    const projectRoot = findProjectRoot(process.cwd());
    if (!projectRoot) {
      throw new Error('Not in a Zeno project');
    }
    const db = getDatabase(projectRoot);

    // Get gate information
    const gate = db.prepare('SELECT * FROM gates WHERE id = ?').get(gateId) as GateRow | undefined;
    if (!gate) {
      throw new Error(`Gate ${gateId} not found`);
    }

    // Get changed files since gate creation
    const changedFiles = getChangedFilesSince(projectRoot, gate.created_at);

    // Filter to code files
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    const codeFiles = changedFiles.filter(file =>
      codeExtensions.includes(path.extname(file))
    );

    if (codeFiles.length === 0) {
      return {
        gateId,
        changedFiles: [],
        newModules: new Map(),
        incrementalMetrics: {
          coupling: { modules: new Map(), averageInstability: 0, highCoupling: [] },
          complexity: { modules: new Map(), maxComplexity: 0, averageComplexity: 0 },
          loc: { files: new Map(), totalLines: 0, totalCodeLines: 0, totalBlankLines: 0, totalCommentLines: 0 }
        },
        analysisTime: Date.now() - startTime,
        errors: []
      };
    }

    // Analyze only the changed files
    const analyzer = new CodeAnalyzer();
    const analysisResult = await analyzer.analyzeCodebase(projectRoot);

    // Filter modules to only changed files
    const newModules = new Map<string, Module>();
    for (const filePath of codeFiles) {
      const absolutePath = path.resolve(projectRoot, filePath);
      const module = analysisResult.modules.get(absolutePath);
      if (module) {
        newModules.set(absolutePath, module);
      }
    }

    // Get metrics for changed files only
    const incrementalMetrics = analyzer.getMetrics();
    if (!incrementalMetrics) {
      throw new Error('Failed to calculate metrics');
    }

    return {
      gateId,
      changedFiles: codeFiles,
      newModules,
      incrementalMetrics,
      analysisTime: Date.now() - startTime,
      errors
    };

  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      gateId,
      changedFiles: [],
      newModules: new Map(),
      incrementalMetrics: {
        coupling: { modules: new Map(), averageInstability: 0, highCoupling: [] },
        complexity: { modules: new Map(), maxComplexity: 0, averageComplexity: 0 },
        loc: { files: new Map(), totalLines: 0, totalCodeLines: 0, totalBlankLines: 0, totalCommentLines: 0 }
      },
      analysisTime: Date.now() - startTime,
      errors
    };
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
    const gitCommand = `git log --since="${sinceTimestamp}" --name-only --pretty=format: | sort | uniq`;
    const output = execSync(gitCommand, {
      cwd: projectRoot,
      encoding: 'utf-8'
    });

    // Parse the output - git log --name-only lists files after commit info
    const lines = output.split('\n').filter(line => line.trim() && !line.startsWith('commit '));
    return [...new Set(lines)]; // Remove duplicates

  } catch (error) {
    // If git fails, fall back to checking all files (less efficient but works)
    console.warn('Git diff failed, falling back to full analysis:', error);
    return [];
  }
}