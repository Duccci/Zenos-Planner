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

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { getZenoDir } from '../utils/config.js'

export function registerGatesOps(registry: FunctionRegistry): void {
  // In-process implementation for listing gates (faster than spawning CLI)

  registry.register(
    'gates_list',
    async () => {
      const db = (await import('../storage/database.js')).getDatabase()

      let gates: Record<string, unknown>[] = db
        .prepare('SELECT * FROM gates ORDER BY sequence ASC')
        .all() as Record<string, unknown>[]

      // If no gates in database, attempt to read archived gate files
      if (gates.length === 0) {
        const archivePath = join(getZenoDir(), '..', 'gates', 'archive')
        if (existsSync(archivePath)) {
          const archiveFiles = readdirSync(archivePath)
            .filter((f) => f.endsWith('.md'))
            .sort()
          const archivedGates = archiveFiles.map((file, index) => {
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
              status: 'completed',
              type: 'feature',
              hash: `archived-${gateId}`,
              created_at: '',
              completed_at: '',
            }
          })
          gates = archivedGates
        }
      }

      return { success: true, data: gates }
    },
    {
      description: 'List all gates in the project with their status',
      parameters: [],
      returnType: 'Gate[]',
      schema: z.object({}),
    }
  )

  // In-process implementation for showing a gate's details

  registry.register(
    'gates_show',
    async (params) => {
      const validated = z.object({ gateId: z.string() }).parse(params)
      const db = (await import('../storage/database.js')).getDatabase()

      // Normalize id: accept gate-01 or 01
      const regex = /(\d+)/
      const match = regex.exec(validated.gateId)
      const normalizedId = match?.[1]
        ? `gate-${parseInt(match[1], 10).toString().padStart(2, '0')}`
        : validated.gateId

      let gate: Record<string, unknown> | undefined = db
        .prepare('SELECT * FROM gates WHERE id = ?')
        .get(normalizedId) as Record<string, unknown> | undefined
      gate ??= db.prepare('SELECT * FROM gates WHERE name LIKE ?').get(`%${validated.gateId}%`) as
        | Record<string, unknown>
        | undefined

      if (!gate) {
        throw new Error(`Gate not found: ${validated.gateId}`)
      }

      const reqCount = db
        .prepare('SELECT COUNT(*) as count FROM requirements WHERE gate_id = ?')
        .get(gate['id']) as { count?: number } | undefined
      const proposalCount = db
        .prepare('SELECT COUNT(*) as count FROM proposals WHERE gate_id = ?')
        .get(gate['id']) as { count?: number } | undefined

      const dependencies = db
        .prepare(
          `
      SELECT g.id, g.name, g.status
      FROM gates g
      JOIN dependencies d ON d.target_hash = g.hash
      WHERE d.source_hash = ? AND d.type = 'requires'
    `
        )
        .all(gate['hash'])

      const detail = {
        ...gate,
        requirements: reqCount?.count ?? 0,
        proposals: proposalCount?.count ?? 0,
        dependencies,
      }

      return { success: true, data: detail }
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
      const validated = z.object({ gateId: z.string() }).parse(params)
      const result = await invokeCommand('gates_start', validated)
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
      const validated = z.object({ gateId: z.string() }).parse(params)
      const result = await invokeCommand('gates_complete', validated)
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
      const today = new Date().toISOString().split('T')[0]!
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
