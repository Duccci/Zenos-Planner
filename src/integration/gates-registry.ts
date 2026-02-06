/**
 * Gate Operations Registry
 *
 * Registers all gate-related operations with the function registry.
 * Handles: list, show, start, complete, regenerate
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { invokeCommand } from './command-invoker.js'

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { getZenoDir } from '../utils/config.js'

export function registerGatesOps(registry: FunctionRegistry): void {
  // In-process implementation for listing gates (faster than spawning CLI)
  registry.register('gates_list', async () => {
    const db = (await import('../storage/database.js')).getDatabase()

    let gates: any[] = db.prepare('SELECT * FROM gates ORDER BY sequence ASC').all() as any[]

    // If no gates in database, attempt to read archived gate files
    if (!gates || gates.length === 0) {
      const archivePath = join(getZenoDir(), '..', 'gates', 'archive')
      if (existsSync(archivePath)) {
        const archiveFiles = readdirSync(archivePath).filter(f => f.endsWith('.md')).sort()
        const archivedGates = archiveFiles.map((file, index) => {
          const match = /^(gate-\d+)/.exec(file)
          const gateId = match?.[1] ?? `gate-${String(index)}`
          return {
            id: gateId,
            project_id: 'archived',
            sequence: index + 1,
            name: file.replace(/^gate-\d+-/, '').replace('.md', '').replace(/-/g, ' '),
            description: null,
            status: 'completed',
            type: 'feature',
            hash: `archived-${gateId}`,
            created_at: '',
            completed_at: ''
          }
        })
        gates = archivedGates
      }
    }

    return { success: true, data: gates }
  }, {
    description: 'List all gates in the project with their status',
    parameters: [],
    returnType: 'Gate[]',
    schema: z.object({})
  })

  // In-process implementation for showing a gate's details
  registry.register('gates_show', async (params) => {
    const validated = z.object({ gateId: z.string() }).parse(params)
    const db = (await import('../storage/database.js')).getDatabase()

    // Normalize id: accept gate-01 or 01
    const regex = /(\d+)/
    const match = regex.exec(validated.gateId)
    const normalizedId = match?.[1] ? `gate-${parseInt(match[1], 10).toString().padStart(2, '0')}` : validated.gateId

    let gate = db.prepare('SELECT * FROM gates WHERE id = ?').get(normalizedId)
    if (!gate) {
      gate = db.prepare('SELECT * FROM gates WHERE name LIKE ?').get(`%${validated.gateId}%`)
    }

    if (!gate) {
      throw new Error(`Gate not found: ${validated.gateId}`)
    }

    const reqCount = db.prepare('SELECT COUNT(*) as count FROM requirements WHERE gate_id = ?').get(gate.id)
    const proposalCount = db.prepare('SELECT COUNT(*) as count FROM proposals WHERE gate_id = ?').get(gate.id)

    const dependencies = db.prepare(`
      SELECT g.id, g.name, g.status
      FROM gates g
      JOIN dependencies d ON d.target_hash = g.hash
      WHERE d.source_hash = ? AND d.type = 'requires'
    `).all(gate.hash)

    const detail = {
      ...gate,
      requirements: reqCount?.count ?? 0,
      proposals: proposalCount?.count ?? 0,
      dependencies
    }

    return { success: true, data: detail }
  }, {
    description: 'Show detailed information about a specific gate',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'The ID of the gate to show (e.g., "gate-01")',
        required: true
      }
    ],
    returnType: 'GateDetails',
    schema: z.object({
      gateId: z.string().min(1, 'Gate ID is required')
    })
  })

  registry.register('gates_start', async (params) => {
    const validated = z.object({ gateId: z.string() }).parse(params)
    const result = await invokeCommand('gates_start', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Start working on a gate (changes status from pending to in_progress)',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'The ID of the gate to start',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      gateId: z.string().min(1, 'Gate ID is required')
    })
  })

  registry.register('gates_complete', async (params) => {
    const validated = z.object({ gateId: z.string() }).parse(params)
    const result = await invokeCommand('gates_complete', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Mark a gate as completed and create a release tag',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'The ID of the gate to complete',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      gateId: z.string().min(1, 'Gate ID is required')
    })
  })

  registry.register('gates_regenerate', async () => {
    const result = await invokeCommand('gates_regenerate')
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Regenerate future gates based on current project state',
    parameters: [],
    returnType: 'void',
    schema: z.object({})
  })
}
