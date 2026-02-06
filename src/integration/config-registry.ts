/**
 * Configuration Operations Registry
 *
 * Registers all configuration-related operations with the function registry.
 * Handles: config_get
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { loadConfig } from '../utils/config.js'

export function registerConfigOps(registry: FunctionRegistry): void {
  registry.register('config_get', async () => {
    const result = await loadConfig()
    return result
  }, {
    description: 'Get project configuration values',
    parameters: [],
    returnType: 'ZenoConfig',
    schema: z.object({})
  })
}
