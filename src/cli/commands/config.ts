/**
 * Config Command
 *
 * Show and manage project configuration
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { loadConfig, saveConfig, findProjectRoot } from '../../utils/config.js'

/**
 * Register config command
 */
export function registerConfigCommand(program: Command): void {
  const configCmd = program.command('config').description('Show and manage project configuration')

  configCmd
    .command('show')
    .description('Show project configuration')
    .option('--get <key>', 'Get a specific configuration value')
    .action(async (options: { get?: string }) => {
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
          let value: unknown = config

          for (const key of keys) {
            if (value && typeof value === 'object' && key in (value as Record<string, unknown>)) {
              value = (value as Record<string, unknown>)[key]
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
        logger.error('Failed to load configuration', error instanceof Error ? error : undefined)
        process.exit(1)
      }
    })

  // Keep backward compat: calling `zeno config` with no sub-command shows config
  configCmd
    .option('--get <key>', 'Get a specific configuration value')
    .action(async (options: { get?: string }) => {
      try {
        const projectRoot = findProjectRoot()
        if (!projectRoot) {
          logger.error('Not in a Zeno project directory')
          process.exit(1)
        }

        const config = await loadConfig(projectRoot)

        if (options.get) {
          const keys = options.get.split('.')
          let value: unknown = config

          for (const key of keys) {
            if (value && typeof value === 'object' && key in (value as Record<string, unknown>)) {
              value = (value as Record<string, unknown>)[key]
            } else {
              logger.error(`Configuration key '${options.get}' not found`)
              process.exit(1)
            }
          }

          if (process.env['ZENO_INTEGRATION'] === 'true') {
            console.log(JSON.stringify(value, null, 2))
          } else {
            logger.info(`${options.get}: ${JSON.stringify(value, null, 2)}`)
          }
        } else {
          if (process.env['ZENO_INTEGRATION'] === 'true') {
            console.log(JSON.stringify(config, null, 2))
          } else {
            logger.info('Project Configuration')
            logger.info('=====================')
            logger.info(JSON.stringify(config, null, 2))
          }
        }
      } catch (error) {
        logger.error('Failed to load configuration', error instanceof Error ? error : undefined)
        process.exit(1)
      }
    })

  configCmd
    .command('set <key> <value>')
    .description(
      'Set a configuration value (supports dot-path keys, e.g. workflowMode or git.autoCommit)'
    )
    .action(async (key: string, rawValue: string) => {
      try {
        const projectRoot = findProjectRoot()
        if (!projectRoot) {
          logger.error('Not in a Zeno project directory')
          process.exitCode = 1
          return
        }

        const config = await loadConfig(projectRoot)

        // Parse raw value: try JSON first, fall back to string
        let parsed: unknown
        try {
          parsed = JSON.parse(rawValue)
        } catch {
          parsed = rawValue
        }

        // Set dot-path key on a mutable copy of the config
        const updated = JSON.parse(JSON.stringify(config)) as Record<string, unknown>
        const keys = key.split('.')
        if (keys.length === 0) {
          logger.error('Invalid configuration key: empty key')
          process.exitCode = 1
          return
        }
        let target: Record<string, unknown> = updated
        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i]
          if (k !== undefined) {
            if (!(k in target) || typeof target[k] !== 'object' || target[k] === null) {
              target[k] = {}
            }
            target = target[k] as Record<string, unknown>
          }
        }
        const lastKey = keys[keys.length - 1]
        if (lastKey !== undefined) {
          target[lastKey] = parsed
        }

        // saveConfig validates against the full schema before persisting
        await saveConfig(updated as never, projectRoot)
        logger.info(`Configuration updated: ${key} = ${JSON.stringify(parsed)}`)
      } catch (error) {
        logger.error(
          `Failed to set configuration: ${error instanceof Error ? error.message : String(error)}`
        )
        process.exitCode = 1
      }
    })
}
