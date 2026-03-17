/**
 * Worktree Command Category
 *
 * Commands for managing isolated git worktrees per proposal
 */

import type { Command } from 'commander'
import { WorktreeManager } from '../../core/worktree-manager.js'
import { logger } from '../../utils/logger.js'

/**
 * Register worktree commands with the CLI program
 */
export function registerWorktreeCommands(program: Command): void {
  const worktree = program
    .command('worktree')
    .description('Manage isolated git worktrees for proposals')

  worktree
    .command('list')
    .description('List active worktrees')
    .option('--status <status>', 'Filter by status: active | orphaned | all', 'active')
    .action(async (options: { status: string }) => {
      try {
        const manager = new WorktreeManager()
        const list = await manager.list()
        const filtered = options.status === 'all'
          ? list
          : list // status classification not yet tracked in memory; return all for now
        if (filtered.length === 0) {
          logger.info('No active worktrees.')
          return
        }
        const rows = filtered.map(
          (w) =>
            `  ${w.proposalHash.padEnd(16)}  ${w.branch.padEnd(40)}  ${w.path}  (created: ${w.createdAt.toISOString()})`
        )
        logger.info(`Worktrees (${String(filtered.length)}):\n${rows.join('\n')}`)
      } catch (error) {
        logger.error(`Failed to list worktrees: ${String(error)}`)
        process.exitCode = 1
      }
    })

  worktree
    .command('remove <hash>')
    .description('Remove a worktree by proposal hash')
    .option('--force', 'Force removal even with uncommitted changes', false)
    .action(async (hash: string, options: { force: boolean }) => {
      try {
        const manager = new WorktreeManager()
        await manager.remove(hash, options.force)
        logger.info(`Worktree for proposal ${hash} removed.`)
      } catch (error) {
        logger.error(`Failed to remove worktree: ${String(error)}`)
        process.exitCode = 1
      }
    })

  worktree
    .command('prune')
    .description('Remove expired worktrees')
    .option('--expire-days <days>', 'Max age in days (default: 7)', '7')
    .option('--dry-run', 'List what would be deleted without deleting', false)
    .action(async (options: { expireDays: string; dryRun: boolean }) => {
      try {
        const manager = new WorktreeManager()
        const maxAgeMs = parseInt(options.expireDays, 10) * 24 * 3600 * 1000
        if (options.dryRun) {
          const list = await manager.list()
          const now = Date.now()
          const expired = list.filter(w => now - w.createdAt.getTime() >= maxAgeMs)
          if (expired.length === 0) {
            logger.info('No worktrees would be pruned.')
          } else {
            const rows = expired.map(w => `  ${w.proposalHash}  (created: ${w.createdAt.toISOString()})`)
            logger.info(`Would prune ${String(expired.length)} worktree(s):\n${rows.join('\n')}`)
          }
          return
        }
        const before = (await manager.list()).length
        await manager.prune(maxAgeMs)
        const after = (await manager.list()).length
        logger.info(`Pruned ${String(before - after)} worktree(s). ${String(after)} remaining.`)
      } catch (error) {
        logger.error(`Failed to prune worktrees: ${String(error)}`)
        process.exitCode = 1
      }
    })

  worktree
    .command('merge <hash>')
    .description('Merge a proposal worktree branch into the current branch')
    .option('--target <branch>', 'Target branch to merge into (default: main)', 'main')
    .option('--strategy <strategy>', 'Merge strategy: rebase | squash | merge (default: merge)', 'merge')
    .option('--dry-run', 'Show what would happen without merging', false)
    .action(async (hash: string, options: { target: string; strategy: string; dryRun: boolean }) => {
      try {
        const strategy = options.strategy as 'rebase' | 'squash' | 'merge'
        if (!['rebase', 'squash', 'merge'].includes(strategy)) {
          logger.error(`Invalid strategy "${options.strategy}". Must be one of: rebase, squash, merge`)
          process.exitCode = 1
          return
        }
        const manager = new WorktreeManager()
        if (options.dryRun) {
          logger.info(`[dry-run] Would merge proposal/${hash} into ${options.target} using strategy=${strategy}`)
          return
        }
        const result = await manager.merge(hash, options.target, strategy)
        if (result.conflicts && result.conflicts.length > 0) {
          logger.error(
            `Merge failed with conflicts:\n${result.conflicts.map((c) => `  - ${c}`).join('\n')}`
          )
          process.exitCode = 1
          return
        }
        logger.info(`Worktree for proposal ${hash} merged into ${options.target} using strategy=${strategy}.`)
      } catch (error) {
        logger.error(`Failed to merge worktree: ${String(error)}`)
        process.exitCode = 1
      }
    })
}
