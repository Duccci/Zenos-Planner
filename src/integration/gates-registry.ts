/**
 * Gate Operations Registry
 *
 * Registers all gate-related operations with the function registry.
 * Handles: list, show, start, complete, regenerate
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { normalizeGateId } from '../utils/normalize.js'
import { listArchivedGates } from '../utils/gate-consolidation.js'
import { resolveLastUpdated } from '../utils/datetime.js'

import { join } from 'node:path'
import { getZenoDir } from '../utils/config.js'
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
        // project-overview.json unavailable — fall back to archive files
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
      return {
        gates: summaries.map((g) => ({
          id: g.id,
          name: g.name,
          description: 'No description',
          sequence: g.sequence,
          status: g.status,
          type: 'feature',
          lastUpdated: resolveLastUpdated(g.completedAt, now),
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

      // Normalize id: accept gate-01 or 01
      const normalizedId = normalizeGateId(validated.gateId)

      const overview = await readProjectOverview()
      const summaries = getGatesFromOverview(overview)
      const gate =
        summaries.find((g) => g.id === normalizedId) ??
        summaries.find((g) => g.name.toLowerCase().includes(validated.gateId.toLowerCase()))

      if (!gate) {
        throw new Error(`Gate not found: ${validated.gateId}`)
      }

      const now = new Date().toISOString()

      // Parse objectives and description from gate PRD file
      const objectives: { title: string; completed: boolean }[] = []
      let description = 'No description'

      try {
        const { findGateByGateId } = await import('../utils/artifact-locator.js')
        const { readFile } = await import('node:fs/promises')
        const gatePath = await findGateByGateId(normalizedId)
        if (gatePath) {
          const content = await readFile(gatePath, 'utf-8')

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
        // File unavailable — fall back to empty objectives
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

      // DB is authoritative for lifecycle state (see gate-sync.ts).
      // The overview file can lag behind (e.g. DB has 'completed' but
      // overview still lists the gate under currentGateInfo as 'in_progress').
      // Override status and completedAt for states the DB owns exclusively:
      //   in_progress, completed, rejected.
      // Leave 'pending' alone — it maps from pending/validated/backlog in the
      // overview and those distinctions are lost in the DB column.
      let effectiveStatus: typeof gate.status = gate.status
      let effectiveCompletedAt: string | null = gate.completedAt
      try {
        const { getDatabase } = await import('../storage/database.js')
        const dbRow = getDatabase()
          .prepare('SELECT status, completed_at FROM gates WHERE id = ?')
          .get(normalizedId) as { status: string; completed_at: string | null } | undefined
        if (dbRow && dbRow.status !== 'pending') {
          // 'pending' in DB can represent validated/backlog — don't override those.
          effectiveStatus = dbRow.status as typeof gate.status
          effectiveCompletedAt = dbRow.completed_at
        }
      } catch {
        // DB unavailable — use overview-derived status
      }

      return {
        id: gate.id,
        name: gate.name,
        description,
        sequence: gate.sequence,
        status: effectiveStatus,
        type: 'feature',
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
          description: 'The ID of the gate to show (e.g., "gate-01")',
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
      const normalizedId = normalizeGateId(validated.gateId)
      const db = (await import('../storage/database.js')).getDatabase()
      db.prepare(`UPDATE gates SET status = 'validated' WHERE id = ?`).run(normalizedId)
      const { syncGatesToProjectOverview } = await import('../utils/gate-sync.js')
      await syncGatesToProjectOverview().catch(() => { /* best-effort */ })
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
          const gitUser = await getGitUserInfo(process.cwd())
          startedBy = gitUser.name ?? gitUser.email ?? undefined
        } catch {
          // Silently ignore git user pull errors; startedBy remains optional
        }
      }

      const { startGate } = await import('../core/completions.js')
      const db = (await import('../storage/database.js')).getDatabase()
      const normalizedId = normalizeGateId(validated.gateId)
      const gateRow = db
        .prepare('SELECT status FROM gates WHERE id = ?')
        .get(normalizedId) as { status?: string } | undefined
      const previousStatus = (gateRow?.status ?? 'pending') as 'pending' | 'validated' | 'in_progress' | 'completed' | 'rejected' | 'cancelled' | 'backlog'
      await startGate(validated.gateId, { startedBy })

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
          const gitUser = await getGitUserInfo(process.cwd())
          completedBy = gitUser.name ?? gitUser.email ?? undefined
        } catch {
          // Silently ignore git user pull errors; completedBy remains optional
        }
      }

      const { completeGate } = await import('../core/completions.js')
      const result = await completeGate(validated.gateId)

      const normalizedId = normalizeGateId(validated.gateId)
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
    async () => {
      const { regenerateGates } = await import('../core/completions.js')
      await regenerateGates()
      return {
        mode: 'full' as const,
        status: 'regenerated' as const,
      }
    },
    {
      description: 'Regenerate future gates based on current project state',
      parameters: [],
      returnType: 'void',
      schema: z.object({}),
    }
  )

  registry.register(
    'gate_cancel',
    async (params) => {
      const validated = z.object({ gateId: z.string(), reason: z.string().optional() }).parse(params)
      const { readProjectOverview, saveProjectOverview } = await import('../utils/config.js')
      const normalizedId = normalizeGateId(validated.gateId)
      const seqMatch = /\d+/.exec(normalizedId)
      const seq = seqMatch ? parseInt(seqMatch[0], 10) : null

      const overview = await readProjectOverview()
      let previousStatus: string
      let gateName = ''
      let gateHash: string | undefined

      // Find and remove gate from its current section
      const upcomingIdx = overview.upcomingGates.findIndex(
        (g) => `gate-${g.sequence.toString().padStart(2, '0')}` === normalizedId || g.sequence === seq
      )
      if (upcomingIdx !== -1) {
        const gate = overview.upcomingGates[upcomingIdx]
        gateName = gate?.name ?? gateName
        previousStatus = 'pending'
        overview.upcomingGates = [
          ...overview.upcomingGates.slice(0, upcomingIdx),
          ...overview.upcomingGates.slice(upcomingIdx + 1),
        ]
      } else if (
        overview.currentGateInfo &&
        (overview.currentGate === normalizedId ||
          overview.currentGateInfo.sequence === seq)
      ) {
        gateName = overview.currentGateInfo.name
        gateHash = overview.currentGateInfo.hash
        previousStatus = overview.currentGate ? 'in_progress' : 'pending'
        overview.currentGate = null
        overview.currentGateInfo = null
      } else {
        throw new Error(`Gate not found or already completed/cancelled: ${validated.gateId}`)
      }

      const cancelledAt = new Date().toISOString()
      overview.cancelledGates = [
        ...(overview.cancelledGates ?? []),
        { sequence: seq ?? 0, name: gateName, hash: gateHash, cancelledAt },
      ]
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
      const normalizedId = normalizeGateId(validated.gateId)
      const seqMatch = /\d+/.exec(normalizedId)
      const seq = seqMatch ? parseInt(seqMatch[0], 10) : null

      const overview = await readProjectOverview()
      let previousStatus: string
      let gateName = ''
      let complexity: string | undefined

      // Find and remove gate from its current section
      const upcomingIdx = overview.upcomingGates.findIndex(
        (g) => `gate-${g.sequence.toString().padStart(2, '0')}` === normalizedId || g.sequence === seq
      )
      if (upcomingIdx !== -1) {
        const gate = overview.upcomingGates[upcomingIdx]
        gateName = gate?.name ?? gateName
        complexity = gate?.estimatedComplexity
        previousStatus = 'pending'
        overview.upcomingGates = [
          ...overview.upcomingGates.slice(0, upcomingIdx),
          ...overview.upcomingGates.slice(upcomingIdx + 1),
        ]
      } else if (
        overview.currentGateInfo &&
        (overview.currentGate === normalizedId ||
          overview.currentGateInfo.sequence === seq)
      ) {
        gateName = overview.currentGateInfo.name
        complexity = overview.currentGateInfo.estimatedComplexity
        previousStatus = overview.currentGate ? 'in_progress' : 'pending'
        overview.currentGate = null
        overview.currentGateInfo = null
      } else {
        throw new Error(`Gate not found or already completed/cancelled: ${validated.gateId}`)
      }

      const deferredAt = new Date().toISOString()
      overview.backlogGates = [
        ...(overview.backlogGates ?? []),
        { sequence: seq ?? 0, name: gateName, estimatedComplexity: complexity },
      ]
      await saveProjectOverview(overview)

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

      // Validate type
      const validTypes = ['feature', 'quality', 'rescope']
      if (!validTypes.includes(validated.type)) {
        errors.push(
          `Invalid gate type: ${validated.type}. Must be one of: ${validTypes.join(', ')}`
        )
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

      const templatePath = join(process.cwd(), 'templates', 'md-templates', 'gate-prd-template.md')
      let gateContent = await readFile(templatePath, 'utf-8')

      // Replace template placeholders
      const gateNumber = /\d+/.exec(validated.gateId)?.[0] ?? '00'
      const today = new Date().toISOString().split('T')[0] ?? new Date().toISOString()
      gateContent = gateContent
        .replace(/\[XX\]/g, gateNumber)
        .replace(/\[Gate Name\]/g, validated.name)
        .replace(/\[feature \| quality \| rescope\]/g, validated.type)
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
      const filePath = normalizePath(join(process.cwd(), 'zeno', 'gates', fileName))

      const { writeFile } = await import('../utils/file.js')
      await writeFile(filePath, gateContent, 'utf-8')

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
        createdAt: new Date().toISOString(),
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
          name: 'type',
          type: 'string',
          description: 'Gate type: feature, quality, or rescope',
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
