/**
 * Zeno Configuration Management
 *
 * Provides schema-validated configuration for Zeno projects.
 * Configuration is stored in zeno/.zeno/config.json relative to project root.
 */

import { z } from 'zod'
import type { ComplexityThresholds } from '../generation/diagram-types.js'
import { dirname, join } from 'node:path'
import { readJsonFile, writeJsonFile, fileExists, normalizePath } from './file.js'
import { ConfigError } from './errors.js'

/**
 * Zeno project configuration schema.
 */
export const ZenoConfigSchema = z
  .object({
    /** Project name (human-readable) */
    projectName: z.string().min(1, 'Project name is required'),

    /** Project statement describing what is being built */
    projectStatement: z.string().optional(),

    /** Project version (semver format) */
    version: z.string().default('0.1.0'),

    /** Quality thresholds (non-configurable in MVP, but stored for transparency) */
    qualityThresholds: z
      .object({
        codeCoverage: z.number().min(0).max(100).default(90),
        securityVulnerabilities: z.number().min(0).default(0),
        lintingErrorRate: z.number().min(0).default(0.01),
        typeCheckingErrors: z.number().min(0).default(0),
      })
      .default({
        codeCoverage: 90,
        securityVulnerabilities: 0,
        lintingErrorRate: 0.01,
        typeCheckingErrors: 0,
      }),

    /** Hash algorithm used for internal registry */
    hashAlgorithm: z.string().default('sha256'),

    /** Hash length (number of chars stored/displayed) */
    hashLength: z.number().int().positive().default(16),

    /** Git integration settings */
    git: z
      .object({
        autoCommit: z.boolean().default(true),
        autoTag: z.boolean().default(true),
        autoPush: z.boolean().default(false),
        remote: z.string().default('origin'),
        commitFormat: z.string().default('feat(%s): %m'),
      })
      .optional(),

    /** Project versioning settings (major/minor/patch mapping) */
    versioning: z
      .object({
        /** When false, completion hooks do not bump version */
        enabled: z.boolean().default(true),

        /** Which semver component to bump when a proposal is completed */
        proposalBump: z.enum(['patch', 'minor', 'major']).default('patch'),

        /** Which semver component to bump when a gate is completed (non-final) */
        gateBump: z.enum(['patch', 'minor', 'major']).default('minor'),

        /** Which semver component to bump when full lifecycle completes */
        lifecycleBump: z.enum(['patch', 'minor', 'major']).default('major'),
      })
      .default({
        enabled: true,
        proposalBump: 'patch',
        gateBump: 'minor',
        lifecycleBump: 'major',
      }),

    /**
     * Workflow mode controlling approval behaviour.
     * - 'solo': `zeno proposal approve` skips the interactive prompt; quality gates still enforced.
     * - 'team': explicit human confirmation required in addition to quality gates.
     * Defaults to 'solo' for backward compatibility with configs created before this field existed.
     */
    workflowMode: z.enum(['solo', 'team']).default('solo'),

    /** Architecture generation settings */
    architecture: z
      .object({
        complexity: z
          .object({
            maxMermaidNodes: z.number().int().min(0).default(5),
            maxMermaidEdges: z.number().int().min(0).default(8),
            nestingDepthMultiplier: z.number().min(0).default(2),
            svgCollapseThresholdBytes: z.number().int().min(0).default(50000),
          })
          .default({
            maxMermaidNodes: 5,
            maxMermaidEdges: 8,
            nestingDepthMultiplier: 2,
            svgCollapseThresholdBytes: 50000,
          }),
      })
      .optional(),

    /** AI CLI settings for agent invocation (task-distributor and similar sub-agent calls) */
    ai: z
      .object({
        /**
         * Which CLI tool to use when invoking agents as MCP sub-agents.
         * - 'copilot': GitHub Copilot CLI (default) — must use invocationMode 'acp'
         * - 'claude': Anthropic Claude CLI — uses non-interactive -p flag in 'cli' mode
         */
        cli: z.enum(['copilot', 'claude']).default('copilot'),

        /**
         * How to invoke the CLI.
         * - 'cli': one-shot subprocess via execSync with --prompt / --message flag (default)
         * - 'acp': Agent Client Protocol over stdio (spawn + NDJSON); only supported for 'copilot'
         *   Command: copilot [--model <model>] --acp --stdio
         */
        invocationMode: z.enum(['cli', 'acp']).default('cli'),

        /** Model override for the selected CLI tool. Uses the CLI's default model when unset. */
        model: z.string().optional(),
      })
      .default({ cli: 'copilot', invocationMode: 'cli' }),
  })
  .loose()

/** TypeScript type inferred from schema */
export type ZenoConfig = z.infer<typeof ZenoConfigSchema>

/** Unified gate entry schema — all gates in one array, status is the discriminator */
export const ProjectGateSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  name: z.string(),
  hash: z.string(),
  status: z.enum(['pending', 'validated', 'in_progress', 'completed', 'cancelled', 'backlog']),
  /** Delivery milestone labels parsed from the gate .md frontmatter (e.g. ['MVP', 'Post-MVP']). */
  milestones: z.array(z.union([z.number(), z.string()])).optional(),
  createdAt: z.string(),
  completedAt: z.string().nullable().default(null),
  cancelledAt: z.string().nullable().optional(),
  // Brief project-level statement — detail lives in the gate .md
  goal: z.string().optional(),
  prdGenerated: z.boolean().optional(),
  estimatedComplexity: z.string().optional(),
})

export type ProjectGate = z.infer<typeof ProjectGateSchema>

/**
 * Consolidated project schema — single source of truth.
 * File: zeno/.zeno/project.json
 */
export const ProjectSchema = z.object({
  project: z.object({
    name: z.string(),
    version: z.string(),
    projectStatement: z.string(),
    totalGatesPlanned: z.number(),
    gitHistory: z
      .object({
        repository: z.string(),
        remote: z.string(),
        branch: z.string(),
      })
      .optional(),
  }),
  /** All gates in a single array — query by status instead of separate arrays */
  gates: z.array(ProjectGateSchema),
  lastUpdated: z.string(),
  status: z.enum(['gate_in_progress', 'gate_completed', 'awaiting_review']),
})

export type Project = z.infer<typeof ProjectSchema>

/** Backwards-compat alias */
export type ProjectOverview = Project

// ─── Project query helpers ────────────────────────────────────────────────────

/** ID of the currently in-progress gate, or null */
export function getCurrentGateId(project: Project): string | null {
  return project.gates.find((g) => g.status === 'in_progress')?.id ?? null
}

/** All completed gates sorted by sequence */
export function getCompletedGates(project: Project): ProjectGate[] {
  return project.gates
    .filter((g) => g.status === 'completed')
    .sort((a, b) => a.sequence - b.sequence)
}

/** All upcoming (pending/validated) gates sorted by sequence */
export function getUpcomingGates(project: Project): ProjectGate[] {
  return project.gates
    .filter((g) => g.status === 'pending' || g.status === 'validated')
    .sort((a, b) => a.sequence - b.sequence)
}

/** Find a gate by its ID */
export function getGateById(project: Project, id: string): ProjectGate | undefined {
  return project.gates.find((g) => g.id === id)
}

/**
 * Unified gate summary derived from project.json.
 * Provides a consistent view regardless of gate lifecycle stage.
 */
export interface GateSummary {
  id: string
  sequence: number
  name: string
  /** Derived: 'completed' | 'in_progress' | 'validated' | 'pending' | 'cancelled' | 'backlog' */
  status: 'completed' | 'in_progress' | 'validated' | 'pending' | 'cancelled' | 'backlog'
  hash: string
  completedAt: string | null
  estimatedComplexity?: string
}

/** Zeno directory name */
const ZENO_DIR = join('zeno', '.zeno')

/** Config file name */
const CONFIG_FILE = 'config.json'

/**
 * Resolve the active workspace root.
 *
 * Precedence: ZENO_WORKSPACE env var → process.cwd()
 *
 * Use this instead of a bare `process.cwd()` anywhere a registry or tool
 * needs to locate user-project files (gates, proposals, requirements, etc.)
 * so that the MCP server correctly targets the configured workspace when
 * ZENO_WORKSPACE is set by the editor/client.
 */
export function getWorkspaceRoot(): string {
  return process.env['ZENO_WORKSPACE'] ?? process.cwd()
}

/**
 * Get the path to the .zeno directory for a given project root.
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns Absolute path to .zeno directory
 */
export function getZenoDir(projectRoot: string = process.cwd()): string {
  return normalizePath(join(projectRoot, ZENO_DIR))
}

/**
 * Get the git working directory root for the zeno submodule.
 * When zeno is used as a git submodule, git operations must run from the
 * submodule root (i.e. the 'zeno' directory), not the parent project root.
 * @param projectRoot - Parent project root directory (default: process.cwd())
 * @returns Absolute path to the zeno submodule root
 */
export function getZenoGitDir(projectRoot: string = process.cwd(), _config?: ZenoConfig): string {
  return normalizePath(join(projectRoot, 'zeno'))
}

/**
 * Get the path to the config.json file.
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns Absolute path to config.json
 */
export function getConfigPath(projectRoot: string = process.cwd()): string {
  return normalizePath(join(getZenoDir(projectRoot), CONFIG_FILE))
}

/**
 * Find the Zeno project root by traversing up from the given directory.
 * Looks for a .zeno directory to identify the project root.
 * @param startDir - Directory to start searching from (default: process.cwd())
 * @returns Absolute path to project root, or null if not found
 */
export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let currentDir = normalizePath(startDir)

  // Traverse up until we find a genuine Zeno project root or reach the filesystem root.
  // We verify by checking for the config.json file (not just the directory) to avoid
  // false positives from empty or spurious zeno/.zeno directories.
  // Using dirname() termination (parent === currentDir) is cross-platform and handles
  // both Unix '/' roots and Windows drive roots (e.g. 'C:/') without platform detection.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const configFile = join(currentDir, ZENO_DIR, CONFIG_FILE)
    if (fileExists(configFile)) {
      return currentDir
    }
    const parent = normalizePath(dirname(currentDir))
    if (parent === currentDir) break // reached filesystem root
    currentDir = parent
  }

  return null
}

/**
 * Get default configuration for a new project.
 * Note: This schema intentionally matches zeno/.zeno/config.json and does not
 * require an end state string (that data lives in PRDs / DB in later gates).
 */
export function getDefaultConfig(projectName: string, projectStatement?: string): ZenoConfig {
  return {
    projectName,
    projectStatement,
    version: '0.1.0',
    qualityThresholds: {
      codeCoverage: 90,
      securityVulnerabilities: 0,
      lintingErrorRate: 0.01,
      typeCheckingErrors: 0,
    },
    hashAlgorithm: 'sha256',
    hashLength: 16,
    git: {
      autoCommit: true,
      autoTag: true,
      autoPush: false,
      remote: 'origin',
      commitFormat: 'feat(%s): %m',
    },
    versioning: {
      enabled: true,
      proposalBump: 'patch',
      gateBump: 'minor',
      lifecycleBump: 'major',
    },
    workflowMode: 'solo',
    architecture: {
      complexity: {
        maxMermaidNodes: 5,
        maxMermaidEdges: 8,
        nestingDepthMultiplier: 2,
        svgCollapseThresholdBytes: 50000,
      },
    },
    ai: {
      cli: 'copilot',
      invocationMode: 'acp',
    },
  }
}

/**
 * Build an empty Project object suitable for writing to zeno/.zeno/project.json on init.
 */
export function getDefaultProject(projectName: string, projectStatement: string): Project {
  return {
    project: {
      name: projectName,
      version: '0.1.0',
      projectStatement,
      totalGatesPlanned: 0,
    },
    gates: [],
    lastUpdated: new Date().toISOString(),
    status: 'awaiting_review',
  }
}

/**
 * Load configuration from zeno/.zeno/config.json.
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns Validated ZenoConfig
 * @throws ConfigError if config is invalid
 */
export async function loadConfig(projectRoot: string = process.cwd()): Promise<ZenoConfig> {
  const configPath = getConfigPath(projectRoot)

  if (!fileExists(configPath)) {
    throw new ConfigError(`Configuration file not found: ${configPath}`, 'CONFIG_NOT_FOUND', {
      path: configPath,
    })
  }

  try {
    return await readJsonFile(configPath, ZenoConfigSchema)
  } catch (error) {
    if (error instanceof ConfigError) throw error
    throw new ConfigError(
      `Failed to load configuration: ${configPath}`,
      'CONFIG_LOAD_FAILED',
      { path: configPath },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Save configuration to zeno/.zeno/config.json.
 * Validates config before saving.
 * @param config - Configuration to save
 * @param projectRoot - Project root directory (default: process.cwd())
 * @throws ConfigError if config is invalid or save fails
 */
export async function saveConfig(
  config: ZenoConfig,
  projectRoot: string = process.cwd()
): Promise<void> {
  const configPath = getConfigPath(projectRoot)

  // Validate before saving
  const result = ZenoConfigSchema.safeParse(config)
  if (!result.success) {
    throw new ConfigError('Invalid configuration', 'CONFIG_VALIDATION_FAILED', {
      errors: result.error.issues,
    })
  }

  try {
    await writeJsonFile(configPath, result.data)
  } catch (error) {
    throw new ConfigError(
      `Failed to save configuration: ${configPath}`,
      'CONFIG_SAVE_FAILED',
      { path: configPath },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Get complexity thresholds merged with defaults.
 * Falls back to hard-coded defaults when configuration is absent or invalid.
 */
export async function getComplexityThresholds(
  projectRoot: string = process.cwd()
): Promise<ComplexityThresholds> {
  const defaults: ComplexityThresholds = {
    maxMermaidNodes: 5,
    maxMermaidEdges: 8,
    nestingDepthMultiplier: 2,
    svgCollapseThresholdBytes: 50000,
  }

  try {
    const cfg = await loadConfig(projectRoot)
    const complexity = cfg.architecture?.complexity

    return {
      maxMermaidNodes: complexity?.maxMermaidNodes ?? defaults.maxMermaidNodes,
      maxMermaidEdges: complexity?.maxMermaidEdges ?? defaults.maxMermaidEdges,
      nestingDepthMultiplier: complexity?.nestingDepthMultiplier ?? defaults.nestingDepthMultiplier,
      svgCollapseThresholdBytes:
        complexity?.svgCollapseThresholdBytes ?? defaults.svgCollapseThresholdBytes,
    }
  } catch {
    return defaults
  }
}

/**
 * Check if a Zeno project exists at the given root.
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns true if zeno/.zeno/config.json exists
 */
export function isZenoProject(projectRoot: string = process.cwd()): boolean {
  return fileExists(getConfigPath(projectRoot))
}

/**
 * Get the path to the project.json file.
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns Absolute path to project.json
 */
export function getProjectPath(projectRoot: string = process.cwd()): string {
  return normalizePath(join(getZenoDir(projectRoot), 'project.json'))
}

/** Backwards-compat alias */
export const getProjectOverviewPath = getProjectPath

/**
 * Read project from zeno/.zeno/project.json — the single source of truth.
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns Project data
 * @throws ConfigError if file doesn't exist or is invalid
 */
export async function readProject(
  projectRoot: string = process.cwd()
): Promise<Project> {
  const projectPath = getProjectPath(projectRoot)

  if (!fileExists(projectPath)) {
    throw new ConfigError(
      `Project overview not found: ${projectPath}`,
      'PROJECT_OVERVIEW_NOT_FOUND',
      { path: projectPath }
    )
  }

  try {
    const data = await readJsonFile(projectPath)

    const result = ProjectSchema.safeParse(data)
    if (!result.success) {
      throw new ConfigError('Invalid project overview format', 'PROJECT_OVERVIEW_INVALID', {
        errors: result.error.issues,
        path: projectPath,
      })
    }

    return result.data
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error
    }
    throw new ConfigError(
      `Failed to read project overview: ${projectPath}`,
      'PROJECT_OVERVIEW_READ_FAILED',
      { path: projectPath },
      error instanceof Error ? error : undefined
    )
  }
}

/** Backwards-compat alias */
export const readProjectOverview = readProject

/**
 * Save project to zeno/.zeno/project.json.
 * @param project - Project data to save
 * @param projectRoot - Project root directory (default: process.cwd())
 * @throws ConfigError if save fails
 */
export async function saveProject(
  project: Project,
  projectRoot: string = process.cwd()
): Promise<void> {
  const projectPath = getProjectPath(projectRoot)
  try {
    await writeJsonFile(projectPath, project)
  } catch (error) {
    throw new ConfigError(
      `Failed to save project overview: ${projectPath}`,
      'PROJECT_OVERVIEW_WRITE_FAILED',
      { path: projectPath },
      error instanceof Error ? error : undefined
    )
  }
}

/** Backwards-compat alias */
export const saveProjectOverview = saveProject

/**
 * Derive the full gate list from a Project.
 * Returns all gates sorted by sequence, preserving their status.
 */
export function getGatesFromProject(project: Project): GateSummary[] {
  return project.gates
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((g) => ({
      id: g.id,
      sequence: g.sequence,
      name: g.name,
      status: g.status,
      hash: g.hash,
      completedAt: g.completedAt ?? null,
      estimatedComplexity: g.estimatedComplexity,
    }))
}

/** Backwards-compat alias */
export const getGatesFromOverview = getGatesFromProject
