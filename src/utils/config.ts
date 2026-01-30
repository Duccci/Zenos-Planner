/**
 * Zeno Configuration Management
 *
 * Provides schema-validated configuration for Zeno projects.
 * Configuration is stored in zeno/.zeno/config.json relative to project root.
 */

import { z } from 'zod'
import { dirname, join } from 'node:path'
import { readJsonFile, writeJsonFile, fileExists, directoryExists, normalizePath } from './file.js'
import { ConfigError } from './errors.js'

/**
 * Zeno project configuration schema.
 */
export const ZenoConfigSchema = z.object({
  /** Project name (human-readable) */
  projectName: z.string().min(1, 'Project name is required'),

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
}).loose()

/** TypeScript type inferred from schema */
export type ZenoConfig = z.infer<typeof ZenoConfigSchema>

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
  const rootDrive = currentDir.split('/')[0]
  const root = process.platform === 'win32' ? (rootDrive ? `${rootDrive}/` : '/') : '/'

  while (currentDir !== root) {
    const zenoDir = join(currentDir, ZENO_DIR)
    if (directoryExists(zenoDir)) {
      return currentDir
    }
    const parent = dirname(currentDir)
    if (parent === currentDir) break
    currentDir = parent
  }

  // Check root directory
  if (directoryExists(join(root, ZENO_DIR))) {
    return root
  }

  return null
}

/**
 * Get default configuration for a new project.
 * Note: This schema intentionally matches zeno/.zeno/config.json and does not
 * require an end state string (that data lives in PRDs / DB in later gates).
 */
export function getDefaultConfig(projectName: string): ZenoConfig {
  return {
    projectName,
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
    },
    versioning: {
      enabled: true,
      proposalBump: 'patch',
      gateBump: 'minor',
      lifecycleBump: 'major',
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
    throw new ConfigError(
      `Configuration file not found: ${configPath}`,
      'CONFIG_NOT_FOUND',
      { path: configPath }
    )
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
export async function saveConfig(config: ZenoConfig, projectRoot: string = process.cwd()): Promise<void> {
  const configPath = getConfigPath(projectRoot)

  // Validate before saving
  const result = ZenoConfigSchema.safeParse(config)
  if (!result.success) {
    throw new ConfigError(
      'Invalid configuration',
      'CONFIG_VALIDATION_FAILED',
      { errors: result.error.issues }
    )
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
 * Check if a Zeno project exists at the given root.
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns true if zeno/.zeno/config.json exists
 */
export function isZenoProject(projectRoot: string = process.cwd()): boolean {
  return fileExists(getConfigPath(projectRoot))
}

