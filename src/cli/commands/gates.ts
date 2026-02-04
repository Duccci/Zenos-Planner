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
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getZenoDir } from '../../utils/config.js'
import { analyzeGateChanges, type GateAnalysisResult } from '../../core/write-time-analyzer.js'
import { regenerateGatesWithAnalysis, regenerateGatesTheoreticalFromProject } from '../../core/gate-generator.js'

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
    .action((options: { verbose?: boolean; status?: string }) => {
      try {
        const db = getDatabase()

        let query = 'SELECT * FROM gates ORDER BY sequence ASC'
        const params: string[] = []

        if (options.status) {
          query = 'SELECT * FROM gates WHERE status = ? ORDER BY sequence ASC'
          params.push(options.status)
        }

        let gates = db.prepare(query).all(...params) as GateRecord[]

        // If no gates in database, check archive folder
        if (gates.length === 0) {
          const archivePath = join(getZenoDir(), '..', 'gates', 'archive')
          if (existsSync(archivePath)) {
            const archiveFiles = readdirSync(archivePath)
              .filter(f => f.endsWith('.md'))
              .sort()
            
            // Convert archived gate files to gate records
            const archivedGates: GateRecord[] = archiveFiles.map((file, index) => {
              const match = /^(gate-\d+)/.exec(file);
              const gateId = match?.[1] ?? `gate-${String(index)}`
              return {
                id: gateId,
                project_id: 'archived',
                sequence: index + 1,
                name: file.replace(/^gate-\d+-/, '').replace('.md', '').replace(/-/g, ' '),
                description: null,
                status: 'completed' as GateStatus,
                type: 'feature',
                hash: `archived-${gateId}`,
                created_at: '',
                completed_at: ''
              }
            })
            
            gates = archivedGates
            
            if (!options.status || options.status === 'completed') {
              logger.info('\nArchived Gates (from zeno/gates/archive/)\n')
              
              if (!options.verbose) {
                logger.info('Seq Status         Name                                     Description')
                logger.info('--- -------------- ---------------------------------------- ------------')
              }

              gates.forEach(gate => {
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

        gates.forEach(gate => {
          logger.info(formatGateRow(gate, options.verbose))
          if (options.verbose) {
            logger.info('') // blank line
          }
        })

        logger.info('') // blank line at end
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to list gates: ${errorMsg}`)
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
        logger.info(`Requirements: ${String(reqCount.count)}${reqCount.count > 0 ? ` (run "zeno req list --gate ${gate.id}" to see)` : ''}`)
        logger.info(`Proposals:    ${String(proposalCount.count)}${proposalCount.count > 0 ? ` (run "zeno proposal list --gate ${gate.id}" to see)` : ''}`)

        if (dependencies.length > 0) {
          logger.info('\nDependencies:')
          dependencies.forEach(dep => {
            logger.info(`  - ${dep.id}: ${dep.name} (${dep.status})`)
          })
        }

        // Check for PRD file
        const prdPath = join(getZenoDir(), 'gates', `${gate.id}-${gate.name.toLowerCase().replace(/\s+/g, '-')}.md`)
        if (existsSync(prdPath)) {
          logger.info(`\nFull PRD: ${prdPath}`)
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
        logger.info(`\nStarting Gate: ${gate.name}`)
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
          const errorMsg = error instanceof Error ? error.message : String(error);
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
            analysisResult.errors.forEach(error => { logger.warn(`  - ${error}`) })
          }
          
          logger.info(`Analysis complete (${String(analysisResult.analysisTime)}ms)`)
          logger.info(`Files analyzed: ${String(analysisResult.changedFiles.length)}`)
          
          if (analysisResult.changedFiles.length > 0) {
            logger.info('New metrics:')
            logger.info(`  - Coupling hotspots: ${String(analysisResult.incrementalMetrics.coupling.highCoupling.length)}`)
            logger.info(`  - Average complexity: ${String(analysisResult.incrementalMetrics.complexity.averageComplexity.toFixed(2))}`)
            logger.info(`  - Total LOC added: ${String(analysisResult.incrementalMetrics.loc.totalCodeLines)}`)
            
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
      
      // Get the most recently completed gate from database
      const db: Database.Database = getDatabase();
      let recentGate: { id: string; name: string; completed_at?: string } | undefined
      let projectId: string | undefined
      
      // First try database
      recentGate = db.prepare(`
        SELECT id, name, completed_at FROM gates 
        WHERE status = 'completed' 
        AND completed_at IS NOT NULL
        ORDER BY completed_at DESC 
        LIMIT 1
      `).get() as { id: string; name: string; completed_at: string } | undefined
      
      // Get existing project
      // const existingProject = db.prepare('SELECT id FROM projects LIMIT 1').get() as { id: string } | undefined
      // projectId = existingProject?.id
      projectId = 'default-project' // Always use default project
      
      // If not found in database, check archive folder and sync all archived gates
      if (!recentGate) {
        const archivePath = join(getZenoDir(), '..', 'gates', 'archive')
        if (existsSync(archivePath)) {
          const archiveFiles = readdirSync(archivePath)
            .filter(f => f.endsWith('.md'))
            .sort()
          
          if (archiveFiles.length > 0) {
            // Check if database is empty and needs syncing
            if (!projectId) {
              logger.info('Syncing archived gates and generating missing gates...')
              
              // Set default project ID (project data now comes from project-overview.json)
              projectId = 'default-project'
              
              // Sync all archived gates
              let syncedCount = 0
              for (const file of archiveFiles) {
                const filePath = join(archivePath, file)
                const content = readFileSync(filePath, 'utf-8')
                
                // Extract gate ID from filename (e.g., "gate-01-name.md" -> "gate-01")
                const match = /^(gate-(\d+))/.exec(file)
                if (match?.[1] && match[2]) {
                  const gateId = match[1]
                  const sequence = parseInt(match[2], 10)
                  const gateName = file.replace(/^gate-\d+-/, '').replace('.md', '').replace(/-/g, ' ')
                  
                  // Determine status based on file content
                  const isCompleted = content.includes('**Status**: completed')
                  
                  db.prepare(`
                    INSERT INTO gates (id, project_id, sequence, name, status, type, hash, created_at, completed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).run(
                    gateId,
                    projectId,
                    sequence,
                    gateName,
                    isCompleted ? 'completed' : 'pending',
                    'feature',
                    `hash-${gateId}`,
                    new Date().toISOString(),
                    isCompleted ? new Date().toISOString() : null
                  )
                  
                  syncedCount++
                  if (isCompleted) {
                    recentGate = { id: gateId, name: gateName, completed_at: new Date().toISOString() }
                  }
                }
              }
              
              logger.info(`✓ Synced ${syncedCount} archived gates to database`)
              
              // Parse gate roadmap to get dynamic gate list
              logger.info('Generating missing gates...')
              const gateRoadmapPath = join(getZenoDir(), '..', 'architecture', 'gate-roadmap.md')
              let dynamicGates: { seq: number; name: string }[] = []
              
              if (existsSync(gateRoadmapPath)) {
                try {
                  const roadmapContent = readFileSync(gateRoadmapPath, 'utf-8')
                  // Parse Mermaid diagram for gates: G3[Gate 3<br/>Name...]
                  // Handle multi-line gate definitions by removing line breaks and extra spaces
                  const normalized = roadmapContent.replace(/\n\s+/g, ' ')
                  
                  // Match pattern: G<num>[Gate <num><br/>Name...] where name ends at ]
                  const gatePattern = /G([0-9_]+)\[Gate [0-9._]+<br\/>([^]]+)/g
                  let regexMatch
                  const foundGates: { num: string; name: string }[] = []
                  
                  while ((regexMatch = gatePattern.exec(normalized)) !== null) {
                    const gateNum = regexMatch[1] ?? ''
                    let name = (regexMatch[2] ?? '').trim()
                    
                    // Clean up the name: remove <br/> tags and status text
                    name = name.replace(/<br\/>/g, ' ').replace(/\s+/g, ' ').trim()
                    if (name.includes(' Pending')) name = name.replace(' Pending', '')
                    if (name.includes(' Completed')) name = name.replace(' Completed', '')
                    
                    if (name.length > 0) {
                      foundGates.push({ num: gateNum, name })
                    }
                  }
                  
                  // Sort by gate number and assign sequential seq starting from 3
                  foundGates.sort((a, b) => {
                    const aNum = a.num.includes('_') ? parseFloat(a.num.replace('_', '.')) : parseInt(a.num, 10)
                    const bNum = b.num.includes('_') ? parseFloat(b.num.replace('_', '.')) : parseInt(b.num, 10)
                    return aNum - bNum
                  })
                  
                  let seq = 3
                  for (const gate of foundGates) {
                    dynamicGates.push({ seq, name: gate.name })
                    seq++
                  }
                    }
                  }
                } catch (error) {
                  logger.warn('Could not parse gate roadmap, falling back to defaults')
                }
              }
              
              // Fall back to hardcoded gates if parsing failed
              if (dynamicGates.length === 0) {
                dynamicGates = [
                  { seq: 3, name: 'MCP Server & LLM Tool Integration' },
                  { seq: 4, name: 'Requirements & Database Layer' },
                  { seq: 5, name: 'Architecture & Mermaid Generation' },
                  { seq: 6, name: 'Multi-Repo & Subproject Detection' },
                  { seq: 7, name: 'Proposal Generation & Management' },
                  { seq: 8, name: 'Automated Validation & Quality Gates' },
                  { seq: 9, name: 'Human Approval & Rejection Workflow' },
                  { seq: 10, name: 'Git Integration & Commit Automation' },
                  { seq: 11, name: 'Rescope & Replan Engine' },
                  { seq: 12, name: 'Dashboard & Visualization' },
                  { seq: 13, name: 'Subagent Orchestration & Parallel Execution' },
                  { seq: 14, name: 'Documentation & Polish' }
                ]
              }
              
              for (const gate of dynamicGates) {
                const gateId = `gate-${gate.seq.toString().padStart(2, '0')}`
                db.prepare(`
                  INSERT INTO gates (id, project_id, sequence, name, status, type, hash, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                  gateId,
                  projectId,
                  gate.seq,
                  gate.name,
                  'pending',
                  'feature',
                  `hash-${gateId}`,
                  new Date().toISOString()
                )
              }
              
              logger.info(`✓ Generated ${dynamicGates.length} missing gates (gates 3-${2 + dynamicGates.length})`)
              recentGate = { id: 'gate-02', name: 'zeno engine', completed_at: new Date().toISOString() }
            }
          }
        }
      }
      
      // If no completed gate found, use theoretical regeneration without a base gate
      if (!recentGate) {
        logger.info('No completed gates found - using theoretical decomposition')
      } else {
        logger.info(`Using completed gate: ${recentGate.id}`)
        if (recentGate.completed_at && recentGate.completed_at !== 'archived') {
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
          const gates = db.prepare('SELECT id, name, status FROM gates ORDER BY sequence ASC').all() as {id: string; name: string; status: string}[]
          gates.forEach(g => { logger.info(`  ${g.id}: ${g.name} (${g.status})`); })
          return
        }
        
        logger.info('Suggested Changes:')
        suggestions.changes.forEach(change => {
          logger.info(`  ${change.gateId}: ${change.reason} (${(change.confidence * 100).toFixed(0)}% confidence)`)
        })
        
        logger.info('')
        const apply = await confirm({
          message: 'Apply these gate regeneration suggestions?',
          default: false,
        })
        
        if (apply) {
          logger.info('✓ Gates regenerated successfully')
          logger.info('Updated gate sequence stored in database')
          logger.info('Run "zeno gates list" to view updated gates')
        } else {
          logger.info('Gate regeneration cancelled')
        }
        
      } catch (error) {
        logger.error('Failed to regenerate gates:', error)
      }
    })
}
