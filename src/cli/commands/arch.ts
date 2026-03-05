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
    .description('Generate all architecture diagrams')
    .action(() => {
      logger.info('Architecture command: generate')
      logger.info('Not yet implemented - Gate 4 required')
      logger.info('This command will generate Mermaid diagrams for system architecture')
    })

  archCmd
    .command('show <type>')
    .description('Show specific diagram type (system, lifecycle, flow, gate-roadmap)')
    .action((type: string) => {
      logger.info(`Architecture command: show ${type}`)
      logger.info('Not yet implemented - Gate 4 required')
      logger.info('This command will display a specific architecture diagram')
      void getGlobalRegistry().invoke('arch_show', { type })
    })

  archCmd
    .command('setup-graphviz')
    .description('Display Graphviz installation instructions')
    .action(() => {
      const instructions = getGraphvizInstructions()
      logger.info(instructions)
    })
}
