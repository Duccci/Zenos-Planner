/**
 * Repositories Command Category
 *
 * Commands for managing multi-repository projects
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { listRepositories, saveRepository, deleteRepository } from '../../storage/repository-storage.js'
import { detectRepositoryBoundaries } from '../../core/boundary-detection.js'
import { shortHash } from '../../utils/hash.js'

/**
 * Register repositories commands
 */
export function registerReposCommands(program: Command): void {
  const reposCmd = program
    .command('repos')
    .description('Manage multi-repository projects')
    .alias('repo')
    .alias('repositories')

  reposCmd
    .command('list')
    .description('List detected repositories')
    .action(() => {
      const projectRoot = process.cwd()
      const repos = listRepositories(undefined, projectRoot)
      if (repos.length === 0) {
        logger.info('No repositories registered.')
        return
      }
      logger.info(`${'ID'.padEnd(12)} ${'NAME'.padEnd(24)} ${'TYPE'.padEnd(10)} PATH`)
      logger.info(`${'-'.repeat(12)} ${'-'.repeat(24)} ${'-'.repeat(10)} ${'-'.repeat(30)}`)
      for (const r of repos) {
        logger.info(`${r.hash.slice(0, 8).padEnd(12)} ${r.name.padEnd(24)} ${r.type.padEnd(10)} ${r.path}`)
      }
    })

  reposCmd
    .command('deps')
    .description('Show cross-repository dependencies')
    .action(() => {
      // Repository dependencies are tracked in project.json, not in SQLite.
      logger.info('Repository dependencies are now tracked in project.json.')
      logger.info('Use the project configuration to view cross-repo dependency data.')
    })

  reposCmd
    .command('detect')
    .description('Re-run repository boundary detection')
    .option(
      '--reanalyzeCrossRepo <bool>',
      'Re-analyze cross-repository dependencies (true/false)',
      'false'
    )
    .action(async () => {
      const projectRoot = process.cwd()
      logger.info('Running boundary detection...')
      const result = await detectRepositoryBoundaries(projectRoot, { persist: false })
      if (result.recommendations.length === 0) {
        logger.info('No boundary recommendations generated.')
        return
      }
      logger.info(`\nDetected ${String(result.recommendations.length)} boundary recommendation(s):`)
      for (const rec of result.recommendations) {
        logger.info(`  ${rec.name} (${rec.type}) — ${rec.path}`)
        if (rec.rationale) {
          logger.info(`    Rationale: ${rec.rationale}`)
        }
      }
    })

  reposCmd
    .command('adjust')
    .description('Manually adjust repository boundaries')
    .option('--apply', 'Apply detected boundary recommendations to storage')
    .action(async (opts: { apply?: boolean }) => {
      const projectRoot = process.cwd()
      const persist = opts.apply === true
      logger.info(persist ? 'Applying boundary recommendations...' : 'Previewing boundary recommendations (use --apply to persist)...')
      const result = await detectRepositoryBoundaries(projectRoot, { persist })
      if (result.recommendations.length === 0) {
        logger.info('No boundary recommendations generated.')
        return
      }
      logger.info(`\n${String(result.recommendations.length)} recommendation(s)${persist ? ' applied' : ''}:`)
      for (const rec of result.recommendations) {
        logger.info(`  ${rec.name} (${rec.type}) — ${rec.path}`)
      }
    })

  reposCmd
    .command('add')
    .description('Register a repository')
    .requiredOption('--path <path>', 'Repository root path')
    .option('--type <type>', 'Repository type (service, library, app, tool)', 'library')
    .option('--name <name>', 'Repository name')
    .action((opts: { path: string; type: string; name?: string }) => {
      const projectRoot = process.cwd()
      const name = opts.name ?? (opts.path.split('/').filter(Boolean).pop() ?? opts.path)
      const hash = shortHash(`${name}${opts.path}`)
      saveRepository({ hash, name, type: opts.type as 'service' | 'library' | 'app' | 'tool', path: opts.path }, projectRoot)
      logger.info(`Repository "${name}" registered (hash=${hash})`)
    })

  reposCmd
    .command('remove')
    .description('Unregister a repository')
    .requiredOption('--id <id>', 'Repository ID or hash')
    .action((opts: { id: string }) => {
      const projectRoot = process.cwd()
      deleteRepository(opts.id, projectRoot)
      logger.info(`Repository ${opts.id} removed.`)
    })
}
