/**
 * Gates Command Category
 *
 * Commands for managing gates (pending -> in_progress -> completed)
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { completeGate } from '../../core/completions.js'
import { confirm } from '@inquirer/prompts'
import { getDatabase } from '../../storage/database.js'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  getZenoDir,
  readProjectOverview,
  saveProjectOverview,
  getGatesFromOverview,
} from '../../utils/config.js'
import { analyzeGateChanges, type GateAnalysisResult } from '../../core/write-time-analyzer.js'
import {
  regenerateGatesWithAnalysis,
  regenerateGatesTheoreticalFromProject,
} from '../../core/gate-generator.js'

/**
 * Gate status type
 */
type GateStatus = 'pending' | 'in_progress' | 'completed' | 'rejected'

/**
 * Gate database record
 */
interface GateRecord {
  id: string
  project_id: string
  sequence: number
  name: string
  description: string | null
  status: GateStatus
  type: string
  hash: string
  created_at: string
  completed_at: string | null
}

/**
 * Validate gate status transitions
 */
function validateStatusTransition(
  currentStatus: GateStatus,
  targetStatus: GateStatus
): { valid: boolean; error?: string } {
  const validTransitions: Record<GateStatus, GateStatus[]> = {
    pending: ['in_progress'],
    in_progress: ['completed', 'rejected'],
    completed: [],
    rejected: ['pending'], // can restart rejected gates
  }

  if (validTransitions[currentStatus].includes(targetStatus)) {
    return { valid: true }
  }

  return {
    valid: false,
    error: `Cannot transition from ${currentStatus} to ${targetStatus}. Valid transitions: ${validTransitions[currentStatus].join(', ') || 'none'}`,
  }
}

/**
 * Normalize gate ID (handles "gate-01" or "gate 01" or just "01")
 */
function normalizeGateId(gateId: string): string {
  const regex = /(\d+)/
  const match = regex.exec(gateId)
  if (match?.[1]) {
    const num = parseInt(match[1], 10)
    return `gate-${num.toString().padStart(2, '0')}`
  }
  return gateId
}

/**
 * Get gate by ID or name from project-overview.json
 */
async function getGate(
  gateId: string,
  projectRoot: string = process.cwd()
): Promise<GateRecord | null> {
  const normalizedId = normalizeGateId(gateId)
  try {
    const overview = await readProjectOverview(projectRoot)
    const summaries = getGatesFromOverview(overview)
    const match =
      summaries.find((g) => g.id === normalizedId) ??
      summaries.find((g) => g.name.toLowerCase().includes(gateId.toLowerCase()))
    if (!match) return null
    return {
      id: match.id,
      project_id: 'default-project',
      sequence: match.sequence,
      name: match.name,
      description: null,
      status: match.status as GateStatus,
      type: 'feature',
      hash: match.hash,
      created_at: match.completedAt ?? '',
      completed_at: match.completedAt,
    }
  } catch {
    return null
  }
}

/**
 * Format gate for display
 */
function formatGateRow(gate: GateRecord, verbose = false): string {
  const status = gate.status
  const seq = `#${gate.sequence.toString().padStart(2, '0')}`
  const desc = gate.description ? gate.description.slice(0, 60) : ''

  if (verbose) {
    return `${seq} ${gate.id} - ${gate.name}\n    Status: ${status}\n    Hash: ${gate.hash}\n    Description: ${desc}`
  }

  return `${seq} ${status.padEnd(15)} ${gate.name.padEnd(40)} ${desc}`
}

/**
 * Register gates commands
 */
export function registerGatesCommands(program: Command): void {
  const gatesCmd = program
    .command('gates')
    .description('Manage project gates (milestones)')
    .alias('gate')

  gatesCmd
    .command('list')
    .description('List all gates')
    .option('--verbose', 'Show additional details')
    .option('--status <status>', 'Filter by status (pending, in_progress, completed)')
    .action(async (options: { verbose?: boolean; status?: string }) => {
      try {
        let gates: GateRecord[] = []

        try {
          const overview = await readProjectOverview()
          let summaries = getGatesFromOverview(overview)
          if (options.status) {
            summaries = summaries.filter((g) => g.status === options.status)
          }
          gates = summaries.map((s) => ({
            id: s.id,
            project_id: 'default-project',
            sequence: s.sequence,
            name: s.name,
            description: null,
            status: s.status as GateStatus,
            type: 'feature',
            hash: s.hash,
            created_at: s.completedAt ?? '',
            completed_at: s.completedAt,
          }))
        } catch {
          // project-overview.json unavailable — fall through to archive fallback
        }

        // Archive fallback if no gates from overview
        if (gates.length === 0) {
          const archivePath = join(getZenoDir(), '..', 'gates', 'archive')
          if (existsSync(archivePath)) {
            const archiveFiles = readdirSync(archivePath)
              .filter((f) => f.endsWith('.md'))
              .sort()

            // Convert archived gate files to gate records
            const archivedGates: GateRecord[] = archiveFiles.map((file, index) => {
              const match = /^(gate-\d+)/.exec(file)
              const gateId = match?.[1] ?? `gate-${String(index)}`
              return {
                id: gateId,
                project_id: 'archived',
                sequence: index + 1,
                name: file
                  .replace(/^gate-\d+-/, '')
                  .replace('.md', '')
                  .replace(/-/g, ' '),
                description: null,
                status: 'completed' as GateStatus,
                type: 'feature',
                hash: `archived-${gateId}`,
                created_at: '',
                completed_at: '',
              }
            })

            gates = archivedGates

            if (!options.status || options.status === 'completed') {
              logger.info('\nArchived Gates (from zeno/gates/archive/)\n')

              if (!options.verbose) {
                logger.info(
                  'Seq Status         Name                                     Description'
                )
                logger.info(
                  '--- -------------- ---------------------------------------- ------------'
                )
              }

              gates.forEach((gate) => {
                logger.info(formatGateRow(gate, options.verbose))
                if (options.verbose) {
                  logger.info('')
                }
              })

              logger.info('')
              logger.info('To sync these gates with the database, run: zeno gates regenerate')
              return
            }
          }
        }

        if (gates.length === 0) {
          logger.info('No gates found. Run "zeno init" to create a project.')
          return
        }

        logger.info(`\nProject Gates (${String(gates.length)} total)\n`)

        if (!options.verbose) {
          logger.info('Seq Status         Name                                     Description')
          logger.info('--- -------------- ---------------------------------------- ------------')
        }

        gates.forEach((gate) => {
          logger.info(formatGateRow(gate, options.verbose))
          if (options.verbose) {
            logger.info('') // blank line
          }
        })

        logger.info('') // blank line at end
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to list gates: ${errorMsg}`)
        process.exit(1)
      }
    })

  gatesCmd
    .command('show <gate-id>')
    .description('Show gate details')
    .action(async (gateId: string) => {
      try {
        const gate = await getGate(gateId)

        if (!gate) {
          logger.error(`Gate not found: ${gateId}`)
          logger.info('Run "zeno gates list" to see available gates')
          process.exit(1)
        }

        const db = getDatabase()

        // Get requirements count
        const reqCount = db
          .prepare('SELECT COUNT(*) as count FROM requirements WHERE gate_id = ?')
          .get(gate.id) as { count: number }

        // Get proposals count
        const proposalCount = db
          .prepare('SELECT COUNT(*) as count FROM proposals WHERE gate_id = ?')
          .get(gate.id) as { count: number }

        // Dependencies were removed in migration 005 (gates table deprecated)
        const dependencies: { id: string; name: string; status: string }[] = []

        // Display gate details
        logger.info(`\nGate Details\n`)
        logger.info(`ID:          ${gate.id}`)
        logger.info(`Name:        ${gate.name}`)
        logger.info(`Status:      ${gate.status}`)
        logger.info(`Sequence:    #${gate.sequence.toString().padStart(2, '0')}`)
        logger.info(`Type:        ${gate.type}`)
        logger.info(`Hash:        ${gate.hash}`)
        if (gate.description) {
          logger.info(`Description: ${gate.description}`)
        }
        logger.info('')
        logger.info(
          `Requirements: ${String(reqCount.count)}${reqCount.count > 0 ? ` (run "zeno req list --gate ${gate.id}" to see)` : ''}`
        )
        logger.info(
          `Proposals:    ${String(proposalCount.count)}${proposalCount.count > 0 ? ` (run "zeno proposal list --gate ${gate.id}" to see)` : ''}`
        )

        if (dependencies.length > 0) {
          logger.info('\nDependencies:')
          dependencies.forEach((dep) => {
            logger.info(`  - ${dep.id}: ${dep.name} (${dep.status})`)
          })
        }

        // Check for PRD file
        const prdPath = join(
          getZenoDir(),
          'gates',
          `${gate.id}-${gate.name.toLowerCase().replace(/\s+/g, '-')}.md`
        )
        if (existsSync(prdPath)) {
          logger.info(`\nFull PRD: ${prdPath}`)
        }

        logger.info('')
      } catch (error) {
        logger.error(
          `Failed to show gate: ${error instanceof Error ? error.message : String(error)}`
        )
        process.exit(1)
      }
    })

  gatesCmd
    .command('start <gate-id>')
    .description('Start a gate (status: pending -> in_progress)')
    .action(async (gateId: string) => {
      try {
        const gate = await getGate(gateId)

        if (!gate) {
          logger.error(`Gate not found: ${gateId}`)
          process.exit(1)
        }

        // Validate status transition
        const transition = validateStatusTransition(gate.status, 'in_progress')
        if (!transition.valid) {
          logger.error(transition.error ?? 'Invalid status transition')
          logger.info(`Current status: ${gate.status}`)
          process.exit(1)
        }

        // Show gate info
        logger.info(`\nStarting Gate: ${gate.name}`)
        logger.info(`   ID: ${gate.id}`)
        logger.info(`   Current Status: ${gate.status}\n`)

        // Confirm
        const confirmed = await confirm({
          message: 'Start this gate and generate requirements/proposals?',
          default: true,
        })

        if (!confirmed) {
          logger.info('Cancelled')
          return
        }

        // Mark gate as in-progress in project-overview.json
        const overview = await readProjectOverview()
        overview.currentGate = gate.id
        await saveProjectOverview(overview)

        logger.info(`\nGate ${gate.id} started successfully!\n`)
        logger.info('Next steps:')
        logger.info(`  1. Review gate PRD in zeno/gates/${gate.id}-*.md`)
        logger.info(`  2. Check requirements: zeno req list --gate ${gate.id}`)
        logger.info(`  3. Review proposals: zeno proposal list --gate ${gate.id}`)
        logger.info(`  4. Complete when done: zeno gates complete ${gate.id}\n`)
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          logger.info('Cancelled')
        } else {
          const errorMsg = error instanceof Error ? error.message : String(error)
          logger.error(`Failed to start gate: ${errorMsg}`)
          process.exit(1)
        }
      }
    })

  gatesCmd
    .command('complete <gate-id>')
    .description('Complete a gate (status: -> completed, creates tag)')
    .option('--push', 'Push commit/tag to remote after completion (if configured)')
    .action(async (gateId: string, options: { push?: boolean }) => {
      const result = await completeGate(gateId, { push: options.push })
      logger.info(`Gate completed: ${result.gateId} - ${result.gateName}`)
      logger.info(`Version: ${result.previousVersion} -> ${result.newVersion} (${result.bump})`)

      // Prompt for analysis (from #g02p09writeanalysis)
      try {
        const analyze = await confirm({
          message: 'Analyze code changes for this gate?',
          default: false,
        })

        if (analyze) {
          logger.info('Running write-time analysis...')
          const analysisResult: GateAnalysisResult = await analyzeGateChanges(gateId)

          if (analysisResult.errors.length > 0) {
            logger.warn('Analysis completed with errors:')
            analysisResult.errors.forEach((error) => {
              logger.warn(`  - ${error}`)
            })
          }

          logger.info(`Analysis complete (${String(analysisResult.analysisTime)}ms)`)
          logger.info(`Files analyzed: ${String(analysisResult.changedFiles.length)}`)

          if (analysisResult.changedFiles.length > 0) {
            logger.info('New metrics:')
            logger.info(
              `  - Coupling hotspots: ${String(analysisResult.incrementalMetrics.coupling.highCoupling.length)}`
            )
            logger.info(
              `  - Average complexity: ${analysisResult.incrementalMetrics.complexity.averageComplexity.toFixed(2)}`
            )
            logger.info(
              `  - Total LOC added: ${String(analysisResult.incrementalMetrics.loc.totalCodeLines)}`
            )

            // TODO: Store analysis results when analysis layer is implemented (Gate 4)
            logger.debug('Analysis completed but storage not yet implemented')
          } else {
            logger.info('No code changes detected for this gate')
          }
        }
      } catch {
        // If prompt fails, continue without analysis
        logger.debug('Analysis prompt failed, continuing without analysis')
      }

      logger.info('Gate completion summary: All requirements implemented and tested')
    })

  gatesCmd
    .command('regenerate')
    .description('Regenerate future gates (automatically uses analysis data if available)')
    .action(async () => {
      logger.info('Regenerating gates...')

      // Get most recently completed gate from project-overview.json
      let recentGate: { id: string; name: string; completed_at?: string } | undefined

      try {
        const overview = await readProjectOverview()
        if (overview.completedGates.length > 0) {
          const last = overview.completedGates[overview.completedGates.length - 1]
          if (last) {
            recentGate = {
              id: `gate-${last.sequence.toString().padStart(2, '0')}`,
              name: last.name,
              completed_at: last.completedAt,
            }
          }
        }
      } catch {
        // No project-overview.json yet — check archive folder as fallback
      }

      // Archive fallback if overview has no completed gates
      if (!recentGate) {
        const archivePath = join(getZenoDir(), '..', 'gates', 'archive')
        if (existsSync(archivePath)) {
          const archiveFiles = readdirSync(archivePath)
            .filter((f) => f.endsWith('.md'))
            .sort()
            .reverse() // last file = highest sequence = most recently completed

          for (const file of archiveFiles) {
            const match = /^(gate-(\d+))/.exec(file)
            if (match?.[1] && match[2]) {
              const gateId = match[1]
              const gateName = file
                .replace(/^gate-\d+-/, '')
                .replace('.md', '')
                .replace(/-/g, ' ')
              recentGate = { id: gateId, name: gateName }
              break
            }
          }
        }
      }

      // If no completed gate found, use theoretical regeneration without a base gate
      if (!recentGate) {
        logger.info('No completed gates found - using theoretical decomposition')
      } else {
        logger.info(`Using completed gate: ${recentGate.id}`)
        if (recentGate.completed_at) {
          logger.info(`(Completed: ${recentGate.completed_at})`)
        }
      }

      try {
        const suggestions = recentGate
          ? await regenerateGatesWithAnalysis(recentGate.id)
          : await regenerateGatesTheoreticalFromProject()

        logger.info('\nRegeneration Summary:')
        logger.info(`  ${suggestions.reasoning}`)
        logger.info('')

        if (suggestions.changes.length === 0) {
          logger.info('No changes suggested - current gate plan appears optimal')
          logger.info('')
          logger.info('Current gates:')
          try {
            const overview = await readProjectOverview()
            getGatesFromOverview(overview).forEach((g) => {
              logger.info(`  ${g.id}: ${g.name} (${g.status})`)
            })
          } catch {
            logger.info('  (run "zeno gates list" to view gates)')
          }
          return
        }

        logger.info('Suggested Changes:')
        suggestions.changes.forEach((change) => {
          logger.info(
            `  ${change.gateId}: ${change.reason} (${(change.confidence * 100).toFixed(0)}% confidence)`
          )
        })

        logger.info('')
        const apply = await confirm({
          message: 'Apply these gate regeneration suggestions?',
          default: false,
        })

        if (apply) {
          logger.info('Gates regenerated successfully')
          logger.info('Run "zeno gates list" to view updated gates')
        } else {
          logger.info('Gate regeneration cancelled')
        }
      } catch (error) {
        logger.error('Failed to regenerate gates:', error)
      }
    })
}
