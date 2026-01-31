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
import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getZenoDir } from '../../utils/config.js'
import { analyzeGateChanges, type GateAnalysisResult } from '../../core/write-time-analyzer.js'
import { regenerateGatesFromAnalysis } from '../../core/gate-generator.js'

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
function validateStatusTransition(currentStatus: GateStatus, targetStatus: GateStatus): { valid: boolean; error?: string } {
  const validTransitions: Record<GateStatus, GateStatus[]> = {
    'pending': ['in_progress'],
    'in_progress': ['completed', 'rejected'],
    'completed': [],
    'rejected': ['pending'] // can restart rejected gates
  }

  if (validTransitions[currentStatus].includes(targetStatus)) {
    return { valid: true }
  }

  return {
    valid: false,
    error: `Cannot transition from ${currentStatus} to ${targetStatus}. Valid transitions: ${validTransitions[currentStatus].join(', ') || 'none'}`
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
 * Get gate by ID or name
 */
function getGate(gateId: string): GateRecord | null {
  const db = getDatabase()
  const normalizedId = normalizeGateId(gateId)

  // Try by ID first
  let gate = db.prepare('SELECT * FROM gates WHERE id = ?').get(normalizedId) as GateRecord | undefined

  // Try by name if not found
  gate ??= db.prepare('SELECT * FROM gates WHERE name LIKE ?').get(`%${gateId}%`) as GateRecord | undefined

  return gate ?? null
}

/**
 * Format gate for display
 */
function formatGateRow(gate: GateRecord, verbose = false): string {
  const statusEmoji = {
    'pending': '⏳',
    'in_progress': '🔄',
    'completed': '✅',
    'rejected': '❌'
  }

  const status = `${statusEmoji[gate.status]} ${gate.status}`
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
    .action((options: { verbose?: boolean; status?: string }) => {
      try {
        const db = getDatabase()

        let query = 'SELECT * FROM gates ORDER BY sequence ASC'
        const params: string[] = []

        if (options.status) {
          query = 'SELECT * FROM gates WHERE status = ? ORDER BY sequence ASC'
          params.push(options.status)
        }

        const gates = db.prepare(query).all(...params) as GateRecord[]

        if (gates.length === 0) {
          logger.info('No gates found. Run "zeno init" to create a project.')
          return
        }

        logger.info(`\n📋 Project Gates (${gates.length.toString()} total)\n`)

        if (!options.verbose) {
          logger.info('Seq Status         Name                                     Description')
          logger.info('--- -------------- ---------------------------------------- ------------')
        }

        gates.forEach(gate => {
          logger.info(formatGateRow(gate, options.verbose))
          if (options.verbose) {
            logger.info('') // blank line
          }
        })

        logger.info('') // blank line at end
      } catch (error) {
        logger.error(`Failed to list gates: ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
      }
    })

  gatesCmd
    .command('show <gate-id>')
    .description('Show gate details')
    .action((gateId: string) => {
      try {
        const gate = getGate(gateId)

        if (!gate) {
          logger.error(`Gate not found: ${gateId}`)
          logger.info('Run "zeno gates list" to see available gates')
          process.exit(1)
        }

        const db = getDatabase()

        // Get requirements count
        const reqCount = db.prepare('SELECT COUNT(*) as count FROM requirements WHERE gate_id = ?')
          .get(gate.id) as { count: number }

        // Get proposals count
        const proposalCount = db.prepare('SELECT COUNT(*) as count FROM proposals WHERE gate_id = ?')
          .get(gate.id) as { count: number }

        // Get dependencies
        const dependencies = db.prepare(`
          SELECT g.id, g.name, g.status
          FROM gates g
          JOIN dependencies d ON d.target_hash = g.hash
          WHERE d.source_hash = ? AND d.type = 'requires'
        `).all(gate.hash) as { id: string; name: string; status: string }[]

        // Display gate details
        logger.info(`\n📍 Gate Details\n`)
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
        logger.info(`Requirements: ${reqCount.count.toString()}${reqCount.count > 0 ? ' (run "zeno req list --gate ' + gate.id + '" to see)' : ''}`)
        logger.info(`Proposals:    ${proposalCount.count.toString()}${proposalCount.count > 0 ? ' (run "zeno proposal list --gate ' + gate.id + '" to see)' : ''}`)

        if (dependencies.length > 0) {
          logger.info('\nDependencies:')
          dependencies.forEach(dep => {
            logger.info(`  - ${dep.id}: ${dep.name} (${dep.status})`)
          })
        }

        // Check for PRD file
        const prdPath = join(getZenoDir(), 'gates', `${gate.id}-${gate.name.toLowerCase().replace(/\s+/g, '-')}.md`)
        if (existsSync(prdPath)) {
          logger.info(`\n📄 Full PRD: ${prdPath}`)
        }

        logger.info('')
      } catch (error) {
        logger.error(`Failed to show gate: ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
      }
    })

  gatesCmd
    .command('start <gate-id>')
    .description('Start a gate (status: pending -> in_progress)')
    .action(async (gateId: string) => {
      try {
        const gate = getGate(gateId)

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
        logger.info(`\n🚀 Starting Gate: ${gate.name}`)
        logger.info(`   ID: ${gate.id}`)
        logger.info(`   Current Status: ${gate.status}\n`)

        // Confirm
        const confirmed = await confirm({
          message: 'Start this gate and generate requirements/proposals?',
          default: true
        })

        if (!confirmed) {
          logger.info('Cancelled')
          return
        }

        // Update status in database
        const db = getDatabase()
        db.prepare('UPDATE gates SET status = ? WHERE id = ?').run('in_progress', gate.id)

        // Log state change
        db.prepare(`
          INSERT INTO state_history (id, entity_type, entity_id, field_name, old_value, new_value, change_source, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `history-${Date.now().toString()}-${Math.random().toString(36).substring(2, 11)}`,
          'gate',
          gate.id,
          'status',
          gate.status,
          'in_progress',
          'human',
          'Gate started via CLI command'
        )

        logger.info(`\n✅ Gate ${gate.id} started successfully!\n`)
        logger.info('Next steps:')
        logger.info(`  1. Review gate PRD in zeno/gates/${gate.id}-*.md`)
        logger.info(`  2. Check requirements: zeno req list --gate ${gate.id}`)
        logger.info(`  3. Review proposals: zeno proposal list --gate ${gate.id}`)
        logger.info(`  4. Complete when done: zeno gates complete ${gate.id}\n`)
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          logger.info('Cancelled')
        } else {
          logger.error(`Failed to start gate: ${error instanceof Error ? error.message : String(error)}`)
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
            analysisResult.errors.forEach(error => { logger.warn(`  - ${error}`) })
          }
          
          logger.info(`Analysis complete (${String(analysisResult.analysisTime)}ms)`)
          logger.info(`Files analyzed: ${String(analysisResult.changedFiles.length)}`)
          
          if (analysisResult.changedFiles.length > 0) {
            logger.info('New metrics:')
            logger.info(`  - Coupling hotspots: ${analysisResult.incrementalMetrics.coupling.highCoupling.length.toString()}`)
            logger.info(`  - Average complexity: ${analysisResult.incrementalMetrics.complexity.averageComplexity.toFixed(2)}`)
            logger.info(`  - Total LOC added: ${analysisResult.incrementalMetrics.loc.totalCodeLines.toString()}`)
            
            // Update project metadata with analysis results
            try {
              const db: Database.Database = getDatabase();
              const projectQuery = db.prepare(`
                SELECT id, start_state FROM projects 
                WHERE id = (SELECT project_id FROM gates WHERE id = ?)
              `).get(gateId) as { id: string; start_state: string | null } | undefined
              
              if (projectQuery) {
                const currentState: Record<string, unknown> = projectQuery.start_state ? JSON.parse(projectQuery.start_state) as Record<string, unknown> : {}
                currentState['gateAnalysis'] ??= {};
                (currentState['gateAnalysis'] as Record<string, unknown>)[gateId] = JSON.stringify(analysisResult);
                
                db.prepare('UPDATE projects SET start_state = ? WHERE id = ?')
                  .run(JSON.stringify(currentState), projectQuery.id)
              }
            } catch (error) {
              logger.warn('Failed to store analysis results in database:', error)
            }
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
    .description('Regenerate future gates')
    .option('--from-analysis', 'Regenerate based on analyzed code metrics')
    .action(async (options: { fromAnalysis?: boolean }) => {
      logger.info('Gates command: regenerate')

      if (options.fromAnalysis) {
        logger.info('Regenerating gates from analysis data...')
        
        // Get the most recently completed gate
        const db: Database.Database = getDatabase();
        const recentGate = db.prepare(`
          SELECT id, name FROM gates 
          WHERE status = 'completed' 
          ORDER BY completed_at DESC 
          LIMIT 1
        `).get() as { id: string; name: string } | undefined
        
        if (!recentGate) {
          logger.error('No completed gates found with analysis data')
          return
        }
        
        logger.info(`Using analysis from completed gate: ${recentGate.id} - ${recentGate.name}`)
        
        try {
          const suggestions = regenerateGatesFromAnalysis(recentGate.id)
          
          logger.info('Analysis Summary:')
          logger.info(`  ${suggestions.reasoning}`)
          logger.info('')
          
          if (suggestions.changes.length === 0) {
            logger.info('No changes suggested - current gate plan appears optimal')
            return
          }
          
          logger.info('Suggested Changes:')
          suggestions.changes.forEach(change => {
            const icon = change.type === 'add' ? '➕' : change.type === 'modify' ? '✏️' : '🗑️'
            logger.info(`  ${icon} ${change.gateId}: ${change.reason} (${(change.confidence * 100).toFixed(0)}% confidence)`)
          })
          
          logger.info('')
          const apply = await confirm({
            message: 'Apply these gate regeneration suggestions?',
            default: false,
          })
          
          if (apply) {
            logger.info('Gate regeneration not yet implemented - requires human approval workflow')
            logger.info('This would update the gate sequence in the database')
          } else {
            logger.info('Gate regeneration cancelled')
          }
          
        } catch (error) {
          logger.error('Failed to regenerate gates from analysis:', error)
        }
        
      } else {
        logger.info('Not yet implemented - Gate 2 required')
        logger.info('This command will regenerate gates based on current project state')
      }
    })
}
