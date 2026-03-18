/**
 * Project Scaffolding
 *
 * Creates the complete zeno/.zeno directory layout and initializes project structure.
 */

import { join } from 'node:path'
import { basename } from 'node:path'
import { ensureDir, writeJsonFile, fileExists, directoryExists } from '../utils/file.js'
import { FileSystemError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import { getDefaultConfig } from '../utils/config.js'
import { initializeDatabase, getDatabasePath, closeDatabase } from '../storage/database.js'
import { isZenoSubmodule } from '../utils/git.js'

/**
 * Create the complete .zeno directory structure
 */
export async function createProjectStructure(
  projectRoot: string = process.cwd()
): Promise<string[]> {
  const createdPaths: string[] = []

  // Last-resort guard: if projectRoot is itself named 'zeno' or '.zeno' then
  // every relative directory we create (e.g. 'zeno/.zeno') would end up nested
  // as zeno/zeno/.zeno.  Callers are responsible for passing the project root
  // (the parent of the intended zeno/ directory), but we fail fast here rather
  // than silently producing a corrupt directory tree.
  if (basename(projectRoot) === 'zeno' || basename(projectRoot) === '.zeno') {
    throw new FileSystemError(
      `createProjectStructure received a path that appears to be the zeno/ planning ` +
      `directory itself: "${projectRoot}". Pass the project root (the parent directory) instead.`
    )
  }

  try {
    // When zeno/ is a git submodule the directory already exists (mounted by git);
    // we must not recreate it or we would overwrite the submodule mount.
    const zenoIsSubmodule = isZenoSubmodule(projectRoot)
    if (zenoIsSubmodule) {
      logger.info('zeno/ is a git submodule — skipping top-level directory creation')
    }

    // Define directory structure
    const directories = [
      ...(zenoIsSubmodule ? [] : ['zeno']),
      'zeno/.zeno',
      'zeno/gates',
      'zeno/architecture',
      'zeno/overview',
      'zeno/proposals',
      'zeno/requirements',
      'zeno/subprojects',
    ]

    // Create all directories
    for (const dir of directories) {
      const fullPath = join(projectRoot, dir)
      if (!fileExists(fullPath)) {
        await ensureDir(fullPath)
        createdPaths.push(dir)
        logger.debug(`Created directory: ${dir}`)
      } else {
        logger.debug(`Directory already exists: ${dir}`)
      }
    }

    // Create initial config.json if it doesn't exist
    const configPath = join(projectRoot, 'zeno', '.zeno', 'config.json')
    if (!fileExists(configPath)) {
      const inferredName = basename(projectRoot) || 'Unnamed Project'
      const defaultConfig = getDefaultConfig(inferredName)
      await writeJsonFile(configPath, defaultConfig)
      createdPaths.push('zeno/.zeno/config.json')
      logger.debug('Created initial config.json')
    } else {
      logger.debug('Config.json already exists, skipping')
    }

    // Initialize SQLite database if it doesn't exist
    // Note: Database initialization requires migrations to be available in projectRoot/src/storage/migrations
    // If migrations are not available (e.g., in test environments), database will be created on first use
    const dbPath = getDatabasePath(projectRoot)
    if (!fileExists(dbPath)) {
      try {
        // Check if migrations directory exists before attempting initialization
        const migrationsDir = join(projectRoot, 'src', 'storage', 'migrations')
        if (directoryExists(migrationsDir)) {
          // Close any existing database connection to avoid singleton issues
          try {
            closeDatabase()
          } catch {
            // Ignore errors when closing (database might not be open)
          }

          const initResult = await initializeDatabase(projectRoot, { syncProposals: true, syncRequirements: true })
          if (initResult.created) {
            createdPaths.push('zeno/.zeno/registry.db')
            logger.debug(
              `Database initialized: ${String(initResult.migrationsApplied)} migrations applied`
            )
          }
        } else {
          logger.debug('Migrations directory not found, database will be initialized on first use')
        }
      } catch (error) {
        logger.warn(
          `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`
        )
        // Don't fail scaffolding if database init fails - it can be initialized later
      }
    } else {
      logger.debug('Database already exists, skipping initialization')
    }

    return createdPaths
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error
    }
    throw new FileSystemError(
      `Failed to create project structure: ${String(error)}`,
      'FS_SCAFFOLD_FAILED',
      { projectRoot, cause: error }
    )
  }
}

/**
 * Create a gate-specific proposal directory if it doesn't exist
 */
export async function createGateDirectory(
  projectRoot: string = process.cwd(),
  gateId: string
): Promise<string | null> {
  const normalizedGateId = gateId.startsWith('gate-') ? gateId : `gate-${gateId.padStart(2, '0')}`
  const gateDir = join(projectRoot, 'zeno', 'proposals', normalizedGateId)

  if (!fileExists(gateDir)) {
    await ensureDir(gateDir)
    logger.debug(`Created gate directory: ${normalizedGateId}`)
    return normalizedGateId
  }

  return null
}
