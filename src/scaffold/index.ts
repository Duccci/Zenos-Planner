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

/**
 * Create the complete .zeno directory structure
 */
export async function createProjectStructure(projectRoot: string = process.cwd()): Promise<string[]> {
  const createdPaths: string[] = []

  try {
    // Define directory structure
    const directories = [
      'zeno',
      'zeno/.zeno',
      'zeno/gates',
      'zeno/architecture',
      'zeno/proposals',
      'zeno/proposals/active',
      'zeno/proposals/completed',
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
          
          const initResult = await initializeDatabase(projectRoot)
          if (initResult.created) {
            createdPaths.push('zeno/.zeno/requirements.db')
            logger.debug(`Database initialized: ${String(initResult.migrationsApplied)} migrations applied`)
          }
        } else {
          logger.debug('Migrations directory not found, database will be initialized on first use')
        }
      } catch (error) {
        logger.warn(`Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`)
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
