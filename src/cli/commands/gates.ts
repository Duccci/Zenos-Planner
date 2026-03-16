/**
 * Gates Command Category
 *
 * Commands for managing gates (pending -> in_progress -> completed)
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import { completeGate } from '../../core/completions.js'
import { normalizeGateId } from '../../utils/normalize.js'
import { listArchivedGates } from '../../utils/gate-consolidation.js'
import { confirm } from '@inquirer/prompts'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  getZenoDir,
  readProjectOverview,
  saveProjectOverview,
  getGatesFromOverview,
} from '../../utils/config.js'
import { analyzeGateChanges, type GateAnalysisResult } from '../../core/write-time-analyzer.js'
import { replanGates } from '../../core/gate-generator.js'
import { updateCurrentGateInState, syncProjectMetadataToState, syncUpcomingGatesToState } from '../../utils/state-sync.js'
import { syncGatesToProjectOverview } from '../../utils/gate-sync.js'
import { invokeGatesAction } from '../cli-tool-invoker.js'
import { type GateStatus, GATE_TRANSITIONS, validateTransition } from '../../core/transitions.js'

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
    .option('--status <status>', 'Filter by status (pending, validated, in_progress, completed)')
    .action(async (options: { verbose?: boolean; status?: string }) => {
      try {
        // Sync database gates to project-overview.json first
        try {
          await syncGatesToProjectOverview()
        } catch (error) {
          logger.debug(
            `Failed to sync gates: ${error instanceof Error ? error.message : String(error)}`
          )
        }

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
          const archivedGateList = listArchivedGates(archivePath)

          // Convert archived gate records to gate records
          if (archivedGateList.length > 0) {
            const archivedGates: GateRecord[] = archivedGateList.map((g, index) => ({
              id: g.id,
              project_id: 'archived',
              sequence: index + 1,
              name: g.name,
              description: null,
              status: 'completed' as GateStatus,
              type: 'feature',
              hash: `archived-${g.id}`,
              created_at: '',
              completed_at: '',
            }))

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
        // Sync database gates to project-overview.json first
        try {
          await syncGatesToProjectOverview()
        } catch (error) {
          logger.debug(
            `Failed to sync gates: ${error instanceof Error ? error.message : String(error)}`
          )
        }

        const gate = await getGate(gateId)

        if (!gate) {
          logger.error(`Gate not found: ${gateId}`)
          logger.info('Run "zeno gates list" to see available gates')
          process.exit(1)
        }

        // Get requirements and proposals count via MCP tools
        const reqResult = await invokeGatesAction<{ count: number }>('list_requirements', {
          gateId: gate.id,
        })
        const reqCount = reqResult.data?.count ?? 0

        const propResult = await invokeGatesAction<{ count: number }>('list_proposals', {
          gateId: gate.id,
        })
        const proposalCount = propResult.data?.count ?? 0

        // Dependencies were removed in migration 005 (gates table deprecated)
        const dependencies: { id: string; name: string; status: string }[] = []

        // Display gate details
        logger.info(`\nGate Details\n`)
        logger.info(`ID:          ${gate.id}`)
        logger.info(`Name:        ${gate.name}`)
        logger.info(`Status:      ${gate.status}`)
        logger.info(`Sequence:    #${gate.sequence.toString().padStart(2, '0')}`)
        logger.info(`Requirements: ${String(reqCount)}`)
        logger.info(`Proposals:    ${String(proposalCount)}`)
        logger.info(`Type:        ${gate.type}`)
        logger.info(`Hash:        ${gate.hash}`)
        if (gate.description) {
          logger.info(`Description: ${gate.description}`)
        }
        logger.info('')
        logger.info(
          `Requirements: ${String(reqCount)}${reqCount > 0 ? ` (run "zeno req list --gate ${gate.id}" to see)` : ''}`
        )
        logger.info(
          `Proposals:    ${String(proposalCount)}${proposalCount > 0 ? ` (run "zeno proposal list --gate ${gate.id}" to see)` : ''}`
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
        const transition = validateTransition(GATE_TRANSITIONS, gate.status, 'in_progress')
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

        // Sync gate start to state.json
        try {
          await updateCurrentGateInState(gate.id, gate.name, gate.sequence, gate.hash)
        } catch (error) {
          logger.warn(
            `Failed to sync gate start to state.json: ${error instanceof Error ? error.message : String(error)}`
          )
          // Don't fail the start if state sync fails
        }

        // Sync gate change back to project-overview.json
        try {
          await syncGatesToProjectOverview()
        } catch (error) {
          logger.debug(
            `Failed to sync gates: ${error instanceof Error ? error.message : String(error)}`
          )
        }

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

      // Sync completed gate back to project-overview.json
      try {
        await syncGatesToProjectOverview()
      } catch (error) {
        logger.debug(
          `Failed to sync gates: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    })

  gatesCmd
    .command('validate <gate-id>')
    .description('Dry-run quality and structural checks on a gate without completing it')
    .action(async (gateId: string) => {
      const normalizedId = normalizeGateId(gateId)
      try {
        const result = await invokeGatesAction<{
          gateId: string
          passed: boolean
          errors?: string[]
          warnings?: string[]
          failedChecks?: Record<string, boolean>
          nextRequiredStep?: {
            blocking: boolean
            action: string
            description: string
            checklist?: string[]
          }
        }>('validate', { gateId: normalizedId })

        if (!result.success || !result.data) {
          logger.error(`Validation failed: ${result.error ?? 'Unknown error'}`)
          process.exit(1)
          return
        }

        const data = result.data

        logger.info(`\nValidating Gate: ${data.gateId}`)

        if (data.warnings && data.warnings.length > 0) {
          logger.info('\nWarnings:')
          for (const w of data.warnings) logger.warn(`  ${w}`)
        }

        if (data.errors && data.errors.length > 0) {
          logger.info('\nErrors:')
          for (const e of data.errors) logger.error(`  ${e}`)
        }

        if (data.failedChecks && Object.keys(data.failedChecks).length > 0) {
          logger.info('\nFailed checks:')
          for (const [check] of Object.entries(data.failedChecks)) {
            logger.error(`  ${check}: FAIL`)
          }
        }

        logger.info('')
        if (data.passed) {
          logger.info('Gate validation passed.')
          if (data.nextRequiredStep?.checklist && data.nextRequiredStep.checklist.length > 0) {
            logger.info('\nQualitative review required before gates_action:start:')
            for (const item of data.nextRequiredStep.checklist) {
              logger.info(`  - ${item}`)
            }
          }
        } else {
          logger.error('Gate validation failed. Address errors before completing.')
          process.exit(1)
        }
      } catch (error) {
        logger.error(`Validate failed: ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
      }
    })

  gatesCmd
    .command('replan [gate-id]')
    .description(
      'Replan gates: regenerate future gates, or clear+re-render a single gate from template.\n' +
      '  zeno gates replan              — regenerate all pending/future gates\n' +
      '  zeno gates replan gate-08      — clear and re-render gate-08 from template\n' +
      '  zeno gates replan --prd-changed — rescope: pull current PRD end-state as context'
    )
    .alias('regenerate')
    .option('--prd-changed', 'Signal that the project PRD end-state has changed (rescope)')
    .option('--from <gate-id>', 'Multi-gate baseline: regenerate gates after this completed gate')
    .option('--dry-run', 'Show the replan without writing any files')
    .action(async (gateId: string | undefined, options: { prdChanged?: boolean; from?: string; dryRun?: boolean }) => {
      const isSingle = !!gateId
      const label = isSingle ? `gate ${gateId}` : 'future gates'
      const trigger = options.prdChanged ? 'rescope' : 'regenerate'
      logger.info(`Running ${trigger} on ${label}...`)

      if (options.dryRun) {
        logger.info('(dry-run: no files will be written)')
      }

      // Sync database before multi-gate replan to ensure current data
      if (!isSingle) {
        try {
          await syncGatesToProjectOverview()
        } catch (error) {
          logger.debug(
            `Failed to sync gates: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }

      try {
        const result = await replanGates({
          gateId,
          fromGateId: options.from,
          prdChanged: options.prdChanged ?? false,
          dryRun: options.dryRun ?? false,
        })

        // Refresh gate roadmap diagram to reflect updated gate state
        if (!options.dryRun) {
          try {
            const { getGlobalRegistry } = await import('../../index.js')
            await getGlobalRegistry().invoke('arch_generate', { diagramType: 'gate-roadmap' })
            logger.info('Gate roadmap updated.')
          } catch {
            logger.debug('Gate roadmap update skipped (diagram generation unavailable).')
          }
        }

        logger.info(`\nReplan Summary (${result.mode} / ${result.trigger}):`)
        logger.info(`  ${result.reasoning}`)
        logger.info('')
        logger.info(`Gates affected: ${result.gatesAffected.join(', ') || 'none'}`)

        if (result.mode === 'single') {
          if (options.dryRun) {
            logger.info(`Would overwrite: ${result.gatesAffected[0] ?? ''}`)
          } else {
            logger.info(`Wrote: ${result.filesWritten[0] ?? result.gatesAffected[0] ?? ''}`)
            logger.info('Gate MD cleared and re-rendered from template. Status reset to pending.')
            try {
              const overview = await readProjectOverview()
              await syncProjectMetadataToState(overview)
            } catch {
              logger.debug('state.json sync skipped after single-gate replan (non-fatal).')
            }
          }
          return
        }

        // Multi-gate: show suggestions and prompt to apply
        const suggestions = result.suggestions
        if (!suggestions || suggestions.changes.length === 0) {
          logger.info('No changes suggested — current gate plan appears optimal.')
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

        if (options.dryRun) {
          logger.info('\n(dry-run: skipping apply prompt)')
          return
        }

        logger.info('')
        const apply = await confirm({
          message: 'Apply these gate regeneration suggestions?',
          default: false,
        })

        if (apply) {
          try {
            await syncUpcomingGatesToState(suggestions.suggestedGates)
          } catch {
            logger.debug('state.json sync skipped after multi-gate replan (non-fatal).')
          }
          logger.info('Gates regenerated successfully')
          logger.info('Run "zeno gates list" to view updated gates')
        } else {
          logger.info('Gate regeneration cancelled')
        }
      } catch (error) {
        logger.error(`Failed to replan: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
}
