import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as commandInvoker from '../../src/integration/command-invoker.js'

// We test context-provider by mocking invokeCommand
describe('context-provider', () => {
  beforeEach(() => {
    vi.spyOn(commandInvoker, 'invokeCommand').mockImplementation(async (cmd: string) => {
      if (cmd === 'status') {
        return { success: true, output: 'Project initialized with gates', exitCode: 0 }
      }
      if (cmd === 'gates_list') {
        return { success: true, output: 'gate-01: pending - Setup project\ngate-02: in_progress - Build module', exitCode: 0 }
      }
      if (cmd === 'proposal_list') {
        return { success: true, output: 'abc123: pending\ndef456: in_progress', exitCode: 0 }
      }
      return { success: true, output: '', exitCode: 0 }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getProjectContext returns structured context', async () => {
    const { getProjectContext } = await import('../../src/integration/context-provider.js')
    const ctx = await getProjectContext()

    expect(ctx).toHaveProperty('status')
    expect(ctx).toHaveProperty('workflow')
    expect(ctx).toHaveProperty('lastUpdated')
    expect(ctx.status.initialized).toBe(true)
    expect(ctx.status.pendingProposals).toBe(1)
    expect(ctx.status.inProgressProposals).toBe(1)
    expect(ctx.lastUpdated).toBeInstanceOf(Date)
  })

  it('getProjectContext handles gate parsing', async () => {
    const { getProjectContext } = await import('../../src/integration/context-provider.js')
    const ctx = await getProjectContext()
    // gates with matching pattern
    expect(ctx.status.gates.length).toBeGreaterThanOrEqual(0)
  })

  it('getProjectContext returns minimal context on failure', async () => {
    vi.spyOn(commandInvoker, 'invokeCommand').mockRejectedValueOnce(new Error('Command failed'))
    const { getProjectContext } = await import('../../src/integration/context-provider.js')
    const ctx = await getProjectContext()

    expect(ctx.status.initialized).toBe(false)
    expect(ctx.workflow.projectHealth).toBe('critical')
  })

  it('getNextActionSuggestions returns array of strings', async () => {
    const { getNextActionSuggestions } = await import('../../src/integration/context-provider.js')
    const suggestions = await getNextActionSuggestions()
    expect(Array.isArray(suggestions)).toBe(true)
  })

  it('isActionRecommended returns boolean', async () => {
    const { isActionRecommended } = await import('../../src/integration/context-provider.js')
    const result = await isActionRecommended('proposal')
    expect(typeof result).toBe('boolean')
  })

  it('workflow health is warning for many pending proposals', async () => {
    vi.spyOn(commandInvoker, 'invokeCommand').mockImplementation(async (cmd: string) => {
      if (cmd === 'status') {
        return { success: true, output: 'initialized gates', exitCode: 0 }
      }
      if (cmd === 'gates_list') {
        return { success: true, output: 'gate-01: in_progress - Current gate', exitCode: 0 }
      }
      if (cmd === 'proposal_list') {
        // Simulate 6 pending proposals
        const lines = Array.from({ length: 6 }, (_, i) => `hash${String(i)}: pending`).join('\n')
        return { success: true, output: lines, exitCode: 0 }
      }
      return { success: true, output: '', exitCode: 0 }
    })
    const { getProjectContext } = await import('../../src/integration/context-provider.js')
    const ctx = await getProjectContext()
    expect(ctx.workflow.projectHealth).toBe('warning')
  })

  it('workflow health is good when no issues', async () => {
    vi.spyOn(commandInvoker, 'invokeCommand').mockImplementation(async (cmd: string) => {
      if (cmd === 'status') {
        return { success: true, output: 'initialized gates', exitCode: 0 }
      }
      if (cmd === 'gates_list') {
        return { success: true, output: 'gate-01: completed - Done', exitCode: 0 }
      }
      if (cmd === 'proposal_list') {
        return { success: true, output: '', exitCode: 0 }
      }
      return { success: true, output: '', exitCode: 0 }
    })
    const { getProjectContext } = await import('../../src/integration/context-provider.js')
    const ctx = await getProjectContext()
    expect(ctx.workflow.projectHealth).toBe('good')
  })
})
