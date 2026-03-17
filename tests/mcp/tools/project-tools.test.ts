import { describe, it, expect } from 'vitest'
import { projectHandlers } from '../../../src/mcp/tools/project-tools.js'

describe('Project Action Handlers', () => {
  it('project_action handlers are exported', async () => {
    const handlers = projectHandlers()
    expect(handlers).toBeDefined()
    expect(handlers.project_action).toBeDefined()
    expect(typeof handlers.project_action).toBe('function')
  })

  it('project_action tool definitions are properly exported', async () => {
    const { projectToolDefinitions } = await import(
      '../../../src/mcp/tools/project-tools.js'
    )
    expect(projectToolDefinitions).toBeDefined()
    expect(projectToolDefinitions.length).toBe(1)
    expect(projectToolDefinitions[0].name).toBe('project_action')
    expect(projectToolDefinitions[0].description).toContain('init')
    expect(projectToolDefinitions[0].description).toContain('status')
  })

  it('project_action input schema validates init action', async () => {
    const { ProjectActionInputSchema } = await import(
      '../../../src/mcp/schemas/project-action-schemas.js'
    )
    const result = ProjectActionInputSchema.safeParse({
      action: 'init',
      projectName: 'My Project',
      projectStatement: 'A complete application',
    })
    expect(result.success).toBe(true)
  })

  it('project_action input schema validates status action', async () => {
    const { ProjectActionInputSchema } = await import(
      '../../../src/mcp/schemas/project-action-schemas.js'
    )
    const result = ProjectActionInputSchema.safeParse({
      action: 'status',
    })
    expect(result.success).toBe(true)
  })

  it('project_action input schema rejects invalid action', async () => {
    const { ProjectActionInputSchema } = await import(
      '../../../src/mcp/schemas/project-action-schemas.js'
    )
    const result = ProjectActionInputSchema.safeParse({
      action: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('project_action input schema requires projectName for init', async () => {
    const { ProjectActionInputSchema } = await import(
      '../../../src/mcp/schemas/project-action-schemas.js'
    )
    const result = ProjectActionInputSchema.safeParse({
      action: 'init',
      projectStatement: 'A complete application',
    })
    expect(result.success).toBe(false)
  })

  it('project_action input schema requires projectStatement for init', async () => {
    const { ProjectActionInputSchema } = await import(
      '../../../src/mcp/schemas/project-action-schemas.js'
    )
    const result = ProjectActionInputSchema.safeParse({
      action: 'init',
      projectName: 'My Project',
    })
    expect(result.success).toBe(false)
  })

  it('projectHandlers factory returns handlers object', async () => {
    const { projectHandlers } = await import(
      '../../../src/mcp/tools/project-tools.js'
    )
    const handlers = projectHandlers()
    expect(handlers).toBeDefined()
    expect(Object.keys(handlers)).toContain('project_action')
  })

  it('ProjectStatusOutputSchema validates enriched status response', async () => {
    const { ProjectStatusOutputSchema } = await import(
      '../../../src/mcp/schemas/project-action-schemas.js'
    )
    const result = ProjectStatusOutputSchema.safeParse({
      activeGates: [{ id: 'gate-03', name: 'API Layer', status: 'in_progress' }],
      completedGates: ['gate-01-startup'],
      requirements: {
        total: 10,
        byPriority: { must: 5, should: 3, could: 2, wont: 0 },
        byLevel: { project: 4, gate: 6 },
      },
      proposals: {
        total: 6,
        byStatus: { pending: 1, validated: 0, approved: 1, in_progress: 2, completed: 2, rejected: 0 },
      },
      mcp: { status: 'healthy', toolsRegistered: 10, configLoaded: true },
    })
    expect(result.success).toBe(true)
  })

  it('ProjectStatusOutputSchema requires requirements and proposals fields', async () => {
    const { ProjectStatusOutputSchema } = await import(
      '../../../src/mcp/schemas/project-action-schemas.js'
    )
    const result = ProjectStatusOutputSchema.safeParse({
      activeGates: [],
      completedGates: [],
      mcp: { status: 'healthy', toolsRegistered: 0, configLoaded: true },
    })
    expect(result.success).toBe(false)
  })
})

