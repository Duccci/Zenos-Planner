/**
 * Configuration Operations Registry
 *
 * Registers all configuration-related operations with the function registry.
 * Handles: config_get
 */

/**
 * Configuration Operations Registry
 *
 * Registers all configuration-related operations with the function registry.
 * Handles: config_get
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { loadConfig, getDefaultConfig, findProjectRoot, getWorkspaceRoot } from '../utils/config.js'
import { ConfigError } from '../utils/errors.js'

/**
 * Register configuration operations with the function registry.
 * config_get returns project configuration or sensible defaults if config is missing.
 */
export function registerConfigOps(registry: FunctionRegistry): void {
  registry.register(
    'config_get',
    async () => {
      try {
        const wsRoot = getWorkspaceRoot()
        const projectRoot = findProjectRoot(wsRoot) ?? wsRoot
        const result = await loadConfig(projectRoot)
        return result
      } catch (error) {
        // Handle missing config gracefully by returning defaults
        if (error instanceof ConfigError && error.code === 'CONFIG_NOT_FOUND') {
          return getDefaultConfig('Unknown Project', 'No end state defined')
        }
        // Re-throw other errors (validation failures, file system errors)
        throw error
      }
    },
    {
      description: 'Get project configuration including quality thresholds, git settings, and version',
      parameters: [],
      returnType: 'ZenoConfig',
      schema: z.object({}),
    }
  )
}
