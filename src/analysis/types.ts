/**
 * Type definitions for code analysis module
 * Provides interfaces for AST parsing, module analysis, and dependency tracking
 */

import type { File as BabelFile } from '@babel/types';

/**
 * Language parser backend selector
 */
export type LanguageBackend = 'babel' | 'tree-sitter';

/**
 * Result of parsing a file with Tree-sitter
 */
export interface TreeSitterParseResult {
  /** Absolute file path */
  filePath: string;
  /** Detected language (e.g. 'python', 'rust', 'go', 'cpp') */
  language: string;
  /** Total node count in the CST */
  nodeCount: number;
  /** Root CST node (tree-sitter SyntaxNode); typed as unknown since tree-sitter is optional */
  rootNode: unknown;
  /** Parsing succeeded */
  success: boolean;
  /** Error message if parse failed */
  error?: string;
  /** Source text; present on successful parse, used by metrics extraction */
  source?: string;
}

/**
 * Result of parsing a single file
 */
export interface ParseResult {
  /** Absolute file path */
  filePath: string;
  /** Parsed AST, or null if parse failed */
  ast: BabelFile | null;
  /** Error message if parse failed */
  error?: string;
  /** Parsing succeeded */
  success: boolean;
}

/**
 * Import/export dependency information
 */
export interface DependencyInfo {
  /** Imported/exported identifier names */
  names: string[];
  /** Import source path (relative or absolute) */
  source: string;
  /** Is this a default import/export */
  isDefault: boolean;
  /** Is this a dynamic import */
  isDynamic: boolean;
}

/**
 * All dependencies (imports/exports) from a module
 */
export interface Dependencies {
  /** List of imports with sources and names */
  imports: DependencyInfo[];
  /** List of exports with names */
  exports: string[];
  /** Re-exports (export from X) */
  reexports: DependencyInfo[];
}

/**
 * Analyzed module with all dependency information
 */
export interface Module {
  /** Absolute file path */
  filePath: string;
  /** Relative path from root */
  relativePath: string;
  /** File extension (.ts, .js, etc) */
  extension: string;
  /** Parsed AST — Babel AST for JS/TS files; TreeSitterParseResult for other languages; null if unknown */
  ast: BabelFile | TreeSitterParseResult | null;
  /** All dependencies in this module */
  dependencies: Dependencies;
  /** Number of lines of code */
  linesOfCode: number;
}

/**
 * Result of analyzing a complete codebase
 */
export interface AnalysisResult {
  /** Root directory analyzed */
  rootPath: string;
  /** All analyzed modules by file path */
  modules: Map<string, Module>;
  /** Total files analyzed */
  fileCount: number;
  /** Total lines of code */
  totalLOC: number;
  /** Analysis start time */
  startTime: Date;
  /** Analysis end time */
  endTime: Date;
  /** Analysis duration in milliseconds */
  duration: number;
  /** Code metrics (coupling, complexity, LOC) */
  metrics?: CodeMetrics;
}

/**
 * Options for code analysis
 */
export interface AnalysisOptions {
  /** Skip node_modules and other common build directories */
  skipCommonDirs?: boolean;
  /** Respect .gitignore file */
  respectGitignore?: boolean;
  /** File extensions to include for Babel (default: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']) */
  extensions?: string[];
  /** Maximum files to analyze (for testing) */
  maxFiles?: number;
  /** Enable Tree-sitter backend for non-JS/TS languages (default: false) */
  enableTreeSitter?: boolean;
  /** File extensions handled by Tree-sitter (default: ['.py', '.rs', '.go', '.cpp', '.c', '.h']) */
  treeSitterExtensions?: string[];
}

/**
 * Coupling metrics for a single module
 */
export interface ModuleCoupling {
  /** Absolute file path */
  filePath: string;
  /** Number of modules that depend on this module (incoming) */
  afferent: number;
  /** Number of modules this module depends on (outgoing) */
  efferent: number;
  /** Instability metric: efferent / (efferent + afferent) */
  instability: number;
}

/**
 * Coupling metrics for the entire codebase
 */
export interface CouplingMetrics {
  /** Coupling data for each module */
  modules: Map<string, ModuleCoupling>;
  /** Average instability across all modules */
  averageInstability: number;
  /** Modules with high coupling ratios */
  highCoupling: ModuleCoupling[];
}

/**
 * Complexity metrics for a single function/method
 */
export interface FunctionComplexity {
  /** Function name */
  name: string;
  /** Cyclomatic complexity score */
  complexity: number;
  /** Start line number */
  startLine: number;
  /** End line number */
  endLine: number;
}

/**
 * Complexity metrics for a single module
 */
export interface ModuleComplexity {
  /** Absolute file path */
  filePath: string;
  /** Complexity per function */
  functions: FunctionComplexity[];
  /** Maximum complexity in this module */
  maxComplexity: number;
  /** Average complexity in this module */
  averageComplexity: number;
}

/**
 * Complexity metrics for the entire codebase
 */
export interface ComplexityMetrics {
  /** Complexity data for each module */
  modules: Map<string, ModuleComplexity>;
  /** Overall maximum complexity */
  maxComplexity: number;
  /** Overall average complexity */
  averageComplexity: number;
}

/**
 * Lines of code metrics for a single file
 */
export interface LineMetrics {
  /** Absolute file path */
  filePath: string;
  /** Total lines in file */
  totalLines: number;
  /** Lines with code (non-blank, non-comment) */
  codeLines: number;
  /** Blank lines */
  blankLines: number;
  /** Comment lines */
  commentLines: number;
}

/**
 * Lines of code metrics for the entire codebase
 */
export interface LOCMetrics {
  /** LOC data for each file */
  files: Map<string, LineMetrics>;
  /** Total lines across all files */
  totalLines: number;
  /** Total code lines */
  totalCodeLines: number;
  /** Total blank lines */
  totalBlankLines: number;
  /** Total comment lines */
  totalCommentLines: number;
}

/**
 * All metrics combined
 */
export interface CodeMetrics {
  /** Coupling metrics */
  coupling: CouplingMetrics;
  /** Complexity metrics */
  complexity: ComplexityMetrics;
  /** Lines of code metrics */
  loc: LOCMetrics;
}
