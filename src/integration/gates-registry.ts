/**
 * Gate Operations Registry
 *
 * Registers all gate-related operations with the function registry.
 * Handles: list, show, start, complete, regenerate
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { normalizeGateId, resolveGateIdentifier } from '../utils/normalize.js'
import { listArchivedGates } from '../utils/gate-consolidation.js'
import { resolveLastUpdated } from '../utils/datetime.js'

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getZenoDir, getWorkspaceRoot } from '../utils/config.js'

// Install-relative directory so templates are found regardless of the user's CWD.
const __installDir = fileURLToPath(new URL('../..', import.meta.url))
import { normalizePath } from '../utils/file.js'

export function registerGatesOps(registry: FunctionRegistry): void {
  // In-process implementation for listing gates (faster than spawning CLI)

  registry.register(
    'gates_list',
    async () => {
      const { readProjectOverview, getGatesFromOverview } = await import('../utils/config.js')

      let summaries: Awaited<ReturnType<typeof getGatesFromOverview>>

      try {
        const overview = await readProjectOverview()
        summaries = getGatesFromOverview(overview)
      } catch {
        // project.json unavailable — fall back to archive files
        const archivePath = join(getZenoDir(), '..', 'gates', 'archive')
        const archivedGateList = listArchivedGates(archivePath)
        summaries = archivedGateList.map((g, index) => ({
          id: g.id,
          sequence: index + 1,
          name: g.name,
          status: 'completed' as const,
          hash: `archived-${g.id}`,
          completedAt: null,
        }))
      }

      const now = new Date().toISOString()

      // Fetch prd_generated_at from DB for all gates in one query
      const prdGeneratedMap: Record<string, boolean> = {}
      const descriptionMap: Record<string, string> = {}
      try {
        const db = (await import('../storage/database.js')).getDatabase()
        const dbRows = db
          .prepare('SELECT id, description, prd_generated_at FROM gates')
          .all() as { id: string; description: string | null; prd_generated_at: string | null }[]
        for (const row of dbRows) {
          prdGeneratedMap[row.id] = row.prd_generated_at !== null
          if (row.description) descriptionMap[row.id] = row.description
        }
      } catch {
        // DB unavailable — default all to true (unknown) to avoid false alarms
        for (const g of summaries) prdGeneratedMap[g.id] = true
      }

      // Build milestones map by scanning gate MD frontmatter (milestones live only in MD files)
      const milestonesMap: Record<string, (number | string)[]> = {}
      try {
        const { readdirSync, readFileSync } = await import('node:fs')
        const { parseGateFrontmatter } = await import('../storage/frontmatter.js')
        const gatesDir = join(getZenoDir(), '..', 'gates')
        const files = readdirSync(gatesDir).filter(
          (f: string) => f.endsWith('.md') && /^gate-\d+/.test(f)
        )
        for (const file of files) {
          try {
            const content = readFileSync(join(gatesDir, file), 'utf-8')
            const fm = parseGateFrontmatter(content)
            if (fm?.id && fm.milestones && fm.milestones.length > 0) {
              milestonesMap[fm.id] = fm.milestones
            } else if (fm?.id) {
              // Body-field fallback: **Milestones**: MVP, 2
              const bodyMatch = /\*\*Milestones\*\*:\s*(.+)$/m.exec(content)
              if (bodyMatch?.[1]) {
                milestonesMap[fm.id] = bodyMatch[1]
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length > 0)
                  .map((s: string) => (/^\d+$/.test(s) ? parseInt(s, 10) : s))
              }
            }
          } catch {
            // skip unreadable files
          }
        }
      } catch {
        // gates dir unavailable — milestones simply omitted
      }

      return {
        gates: summaries.map((g) => ({
          id: g.id,
          hash: g.hash,
          name: g.name,
          description: descriptionMap[g.id] ?? 'No description',
          sequence: g.sequence,
          status: g.status,
          milestones: milestonesMap[g.id],
          lastUpdated: resolveLastUpdated(g.completedAt, now),
          prdGenerated: prdGeneratedMap[g.id] ?? true,
          proposalCount: 0,
          completedProposalCount: 0,
          requirementCount: 0,
          testedRequirementCount: 0,
        })),
      }
    },
    {
      description: 'List all gates in the project with their status',
      parameters: [],
      returnType: 'GatesListOutput',
      schema: z.object({}),
    }
  )

  // In-process implementation for showing a gate's details

  registry.register(
    'gates_show',
    async (params) => {
      const validated = z.object({ gateId: z.string() }).parse(params)
      const { readProjectOverview, getGatesFromOverview } = await import('../utils/config.js')

      // Resolve hash or normalize textual ID: accept hash, gate-01, or 01
      const normalizedId = resolveGateIdentifier(validated.gateId)

      const overview = await readProjectOverview()
      const summaries = getGatesFromOverview(overview)
      const gate =
        summaries.find((g) => g.id === normalizedId) ??
        summaries.find((g) => g.name.toLowerCase().includes(validated.gateId.toLowerCase()))

      if (!gate) {
        throw new Error(`Gate not found: ${validated.gateId}`)
      }

      const now = new Date().toISOString()

      // Parse objectives, description, and phases from gate PRD file
      const objectives: { title: string; completed: boolean }[] = []
      let description = 'No description'
      let milestones: (number | string)[] | undefined

      try {
        const { findGateByGateId } = await import('../utils/artifact-locator.js')
        const { readFile } = await import('node:fs/promises')
        const gatePath = await findGateByGateId(normalizedId)
        if (gatePath) {
          const content = await readFile(gatePath, 'utf-8')

          // Parse milestones from frontmatter (authoritative), fallback to body field
          const { parseGateFrontmatter } = await import('../storage/frontmatter.js')
          const fm = parseGateFrontmatter(content)
          if (fm?.milestones && fm.milestones.length > 0) {
            milestones = fm.milestones
          } else {
            // Body-field fallback: **Milestones**: MVP, 2
            const milestonesBodyMatch = /\*\*Milestones\*\*:\s*(.+)$/m.exec(content)
            if (milestonesBodyMatch?.[1]) {
              milestones = milestonesBodyMatch[1]
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
                .map((s) => (/^\d+$/.test(s) ? parseInt(s, 10) : s))
            }
          }

          // Parse description from ## Overview section (first non-empty line)
          const overviewMatch = /## Overview\s*\n([\s\S]*?)(?=\n## )/m.exec(content)
          if (overviewMatch?.[1]) {
            const firstLine = overviewMatch[1].split('\n').find((l) => l.trim().length > 0)
            if (firstLine) description = firstLine.trim()
          }

          // Parse objectives from ## Objectives section — capture all - [ ] / - [x] items
          const objectivesMatch = /## Objectives\s*\n([\s\S]*?)(?=\n## )/m.exec(content)
          if (objectivesMatch?.[1]) {
            for (const line of objectivesMatch[1].split('\n')) {
              const pending = /^- \[ \] (.+)$/.exec(line.trim())
              const done = /^- \[x\] (.+)$/i.exec(line.trim())
              if (pending?.[1]) objectives.push({ title: pending[1].trim(), completed: false })
              else if (done?.[1]) objectives.push({ title: done[1].trim(), completed: true })
            }
          }
        }
      } catch {
        // File unavailable — fall back to empty objectives/milestones
      }

      // Query gate-level requirements from the database
      let requirements: { hash: string; title: string; status: 'pending' | 'in_progress' | 'tested' | 'archived'; priority?: 'low' | 'medium' | 'high' }[] = []
      try {
        const { RequirementStorage } = await import('../generation/requirement-storage.js')
        const storage = new RequirementStorage()
        const graph = storage.buildRequirementGraph(normalizedId)
        requirements = Array.from(graph.nodes.values()).map((n) => ({
          hash: n.hash,
          title: n.title,
          status: 'pending' as const,
        }))
      } catch {
        // DB unavailable — fall back to empty requirements
      }

      // Query proposals for this gate from the database
      interface ProposalRow { hash: string; title: string | null; status: string | null }
      let proposals: { hash: string; title: string; status: 'pending' | 'in_progress' | 'completed' | 'archived' | 'rejected' | 'cancelled' | 'backlog'; tasksCompleted: number; totalTasks: number }[] = []
      try {
        const { getDatabase } = await import('../storage/database.js')
        const { syncProposalsFromDisk } = await import('../storage/proposal-sync.js')
        const db = getDatabase()
        syncProposalsFromDisk(db)
        const rows = db
          .prepare('SELECT hash, title, status FROM proposals WHERE gate_id LIKE ? ORDER BY created_at DESC')
          .all(`%${normalizedId}%`) as ProposalRow[]
        const validStatuses = new Set(['pending', 'in_progress', 'completed', 'archived', 'rejected', 'cancelled', 'backlog'])
        proposals = rows
          .filter((r) => r.hash)
          .map((r) => ({
            hash: r.hash,
            title: r.title ?? '',
            status: (validStatuses.has(r.status ?? '') ? r.status : 'pending') as typeof proposals[0]['status'],
            tasksCompleted: 0,
            totalTasks: 0,
          }))
      } catch {
        // DB unavailable — fall back to empty proposals
      }

      // DB is authoritative for lifecycle state. Use DB status for all non-pending
      // states. For 'pending', the overview may carry more granularity (e.g. the
      // gate was never touched since init), so fall back to the overview value.
      let effectiveStatus: typeof gate.status = gate.status
      let effectiveCompletedAt: string | null = gate.completedAt
      let prdGenerated = true // default: assume generated unless DB says otherwise
      try {
        const { getDatabase } = await import('../storage/database.js')
        const dbRow = getDatabase()
          .prepare('SELECT status, completed_at, description, prd_generated_at FROM gates WHERE id = ?')
          .get(normalizedId) as { status: string; completed_at: string | null; description: string | null; prd_generated_at: string | null } | undefined
        if (dbRow) {
          if (dbRow.status !== 'pending') {
            // DB has a lifecycle state that overrides the overview value.
            effectiveStatus = dbRow.status as typeof gate.status
            effectiveCompletedAt = dbRow.completed_at
          }
          prdGenerated = dbRow.prd_generated_at !== null
          // Use DB description (goal statement) as fallback when MD file has none
          if (description === 'No description' && dbRow.description) {
            description = dbRow.description
          }
        }
      } catch {
        // DB unavailable — use overview-derived status
      }

      return {
        id: gate.id,
        hash: gate.hash,
        name: gate.name,
        description,
        sequence: gate.sequence,
        status: effectiveStatus,
        milestones,
        prdGenerated,
        objectives,
        requirements,
        proposals,
        lastUpdated: resolveLastUpdated(effectiveCompletedAt, now),
      }
    },
    {
      description: 'Show detailed information about a specific gate',
      parameters: [
        {
          name: 'gateId',
          type: 'string',
          description: 'Gate hash (preferred, use hash field from gates_list) or gate ID (e.g., "gate-01")',
          required: true,
        },
      ],
      returnType: 'GateDetails',
      schema: z.object({
        gateId: z.string().min(1, 'Gate ID is required'),
      }),
    }
  )

  registry.register(
    'gates_set_validated',
    async (params) => {
      const validated = z.object({ gateId: z.string() }).parse(params)
      const normalizedId = resolveGateIdentifier(validated.gateId)
      const db = (await import('../storage/database.js')).getDatabase()
      db.prepare(`UPDATE gates SET status = 'validated' WHERE id = ?`).run(normalizedId)
      // Update project.json directly — the DB is a read-only cache and must not write back to files.
      const { readProjectOverview, saveProjectOverview } = await import('../utils/config.js')
      const overview = await readProjectOverview()
      const gate = overview.gates.find((g) => g.id === normalizedId)
      if (gate) {
        gate.status = 'validated'
        overview.lastUpdated = new Date().toISOString()
        await saveProjectOverview(overview)
      }
      return { gateId: normalizedId, newStatus: 'validated' as const }
    },
    {
      description: 'Advance a gate status to validated after structural checks pass',
      parameters: [
        {
          name: 'gateId',
          type: 'string',
          description: 'The ID of the gate to mark as validated',
          required: true,
        },
      ],
      returnType: 'void',
      schema: z.object({
        gateId: z.string().min(1, 'Gate ID is required'),
      }),
    }
  )

  registry.register(
    'gates_start',
    async (params) => {
      const validated = z.object({ gateId: z.string(), startedBy: z.string().optional() }).parse(params)

      const { getGitUserInfo } = await import('../utils/git.js')

      // Pull git user info if not provided
      let startedBy = validated.startedBy
      if (!startedBy) {
        try {
          const gitUser = await getGitUserInfo(getWorkspaceRoot())
          startedBy = gitUser.name ?? gitUser.email ?? undefined
        } catch {
          // Silently ignore git user pull errors; startedBy remains optional
        }
      }

      const { startGate } = await import('../core/completions.js')
      const db = (await import('../storage/database.js')).getDatabase()
      const normalizedId = resolveGateIdentifier(validated.gateId)
      const gateRow = db
        .prepare('SELECT status FROM gates WHERE id = ?')
        .get(normalizedId) as { status?: string } | undefined
      const previousStatus = (gateRow?.status ?? 'pending') as 'pending' | 'validated' | 'in_progress' | 'completed' | 'rejected' | 'cancelled' | 'backlog'
      await startGate(normalizedId, { startedBy })

      return {
        gateId: normalizedId,
        previousStatus,
        newStatus: 'in_progress' as const,
        startedAt: new Date().toISOString(),
      }
    },
    {
      description: 'Start working on a gate (changes status from validated to in_progress)',
      parameters: [
        {
          name: 'gateId',
          type: 'string',
          description: 'The ID of the gate to start',
          required: true,
        },
      ],
      returnType: 'void',
      schema: z.object({
        gateId: z.string().min(1, 'Gate ID is required'),
      }),
    }
  )

  registry.register(
    'gates_complete',
    async (params) => {
      const validated = z
        .object({ gateId: z.string(), completedBy: z.string().optional() })
        .parse(params)

      const { getGitUserInfo } = await import('../utils/git.js')

      // Pull git user info if not provided
      let completedBy = validated.completedBy
      if (!completedBy) {
        try {
          const gitUser = await getGitUserInfo(getWorkspaceRoot())
          completedBy = gitUser.name ?? gitUser.email ?? undefined
        } catch {
          // Silently ignore git user pull errors; completedBy remains optional
        }
      }

      const { completeGate } = await import('../core/completions.js')
      const normalizedId = resolveGateIdentifier(validated.gateId)
      const result = await completeGate(normalizedId)
      return {
        gateId: normalizedId,
        previousStatus: 'in_progress' as const,
        newStatus: 'completed' as const,
        completedAt: new Date().toISOString(),
        summary: {
          proposalsCompleted: 0,
          requirementsTested: 0,
        },
        gitInstructions: result.gitInstructions,
      }
    },
    {
      description: 'Mark a gate as completed and create a release tag',
      parameters: [
        {
          name: 'gateId',
          type: 'string',
          description: 'The ID of the gate to complete',
          required: true,
        },
      ],
      returnType: 'void',
      schema: z.object({
        gateId: z.string().min(1, 'Gate ID is required'),
      }),
    }
  )

  registry.register(
    'gates_regenerate',
    async (params) => {
      const { replanGates } = await import('../core/gate-generator.js')
      const validated = z.object({
        gateId: z.string().optional(),
        fromGateId: z.string().optional(),
        prdChanged: z.boolean().optional(),
        dryRun: z.boolean().optional(),
      }).parse(params)

      const result = await replanGates({
        gateId: validated.gateId ? resolveGateIdentifier(validated.gateId) : undefined,
        fromGateId: validated.fromGateId ? resolveGateIdentifier(validated.fromGateId) : undefined,
        prdChanged: validated.prdChanged ?? false,
        dryRun: validated.dryRun ?? false,
      })

      // Refresh gate roadmap diagram to reflect updated gate state
      if (!validated.dryRun) {
        try {
          await registry.invoke('arch_generate', { diagramType: 'gate-roadmap' })
        } catch {
          // Non-fatal: roadmap update failure must not fail the replan
        }

        // Sync project.json: multi-gate syncs upcomingGates from the suggestions returned to the caller.
        try {
          const { syncUpcomingGatesToState } = await import('../utils/state-sync.js')
          if (result.suggestions) {
            await syncUpcomingGatesToState(result.suggestions.suggestedGates)
          }
        } catch {
          // Non-fatal: project.json sync failure must not fail the replan
        }
      }

      return {
        mode: result.mode,
        status: 'regenerated' as const,
        changes: {
          gatesAffected: result.gatesAffected,
          proposalsGenerated: 0,
          requirementsAttributed: 0,
          summary: result.reasoning,
        },
      }
    },
    {
      description:
        'Unified replan: regenerate future gates or clear+re-render a single gate from template. ' +
        'Pass gateId to target a single gate; omit for full/partial multi-gate replan. ' +
        'Set prdChanged=true to signal a rescope (PRD end-state changed).',
      parameters: [
        { name: 'gateId', type: 'string', description: 'Single-gate mode: clear and re-render this gate\'s MD', required: false },
        { name: 'fromGateId', type: 'string', description: 'Multi-gate baseline (auto-detected if omitted)', required: false },
        { name: 'prdChanged', type: 'boolean', description: 'Rescope signal: PRD end-state has changed', required: false },
        { name: 'dryRun', type: 'boolean', description: 'Return plan without writing files', required: false },
      ],
      returnType: 'GatesRegenerateOutput',
      schema: z.object({
        gateId: z.string().optional(),
        fromGateId: z.string().optional(),
        prdChanged: z.boolean().optional(),
        dryRun: z.boolean().optional(),
      }),
    }
  )

  registry.register(
    'gate_cancel',
    async (params) => {
      const validated = z.object({ gateId: z.string(), reason: z.string().optional() }).parse(params)
      const { readProjectOverview, saveProjectOverview } = await import('../utils/config.js')
      const normalizedId = resolveGateIdentifier(validated.gateId)
      const seqMatch = /\d+/.exec(normalizedId)
      const seq = seqMatch ? parseInt(seqMatch[0], 10) : null

      const overview = await readProjectOverview()

      // Find gate in unified gates array
      const gateIdx = overview.gates.findIndex(
        (g) => g.id === normalizedId || g.sequence === seq
      )
      const gate = overview.gates[gateIdx]
      if (!gate || gate.status === 'completed' || gate.status === 'cancelled') {
        throw new Error(`Gate not found or already completed/cancelled: ${validated.gateId}`)
      }

      const previousStatus = gate.status
      const cancelledAt = new Date().toISOString()

      gate.status = 'cancelled'
      gate.cancelledAt = cancelledAt

      await saveProjectOverview(overview)

      return { gateId: normalizedId, previousStatus, newStatus: 'cancelled', cancelledAt, reason: validated.reason }
    },
    {
      description: 'Cancel a gate (mark as cancelled/dropped from roadmap)',
      parameters: [
        { name: 'gateId', type: 'string', description: 'The ID of the gate to cancel', required: true },
        { name: 'reason', type: 'string', description: 'Optional reason for cancellation', required: false },
      ],
      returnType: 'GatesCancelOutput',
      schema: z.object({ gateId: z.string(), reason: z.string().optional() }),
    }
  )

  registry.register(
    'gate_defer',
    async (params) => {
      const validated = z.object({ gateId: z.string(), reason: z.string().optional() }).parse(params)
      const { readProjectOverview, saveProjectOverview } = await import('../utils/config.js')
      const normalizedId = resolveGateIdentifier(validated.gateId)
      const seqMatch = /\d+/.exec(normalizedId)
      const seq = seqMatch ? parseInt(seqMatch[0], 10) : null

      const overview = await readProjectOverview()

      // Find gate in unified gates array
      const gateIdx = overview.gates.findIndex(
        (g) => g.id === normalizedId || g.sequence === seq
      )
      const gate = overview.gates[gateIdx]
      if (!gate || gate.status === 'completed' || gate.status === 'cancelled') {
        throw new Error(`Gate not found or already completed/cancelled: ${validated.gateId}`)
      }

      const previousStatus = gate.status

      gate.status = 'backlog'

      await saveProjectOverview(overview)

      const deferredAt = new Date().toISOString()
      return { gateId: normalizedId, previousStatus, newStatus: 'backlog', deferredAt, reason: validated.reason }
    },
    {
      description: 'Defer a gate to backlog (off main implementation path, revisit later)',
      parameters: [
        { name: 'gateId', type: 'string', description: 'The ID of the gate to defer', required: true },
        { name: 'reason', type: 'string', description: 'Optional reason for deferral', required: false },
      ],
      returnType: 'GatesDeferOutput',
      schema: z.object({ gateId: z.string(), reason: z.string().optional() }),
    }
  )

  // Gate planning (pre-PRD registration)

  registry.register(
    'gate_plan',
    async (params) => {
      const { GatePlanInputSchema } = await import('../mcp/schemas/gate-create-schemas.js')
      const validated = GatePlanInputSchema.parse(params)

      const { hashObject } = await import('../utils/hash.js')
      const db = (await import('../storage/database.js')).getDatabase()
      const normalizedId = normalizeGateId(validated.gateId)

      const existing = db.prepare('SELECT id, hash FROM gates WHERE id = ?').get(normalizedId) as
        | { id: string; hash: string }
        | undefined

      const now = new Date().toISOString()
      const hash =
        existing?.hash ??
        hashObject({ id: normalizedId, name: validated.name, sequence: validated.sequence })

      if (existing) {
        // Update name and goal without touching prd_generated_at
        db.prepare(
          'UPDATE gates SET name = ?, description = ?, depends_on = ? WHERE id = ?'
        ).run(
          validated.name,
          validated.goal,
          validated.dependencies.length > 0 ? JSON.stringify(validated.dependencies) : null,
          normalizedId
        )
      } else {
        db.prepare(
          `INSERT INTO gates
             (id, project_id, sequence, name, description, status, depends_on, hash, created_at, prd_generated_at)
           VALUES (?, 'default-project', ?, ?, ?, 'pending', ?, ?, ?, NULL)`
        ).run(
          normalizedId,
          validated.sequence,
          validated.name,
          validated.goal,
          validated.dependencies.length > 0 ? JSON.stringify(validated.dependencies) : null,
          hash,
          now
        )
      }

      // Persist to project.json (git-tracked) so name + goal survive DB regeneration
      const { upsertPlannedGateInState } = await import('../utils/state-sync.js')
      await upsertPlannedGateInState(normalizedId, validated.name, validated.goal, validated.sequence, hash)

      // Sync to project.json so the planned gate appears in gates_list
      const { syncGatesToProjectOverview } = await import('../utils/gate-sync.js')
      await syncGatesToProjectOverview().catch(() => { /* best-effort */ })

      return {
        gateId: normalizedId,
        hash,
        alreadyExisted: existing !== undefined,
        createdAt: now,
      }
    },
    {
      description:
        'Register a gate name and goal statement before generating its PRD markdown file. ' +
        'Stores the gate intent in the database without writing any file, deferring full PRD ' +
        'generation until the gate is about to be implemented.',
      parameters: [
        {
          name: 'gateId',
          type: 'string',
          description: 'Gate ID (e.g., "gate-03")',
          required: true,
        },
        {
          name: 'name',
          type: 'string',
          description: 'Human-readable gate name',
          required: true,
        },
        {
          name: 'goal',
          type: 'string',
          description: 'Short project statement defining the main goal of the gate (1–3 sentences)',
          required: true,
        },
        {
          name: 'sequence',
          type: 'number',
          description: 'Gate sequence number',
          required: true,
        },
        {
          name: 'dependencies',
          type: 'array',
          description: 'Array of gate IDs that must complete first',
          required: false,
        },
      ],
      returnType: 'GatePlanOutput',
      schema: z.object({
        gateId: z.string(),
        name: z.string(),
        goal: z.string(),
        sequence: z.number(),
        dependencies: z.array(z.string()).optional(),
      }),
    }
  )

  // Gate creation

  registry.register(
    'gate_create',
    async (params) => {
      const { GateCreateInputSchema } = await import('../mcp/schemas/gate-create-schemas.js')
      const validated = GateCreateInputSchema.parse(params)

      // Validation errors and warnings
      const errors: string[] = []
      const warnings: string[] = []

      // Check for duplicate ID
      const db = (await import('../storage/database.js')).getDatabase()
      const existing = db.prepare('SELECT id FROM gates WHERE id = ?').get(validated.gateId)
      if (existing) {
        errors.push(`Gate ID ${validated.gateId} already exists`)
      }

      // Check dependencies exist
      for (const depId of validated.dependencies) {
        const dep = db.prepare('SELECT id FROM gates WHERE id = ?').get(depId)
        if (!dep) {
          warnings.push(`Dependency gate not found: ${depId}`)
        }
      }

      // If validation failed, return early
      if (errors.length > 0) {
        return {
          gateId: validated.gateId,
          filePath: '',
          validation: {
            passed: false,
            errors,
            warnings,
          },
          roadmapUpdated: false,
          createdAt: new Date().toISOString(),
        }
      }

      // Generate gate file content from template
      const { readFile } = await import('fs/promises')
      const { join } = await import('path')

      const templatePath = join(__installDir, 'templates', 'md-templates', 'gate-prd-template.md')
      let gateContent = await readFile(templatePath, 'utf-8')

      // Replace template placeholders
      const gateNumber = /\d+/.exec(validated.gateId)?.[0] ?? '00'
      const today = new Date().toISOString().split('T')[0] ?? new Date().toISOString()
      gateContent = gateContent
        .replace(/\[XX\]/g, gateNumber)
        .replace(/\[Gate Name\]/g, validated.name)
        .replace(/\[YYYY-MM-DD\]/g, today)
        .replace(/\[hash\]/g, `temp-${validated.gateId}`)

      // Add objectives
      const objectivesList = validated.objectives.map((obj) => `- [ ] ${obj}`).join('\n')
      gateContent = gateContent.replace(
        /- \[ \] \[Objective with measurable outcome\]\n- \[ \] \[Objective with measurable outcome\]\n- \[ \] \[Objective with measurable outcome\]/,
        objectivesList
      )

      // Write gate file
      const fileName = `gate-${gateNumber.padStart(2, '0')}-${validated.name.replace(/\s+/g, '-').toLowerCase()}.md`
      const filePath = normalizePath(join(getWorkspaceRoot(), 'zeno', 'gates', fileName))

      const { writeFile } = await import('../utils/file.js')
      await writeFile(filePath, gateContent, 'utf-8')

      // Persist gate to DB and stamp prd_generated_at.
      // If a gate_plan row already exists, update it; otherwise insert fresh.
      const now = new Date().toISOString()
      const { hashObject } = await import('../utils/hash.js')
      const normalizedCreateId = normalizeGateId(validated.gateId)
      const existingRow = db
        .prepare('SELECT id FROM gates WHERE id = ?')
        .get(normalizedCreateId) as { id: string } | undefined

      if (existingRow) {
        db.prepare(
          'UPDATE gates SET name = ?, description = ?, prd_generated_at = ? WHERE id = ?'
        ).run(
          validated.name,
          validated.description ?? null,
          now,
          normalizedCreateId
        )
      } else {
        const gateHash = hashObject({
          id: normalizedCreateId,
          name: validated.name,
          sequence: validated.sequence,
        })
        db.prepare(
          `INSERT INTO gates
             (id, project_id, sequence, name, description, status, depends_on, hash, created_at, prd_generated_at)
           VALUES (?, 'default-project', ?, ?, ?, 'pending', ?, ?, ?, ?)`
        ).run(
          normalizedCreateId,
          validated.sequence,
          validated.name,
          validated.description ?? null,
          validated.dependencies.length > 0 ? JSON.stringify(validated.dependencies) : null,
          gateHash,
          now,
          now
        )
      }

      // Sync to project.json
      const { syncGatesToProjectOverview } = await import('../utils/gate-sync.js')
      await syncGatesToProjectOverview().catch(() => { /* best-effort */ })

      // Mark prdGenerated in project.json (git-tracked) so registry rebuild knows
      // the MD file exists and syncGatesFromDisk can handle it from here on
      const { markPrdGeneratedInState } = await import('../utils/state-sync.js')
      await markPrdGeneratedInState(normalizedCreateId).catch(() => { /* best-effort */ })

      // TODO: Update gate-roadmap.md (deferred to full implementation)
      const roadmapUpdated = false

      return {
        gateId: validated.gateId,
        filePath,
        validation: {
          passed: true,
          errors: [],
          warnings,
        },
        roadmapUpdated,
        createdAt: now,
      }
    },
    {
      description:
        'Create a new gate PRD file. Validates gate structure, writes to zeno/gates/, and optionally updates gate-roadmap.md',
      parameters: [
        {
          name: 'gateId',
          type: 'string',
          description: 'Gate ID (e.g., "gate-03")',
          required: true,
        },
        {
          name: 'name',
          type: 'string',
          description: 'Human-readable gate name',
          required: true,
        },
        {
          name: 'sequence',
          type: 'number',
          description: 'Gate sequence number',
          required: true,
        },
        {
          name: 'dependencies',
          type: 'array',
          description: 'Array of gate IDs that must complete first',
          required: false,
        },
        {
          name: 'objectives',
          type: 'array',
          description: 'Array of gate objectives (goals to achieve)',
          required: true,
        },
        {
          name: 'description',
          type: 'string',
          description: 'Optional gate description',
          required: false,
        },
      ],
      returnType: 'GateCreateOutput',
      schema: z.object({
        gateId: z.string(),
        name: z.string(),
        type: z.string(),
        sequence: z.number(),
        dependencies: z.array(z.string()).optional(),
        objectives: z.array(z.string()),
        description: z.string().optional(),
      }),
    }
  )
}
