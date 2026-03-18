/**
 * Code Analyzer - orchestrates codebase analysis
 * Performs directory traversal, file filtering, AST parsing, and dependency extraction
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { File as BabelFile } from '@babel/types';
import type {
  AnalysisResult,
  Module,
  AnalysisOptions,
  CodeMetrics,
} from './types.js';
import { parseFile } from './parser.js';
import { parseFileTreeSitter } from './tree-sitter-parser.js';
import { extractTreeSitterMetrics } from './tree-sitter-metrics.js';
import { extractDependencies, resolveImportPath } from './dependency-extractor.js';
import type { TreeSitterParseResult } from './types.js';
import { calculateCoupling } from './metrics/coupling.js';
import { calculateComplexityMetrics } from './metrics/complexity.js';
import { countLOCMetrics } from './metrics/loc.js';
import { DependencyGraph } from './graph/dependency-graph.js';

const DEFAULT_SKIP_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.git',
  '.vscode',
  '.idea',
  'target',
  'bin',
  'obj',
];

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const DEFAULT_TREE_SITTER_EXTENSIONS = ['.py', '.rs', '.go', '.cpp', '.c', '.h'];

/** Type guard: true when ast is a Babel File node (not Tree-sitter, not null) */
function isBabelFile(ast: BabelFile | TreeSitterParseResult | null): ast is BabelFile {
  return ast !== null && 'program' in ast;
}

/**
 * Analyzes a codebase by parsing all files and extracting dependencies
 */
export class CodeAnalyzer {
  private modules: Map<string, Module>;
  private options: AnalysisOptions;
  private dependencyGraph: DependencyGraph;
  private metrics?: CodeMetrics;

  constructor(options?: AnalysisOptions) {
    this.modules = new Map();
    this.options = {
      skipCommonDirs: true,
      respectGitignore: true,
      extensions: DEFAULT_EXTENSIONS,
      ...options,
    };
    this.dependencyGraph = new DependencyGraph();
  }

  /**
   * Analyze a codebase starting from rootPath
   * @param rootPath - Root directory to analyze
   * @returns AnalysisResult with all analyzed modules
   */
  async analyzeCodebase(rootPath: string): Promise<AnalysisResult> {
    const startTime = new Date();
    this.modules.clear();

    const absoluteRootPath = path.resolve(rootPath);

    // Verify root directory exists
    try {
      await fs.access(absoluteRootPath);
    } catch {
      throw new Error(`Root path does not exist: ${absoluteRootPath}`);
    }

    // Get list of files to analyze
    const filesToAnalyze = await this.getFilesToAnalyze(absoluteRootPath);

    // Parse and analyze each file
    const tsExtensions = new Set(
      this.options.extensions ?? DEFAULT_EXTENSIONS
    );
    let totalLOC = 0;
    for (const filePath of filesToAnalyze) {
      const ext = path.extname(filePath);
      const useTreeSitter =
        this.options.enableTreeSitter === true && !tsExtensions.has(ext);

      if (useTreeSitter) {
        // Tree-sitter path for non-JS/TS languages
        const tsResult = await parseFileTreeSitter(filePath);
        if (tsResult.success) {
          try {
            const relativePath = path.relative(absoluteRootPath, filePath);
            const locMetrics = extractTreeSitterMetrics(tsResult);
            totalLOC += locMetrics.totalLines;
            this.modules.set(filePath, {
              filePath,
              relativePath,
              extension: ext,
              ast: tsResult,
              dependencies: { imports: [], exports: [], reexports: [] },
              linesOfCode: locMetrics.codeLines,
            });
          } catch (error) {
            console.warn(
              `Failed to analyze ${filePath}:`,
              error instanceof Error ? error.message : String(error)
            );
          }
        }
      } else {
        // Babel path for JS/TS
        const parseResult = await parseFile(filePath);

        if (parseResult.success && parseResult.ast) {
          try {
            const relativePath = path.relative(absoluteRootPath, filePath);

            // Count lines of code
            const content = await fs.readFile(filePath, 'utf-8');
            const linesOfCode = content.split('\n').length;
            totalLOC += linesOfCode;

            // Extract dependencies
            const dependencies = extractDependencies(
              parseResult.ast,
              filePath
            );

            // Store module information
            this.modules.set(filePath, {
              filePath,
              relativePath,
              extension: ext,
              ast: parseResult.ast,
              dependencies,
              linesOfCode,
            });
          } catch (error) {
            // Log but continue on error
            console.warn(
              `Failed to analyze ${filePath}:`,
              error instanceof Error ? error.message : String(error)
            );
          }
        }
      }
    }

    // Build dependency graph
    this.buildDependencyGraph();

    // Calculate metrics
    await this.calculateMetrics();

    const endTime = new Date();

    return {
      rootPath: absoluteRootPath,
      modules: this.modules,
      fileCount: this.modules.size,
      totalLOC,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      metrics: this.metrics,
    };
  }

  /**
   * Get list of files to analyze using glob pattern
   * @param rootPath - Root directory
   * @returns Array of file paths to analyze
   */
  private async getFilesToAnalyze(rootPath: string): Promise<string[]> {
    // Build ignore patterns
    const ignorePatterns: string[] = [];

    if (this.options.skipCommonDirs) {
      ignorePatterns.push(
        '**/node_modules/**'
      );
      DEFAULT_SKIP_DIRS.forEach((skipDir) => {
        if (skipDir !== 'node_modules') {
          ignorePatterns.push(`**/${skipDir}/**`);
        }
      });
    }

    // Build extension patterns (Babel + optional Tree-sitter)
    const babelExts = this.options.extensions ?? DEFAULT_EXTENSIONS;
    const tsExts =
      this.options.enableTreeSitter === true
        ? (this.options.treeSitterExtensions ?? DEFAULT_TREE_SITTER_EXTENSIONS)
        : [];
    const allExts = [...babelExts, ...tsExts];
    const extensionPatterns = allExts.map((ext: string) => `**/*${ext}`);

    // Use glob to find files
    const files = await glob(extensionPatterns, {
      cwd: rootPath,
      ignore: ignorePatterns,
      absolute: true,
    });

    // Limit results if maxFiles specified
    if (this.options.maxFiles) {
      return files.slice(0, this.options.maxFiles);
    }

    return files;
  }

  /**
   * Get analyzed module by file path
   * @param filePath - Absolute file path
   * @returns Module or undefined
   */
  getModule(filePath: string): Module | undefined {
    return this.modules.get(filePath);
  }

  /**
   * Get all analyzed modules
   * @returns Map of file path to Module
   */
  getAllModules(): Map<string, Module> {
    return this.modules;
  }

  /**
   * Get modules that import from a specific module
   * @param modulePath - Module file path to search for
   * @returns Array of modules that import the specified module
   */
  getDependents(modulePath: string): Module[] {
    const dependents: Module[] = [];
    const normalizedPath = modulePath.replace(/\\/g, '/');

    for (const [, module] of this.modules) {
      for (const imp of module.dependencies.imports) {
        // Resolve import path relative to module location
        const fromDir = path.dirname(module.filePath);
        const possibleResolved = path.resolve(fromDir, imp.source).replace(/\\/g, '/');
        
        if (
          normalizedPath.includes(imp.source) ||
          normalizedPath === possibleResolved ||
          possibleResolved.includes(normalizedPath)
        ) {
          dependents.push(module);
          break;
        }
      }
    }

    return dependents;
  }

  /**
   * Build the dependency graph from analyzed modules
   */
  private buildDependencyGraph(): void {
    for (const [filePath, module] of this.modules) {
      for (const importInfo of module.dependencies.imports) {
        const resolvedPaths = resolveImportPath(importInfo.source, filePath);

        // Check if any resolved path matches a module in our codebase
        for (const resolvedPath of resolvedPaths) {
          if (this.modules.has(resolvedPath)) {
            this.dependencyGraph.addEdge(filePath, resolvedPath);
            break; // Found a match, no need to check other possibilities
          }
        }
      }
    }
  }

  /**
   * Calculate all code metrics
   */
  private async calculateMetrics(): Promise<void> {
    // Get ASTs for complexity calculation (Babel JS/TS only; skip Tree-sitter and null ASTs)
    const asts = new Map<string, BabelFile>();
    for (const [filePath, module] of this.modules) {
      if (isBabelFile(module.ast)) {
        asts.set(filePath, module.ast);
      }
    }
    // Only count LOC via filesystem reads for Babel files (tree-sitter LOC already counted)
    const babelFilePaths = Array.from(asts.keys());

    // Calculate all metrics
    const coupling = calculateCoupling(this.modules);
    const complexity = calculateComplexityMetrics(asts);
    const loc = await countLOCMetrics(babelFilePaths);

    this.metrics = {
      coupling,
      complexity,
      loc,
    };
  }

  /**
   * Get the dependency graph
   */
  getGraph(): DependencyGraph {
    return this.dependencyGraph;
  }

  /**
   * Get calculated metrics
   */
  getMetrics(): CodeMetrics | undefined {
    return this.metrics;
  }
}
