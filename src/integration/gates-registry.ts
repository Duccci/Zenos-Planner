/**
 * Gate Operations Registry
 *
 * Registers all gate-related operations with the function registry.
 * Handles: list, show, start, complete, regenerate
 */

/* eslint-disable @typescript-eslint/unbound-method */
import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { invokeCommand } from './command-invoker.js'
import { normalizeGateId } from '../utils/normalize.js'
import { listArchivedGates } from '../utils/gate-consolidation.js'

import { join } from 'node:path'
import { getZenoDir } from '../utils/config.js'

/**
 * Helper to convert YYYY-MM-DD dates to ISO 8601 format
 */
function toISOTimestamp(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  // If already in ISO format, return as-is
  if (dateStr.includes('T')) return dateStr
  // Convert YYYY-MM-DD to ISO 8601 with time 00:00:00Z
  return `${dateStr}T00:00:00Z`
}

export function registerGatesOps(registry: FunctionRegistry): void {
  // In-process implementation for listing gates (faster than spawning CLI)

  registry.register(
    'gates_list',
    async () => {
      const { readProjectOverview, getGatesFromOverview } = await import('../utils/config.js')

      let summaries: Awaited<ReturnType<typeof getGatesFromOverview>> = []

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
          created: toISOTimestamp(g.completedAt) ?? now,
          started: g.status === 'in_progress' ? now : null,
          completed: toISOTimestamp(g.completedAt),
          proposalCount: 0,
          completedProposalCount: 0,
          requirementCount: 0,
          testedRequirementCount: 0,
        })),
        pagination: {
          total: summaries.length,
          skip: 0,
          take: Math.max(summaries.length, 1),
          hasMore: false,
        },
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
      return {
        id: gate.id,
        name: gate.name,
        description: 'No description',
        sequence: gate.sequence,
        status: gate.status,
        type: 'feature',
        objectives: [],
        requirements: [],
        proposals: [],
        created: toISOTimestamp(gate.completedAt) ?? now,
        started: gate.status === 'in_progress' ? now : null,
        completed: toISOTimestamp(gate.completedAt),
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

      const result = await invokeCommand('gates_start', { gateId: validated.gateId, startedBy })
      if (!result.success) {
        throw new Error(result.error)
      }
    },
    {
      description: 'Start working on a gate (changes status from pending to in_progress)',
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

      const result = await invokeCommand('gates_complete', { gateId: validated.gateId, completedBy })
      if (!result.success) {
        throw new Error(result.error)
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
      const result = await invokeCommand('gates_regenerate')
      if (!result.success) {
        throw new Error(result.error)
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
      const { getDatabase } = await import('../storage/database.js')
      const { normalizeGateId } = await import('../utils/normalize.js')
      const db = getDatabase()
      const normalizedId = normalizeGateId(validated.gateId)
      const gate = db.prepare('SELECT id, status FROM gates WHERE id = ?').get(normalizedId) as Record<string, unknown> | undefined
      if (!gate) throw new Error(`Gate not found: ${validated.gateId}`)
      const previousStatus = gate['status'] as string
      db.prepare('UPDATE gates SET status = ?, updated_at = ? WHERE id = ?').run('cancelled', new Date().toISOString(), normalizedId)
      return { gateId: normalizedId, previousStatus, newStatus: 'cancelled', cancelledAt: new Date().toISOString(), reason: validated.reason }
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
      const { getDatabase } = await import('../storage/database.js')
      const { normalizeGateId } = await import('../utils/normalize.js')
      const db = getDatabase()
      const normalizedId = normalizeGateId(validated.gateId)
      const gate = db.prepare('SELECT id, status FROM gates WHERE id = ?').get(normalizedId) as Record<string, unknown> | undefined
      if (!gate) throw new Error(`Gate not found: ${validated.gateId}`)
      const previousStatus = gate['status'] as string
      db.prepare('UPDATE gates SET status = ?, updated_at = ? WHERE id = ?').run('backlog', new Date().toISOString(), normalizedId)
      return { gateId: normalizedId, previousStatus, newStatus: 'backlog', deferredAt: new Date().toISOString(), reason: validated.reason }
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
      const filePath = join(process.cwd(), 'zeno', 'gates', fileName)

      const { writeFile } = await import('fs/promises')
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
