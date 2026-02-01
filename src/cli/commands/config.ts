/**
 * Config Command
 *
 * Show and manage project configuration
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { loadConfig, findProjectRoot } from '../../utils/config.js'

/**
 * Register config command
 */
export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Show project configuration')
    .option('--get <key>', 'Get a specific configuration value')
    .action(async (options) => {
      try {
        // Find project root
        const projectRoot = findProjectRoot()
        if (!projectRoot) {
          logger.error('Not in a Zeno project directory')
          process.exit(1)
        }

        const config = await loadConfig(projectRoot)

        if (options.get) {
          // Get specific key
          const keys = options.get.split('.')
          let value: any = config

          for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
              value = value[key]
            } else {
              logger.error(`Configuration key '${options.get}' not found`)
              process.exit(1)
            }
          }

          // For integration layer, return JSON
          if (process.env['ZENO_INTEGRATION'] === 'true') {
            console.log(JSON.stringify(value, null, 2))
          } else {
            logger.info(`${options.get}: ${JSON.stringify(value, null, 2)}`)
          }
        } else {
          // Show all config
          if (process.env['ZENO_INTEGRATION'] === 'true') {
            console.log(JSON.stringify(config, null, 2))
          } else {
            logger.info('Project Configuration')
            logger.info('=====================')
            logger.info(JSON.stringify(config, null, 2))
          }
        }
      } catch (error) {
        logger.error(`Failed to load configuration: ${error}`)
        process.exit(1)
      }
    })
}