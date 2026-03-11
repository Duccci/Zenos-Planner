/**
 * Zeno Configuration Management
 *
 * Provides schema-validated configuration for Zeno projects.
 * Configuration is stored in zeno/.zeno/config.json relative to project root.
 */

import { z } from 'zod'
import type { ComplexityThresholds } from '../generation/diagram-types.js'
import { dirname, join } from 'node:path'
import { readJsonFile, writeJsonFile, fileExists, directoryExists, normalizePath } from './file.js'
import { ConfigError } from './errors.js'

/**
 * Zeno project configuration schema.
 */
export const ZenoConfigSchema = z
  .object({
    /** Project name (human-readable) */
    projectName: z.string().min(1, 'Project name is required'),

    /** Project end state description */
    endState: z.string().optional(),

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

/** Project overview schema (single source of truth for project metadata) */
export const ProjectOverviewSchema = z.object({
  projectName: z.string(),
  projectVersion: z.string(),
  currentGate: z.string().nullable(),
  totalGatesPlanned: z.number(),
  endState: z.string(),
  startState: z.string().nullable(),
  completedGates: z.array(
    z.object({
      sequence: z.number(),
      name: z.string(),
      hash: z.string(),
      completedAt: z.string(),
      status: z.string().optional(),
    })
  ),
  currentGateInfo: z
    .object({
      sequence: z.number(),
      name: z.string(),
      hash: z.string(),
      estimatedComplexity: z.string(),
      status: z.string().optional(),
    })
    .nullable(),
  upcomingGates: z.array(
    z.object({
      sequence: z.number(),
      name: z.string(),
      estimatedComplexity: z.string(),
    })
  ),
  cancelledGates: z
    .array(
      z.object({
        sequence: z.number(),
        name: z.string(),
        hash: z.string().optional(),
        cancelledAt: z.string().optional(),
      })
    )
    .optional(),
  backlogGates: z
    .array(
      z.object({
        sequence: z.number(),
        name: z.string(),
        estimatedComplexity: z.string().optional(),
      })
    )
    .optional(),
  architecture: z.object({
    layers: z.array(z.string()),
    keyDependencies: z.record(z.string(), z.string()),
  }),
})

export type ProjectOverview = z.infer<typeof ProjectOverviewSchema>

/**
 * Unified gate summary derived from project-overview.json.
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
 * Get the path to the .zeno directory for a given project root.
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns Absolute path to .zeno directory
 */
export function getZenoDir(projectRoot: string = process.cwd()): string {
  return normalizePath(join(projectRoot, ZENO_DIR))
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

  // Traverse up until we either find a .zeno directory or reach the filesystem root.
  // Using dirname() termination (parent === currentDir) is cross-platform and handles
  // both Unix '/' roots and Windows drive roots (e.g. 'C:/') without platform detection.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const zenoDir = join(currentDir, ZENO_DIR)
    if (directoryExists(zenoDir)) {
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
export function getDefaultConfig(projectName: string, endState?: string): ZenoConfig {
  return {
    projectName,
    endState,
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
 * Get the path to the project-overview.json file.
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns Absolute path to project-overview.json
 */
export function getProjectOverviewPath(projectRoot: string = process.cwd()): string {
  return normalizePath(join(getZenoDir(projectRoot), 'project-overview.json'))
}

/**
 * Read project overview from zeno/.zeno/project-overview.json.
 * This is the single source of truth for project metadata.
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns Project overview data
 * @throws ConfigError if file doesn't exist or is invalid
 */
export async function readProjectOverview(
  projectRoot: string = process.cwd()
): Promise<ProjectOverview> {
  const overviewPath = getProjectOverviewPath(projectRoot)

  if (!fileExists(overviewPath)) {
    throw new ConfigError(
      `Project overview not found: ${overviewPath}`,
      'PROJECT_OVERVIEW_NOT_FOUND',
      { path: overviewPath }
    )
  }

  try {
    const data = await readJsonFile(overviewPath)

    const result = ProjectOverviewSchema.safeParse(data)
    if (!result.success) {
      throw new ConfigError('Invalid project overview format', 'PROJECT_OVERVIEW_INVALID', {
        errors: result.error.issues,
        path: overviewPath,
      })
    }

    return result.data
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error
    }
    throw new ConfigError(
      `Failed to read project overview: ${overviewPath}`,
      'PROJECT_OVERVIEW_READ_FAILED',
      { path: overviewPath },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Save project overview to zeno/.zeno/project-overview.json.
 * @param overview - Project overview data to save
 * @param projectRoot - Project root directory (default: process.cwd())
 * @throws ConfigError if save fails
 */
export async function saveProjectOverview(
  overview: ProjectOverview,
  projectRoot: string = process.cwd()
): Promise<void> {
  const overviewPath = getProjectOverviewPath(projectRoot)
  try {
    await writeJsonFile(overviewPath, overview)
  } catch (error) {
    throw new ConfigError(
      `Failed to save project overview: ${overviewPath}`,
      'PROJECT_OVERVIEW_WRITE_FAILED',
      { path: overviewPath },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Derive the full gate list from a ProjectOverview.
 * Returns completed, current (active/pending), and upcoming gates in sequence order.
 * Status is derived:
 *   - completedGates → 'completed'
 *   - currentGateInfo where overview.currentGate is set → 'in_progress'
 *   - currentGateInfo where overview.currentGate is null → 'pending'
 *   - upcomingGates → 'pending'
 */
export function getGatesFromOverview(overview: ProjectOverview): GateSummary[] {
  const gates: GateSummary[] = []

  for (const g of overview.completedGates) {
    gates.push({
      id: `gate-${g.sequence.toString().padStart(2, '0')}`,
      sequence: g.sequence,
      name: g.name,
      status: 'completed',
      hash: g.hash,
      completedAt: g.completedAt,
    })
  }

  for (const g of overview.cancelledGates ?? []) {
    gates.push({
      id: `gate-${g.sequence.toString().padStart(2, '0')}`,
      sequence: g.sequence,
      name: g.name,
      status: 'cancelled',
      hash: g.hash ?? '',
      completedAt: null,
    })
  }

  for (const g of overview.backlogGates ?? []) {
    gates.push({
      id: `gate-${g.sequence.toString().padStart(2, '0')}`,
      sequence: g.sequence,
      name: g.name,
      status: 'backlog',
      hash: '',
      completedAt: null,
      estimatedComplexity: g.estimatedComplexity,
    })
  }

  if (overview.currentGateInfo) {
    const isActive = overview.currentGate !== null
    const gateId =
      overview.currentGate ??
      `gate-${overview.currentGateInfo.sequence.toString().padStart(2, '0')}`
    gates.push({
      id: gateId,
      sequence: overview.currentGateInfo.sequence,
      name: overview.currentGateInfo.name,
      status: isActive ? 'in_progress' : 'pending',
      hash: overview.currentGateInfo.hash,
      completedAt: null,
      estimatedComplexity: overview.currentGateInfo.estimatedComplexity,
    })
  }

  for (const g of overview.upcomingGates) {
    gates.push({
      id: `gate-${g.sequence.toString().padStart(2, '0')}`,
      sequence: g.sequence,
      name: g.name,
      status: 'pending',
      hash: '',
      completedAt: null,
      estimatedComplexity: g.estimatedComplexity,
    })
  }

  return gates.sort((a, b) => a.sequence - b.sequence)
}
