/**
 * Trace Command
 *
 * Git traceability for artifact hashes
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { getGlobalRegistry } from '../../integration/function-implementations.js'

interface GitTraceCommit {
  commitSha: string
  subject: string
  author: string
  date: string
  confidenceScore: number
  notes?: string
  filesChanged: string[]
}
interface GitTraceData {
  commits: GitTraceCommit[]
  totalCommits: number
}
interface GitTraceResult {
  success: boolean
  data?: GitTraceData
  error?: { message: string }
}

/**
 * Register trace command
 */
export function registerTraceCommand(program: Command): void {
  program
    .command('trace <artifactHash>')
    .description('Trace git commits referencing an artifact hash')
    .option('-f, --from <date>', 'Start date for commit search (ISO format)')
    .option('-t, --to <date>', 'End date for commit search (ISO format)')
    .option('-b, --branch <branch>', 'Branch to search (defaults to current)')
    .option('-l, --limit <number>', 'Limit number of commits returned')
    .option('--json', 'Output in JSON format')
    .action(
      async (
        artifactHash: string,
        options: {
          from?: string
          to?: string
          branch?: string
          limit?: string
          json?: boolean
        }
      ) => {
        try {
          const registry = getGlobalRegistry()

          const params = {
            artifactHash,
            dateRange:
              options.from || options.to
                ? {
                    from: options.from,
                    to: options.to,
                  }
                : undefined,
            branch: options.branch,
            limit: options.limit ? parseInt(options.limit, 10) : undefined,
          }

          const result = (await registry.invoke('git_trace', params)) as GitTraceResult

          if (result.success) {
            if (options.json) {
              console.log(JSON.stringify(result.data, null, 2))
            } else {
              // Pretty print
              const data = result.data
              if (!data) {
                logger.error('Trace failed: no data returned')
                process.exit(1)
              }
              console.log(
                `Found ${String(data.commits.length)} commits referencing ${artifactHash}`
              )
              console.log(`Total commits searched: ${String(data.totalCommits)}`)
              console.log()

              if (data.commits.length > 0) {
                console.log('Commits:')
                for (const commit of data.commits) {
                  console.log(`  ${commit.commitSha.slice(0, 8)} - ${commit.subject}`)
                  console.log(`    Author: ${commit.author}`)
                  console.log(`    Date: ${commit.date}`)
                  console.log(`    Confidence: ${(commit.confidenceScore * 100).toFixed(1)}%`)
                  if (commit.notes) {
                    console.log(`    Notes: ${commit.notes}`)
                  }
                  console.log(`    Files: ${commit.filesChanged.join(', ')}`)
                  console.log()
                }
              }
            }
          } else {
            logger.error(`Trace failed: ${result.error?.message ?? 'Unknown error'}`)
            process.exit(1)
          }
        } catch (error) {
          logger.error('Trace command failed', error instanceof Error ? error : undefined)
          process.exit(1)
        }
      }
    )
}
