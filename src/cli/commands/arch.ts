/**
 * Architecture Command Category
 *
 * Commands for managing architecture diagrams
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { getGlobalRegistry } from '../../index.js'

/**
 * Get platform-specific Graphviz installation instructions
 */
function getGraphvizInstructions(): string {
  const platform = process.platform

  let instructions =
    'Graphviz Installation Instructions\n' + '==================================\n\n'

  switch (platform) {
    case 'darwin':
      instructions += 'macOS (using Homebrew):\n'
      instructions += '  brew install graphviz\n'
      break
    case 'linux':
      instructions += 'Linux (Debian/Ubuntu):\n'
      instructions += '  sudo apt-get install graphviz\n\n'
      instructions += 'Linux (Red Hat/CentOS):\n'
      instructions += '  sudo yum install graphviz\n\n'
      instructions += 'Linux (Fedora):\n'
      instructions += '  sudo dnf install graphviz\n'
      break
    case 'win32':
      instructions += 'Windows (using Chocolatey):\n'
      instructions += '  choco install graphviz\n\n'
      instructions += 'Windows (using Windows Package Manager):\n'
      instructions += '  winget install graphviz\n'
      break
    default:
      instructions += `Visit https://graphviz.org/download/ for installation\n`
      instructions += `instructions specific to ${platform}\n`
  }

  instructions +=
    '\nAfter installation, verify with:\n' +
    '  dot -V\n\n' +
    'For more information, visit: https://graphviz.org/'

  return instructions
}

/**
 * Register architecture commands
 */
export function registerArchCommands(program: Command): void {
  const archCmd = program
    .command('arch')
    .description('Manage architecture diagrams')
    .alias('architecture')

  archCmd
    .command('generate')
    .option('--gate <hash>', 'Scope diagram generation to a specific gate')
    .option('--type <type>', 'Generate a single diagram type (optional)')
    .description('Generate architecture diagrams (all core + selected conditional, or single type)')
    .action(async (options: { gate?: string; type?: string }) => {
      try {
        logger.info('Generating architecture diagrams...')
        const registry = getGlobalRegistry()

        const params: Record<string, unknown> = {}
        if (options.gate) {
          params['gateHash'] = options.gate
        }
        if (options.type) {
          params['diagramType'] = options.type
        }

        const result = await registry.invoke('arch_generate', params)

        if (result.success) {
          const data = result.data as Record<string, unknown>
          if (typeof data === 'object') {
            logger.info('✓ Architecture diagrams generated successfully')
            if ('files' in data && Array.isArray(data['files'])) {
              logger.info(`Generated ${String((data['files'] as unknown[]).length)} diagram(s)`)
              for (const file of data['files'] as unknown[]) {
                logger.info(`  • ${String(file)}`)
              }
            }
            if ('backends' in data && typeof data['backends'] === 'object') {
              logger.info(`Rendering backends used: ${Object.keys(data['backends'] as Record<string, unknown>).join(', ')}`)
            }
          }
        } else {
          logger.error(`✗ Failed to generate diagrams`)
          if (result.error.message) {
            logger.error(`Error: ${result.error.message}`)
          }
          process.exit(1)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(`✗ Generate command failed: ${message}`)
        process.exit(1)
      }
    })

  archCmd
    .command('show <type>')
    .option('--gate <hash>', 'Show gate-scoped conditional diagram')
    .description('Display a specific architecture diagram')
    .action(async (type: string, options: { gate?: string }) => {
      try {
        const registry = getGlobalRegistry()

        const params: Record<string, unknown> = { type }
        if (options.gate) {
          params['gateHash'] = options.gate
        }

        const result = await registry.invoke('arch_show', params)

        if (result.success) {
          const data = result.data as Record<string, unknown>
          if (typeof data === 'object' && 'content' in data) {
            // Output diagram content to stdout
            console.log(data['content'])
          } else {
            console.log(JSON.stringify(data, null, 2))
          }
        } else {
          if (result.error.code === 'DIAGRAM_NOT_FOUND') {
            logger.error(
              `✗ Diagram type '${type}' not found.\n` +
              'Run "zeno arch generate" to generate diagrams first.\n' +
              'Use "zeno arch list" to see available diagram types.'
            )
          } else {
            logger.error(`✗ Failed to retrieve diagram: ${result.error.message}`)
          }
          process.exit(1)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(`✗ Show command failed: ${message}`)
        process.exit(1)
      }
    })

  archCmd
    .command('list')
    .description('List available diagram types')
    .action(async () => {
      try {
        const registry = getGlobalRegistry()
        const result = await registry.invoke('arch_catalogue', {})

        if (result.success) {
          const catalogue = result.data as Record<string, unknown>[]
          if (Array.isArray(catalogue) && catalogue.length > 0) {
            logger.info('Available Architecture Diagram Types:')
            logger.info('=====================================\n')

            // Group by category
            const core = catalogue.filter((d) => d['category'] === 'core')
            const conditional = catalogue.filter((d) => d['category'] === 'conditional')

            if (core.length > 0) {
              logger.info('CORE DIAGRAMS (always generated):')
              for (const diagram of core) {
                const type = typeof diagram['type'] === 'string' ? diagram['type'] : ''
                const desc = typeof diagram['description'] === 'string' ? diagram['description'] : ''
                logger.info(`  • ${type}: ${desc}`)
              }
              logger.info('')
            }

            if (conditional.length > 0) {
              logger.info('CONDITIONAL DIAGRAMS (selected per-gate):')
              for (const diagram of conditional) {
                const type = typeof diagram['type'] === 'string' ? diagram['type'] : ''
                const desc = typeof diagram['description'] === 'string' ? diagram['description'] : ''
                logger.info(`  • ${type}: ${desc}`)
              }
            }
          } else {
            logger.info('No diagram types available')
          }
        } else {
          logger.error(
            `✗ Failed to retrieve diagram catalogue: ${result.error.message}`
          )
          process.exit(1)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(`✗ List command failed: ${message}`)
        process.exit(1)
      }
    })

  archCmd
    .command('setup-graphviz')
    .description('Display Graphviz installation instructions')
    .action(() => {
      const instructions = getGraphvizInstructions()
      logger.info(instructions)
    })
}
