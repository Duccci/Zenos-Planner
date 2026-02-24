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
      endState: 'A complete application',
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
      endState: 'A complete application',
    })
    expect(result.success).toBe(false)
  })

  it('project_action input schema requires endState for init', async () => {
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
})

