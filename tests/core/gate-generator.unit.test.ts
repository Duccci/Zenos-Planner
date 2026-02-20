import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('gate-generator (unit)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('generateGates uses estimate logic and caps totalComplexity at 100', async () => {
    const { generateGates } = await import('../../src/core/gate-generator.ts')

    const analysis = {
      metrics: { linesOfCode: 200_000, cyclomaticComplexity: 500, coupling: 1 },
      dependencies: [],
    } as any

    const result = generateGates(
      'Very big project description that is long enough to matter',
      analysis as any,
      Array.from({ length: 10 }).map((_, i) => ({ id: `r${i}`, description: `req${i}` }))
    )

    expect(result.totalComplexity).toBeLessThanOrEqual(100)
    expect(result.totalComplexity).toBeGreaterThan(0)
  })

  it('regenerateGatesWithAnalysis: returns archive message when gate not found', async () => {
    // DB still needed for gate_analysis table check (only reached if gate IS found; here it won't be)
    const stubDb = {
      prepare: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined) }),
    } as any
    const dbMod = await import('../../src/storage/database.js')
    vi.spyOn(dbMod, 'getDatabase').mockReturnValue(stubDb as any)

    // Overview returns no matching gate
    const configMod = await import('../../src/utils/config.ts')
    vi.spyOn(configMod, 'readProjectOverview' as any).mockResolvedValue({
      completedGates: [],
      currentGateInfo: null,
      upcomingGates: [],
      currentGate: null,
    })
    vi.spyOn(configMod, 'getGatesFromOverview' as any).mockReturnValue([])

    const mod = await import('../../src/core/gate-generator.ts')

    const result = await mod.regenerateGatesWithAnalysis('missing-gate')
    expect(result.originalGates).toEqual([])
    expect(result.suggestedGates).toEqual([])
    expect(result.reasoning).toMatch(/not found in project overview/i)
  })

  it('regenerateGatesWithAnalysis: delegates to theoretical regeneration when gate exists', async () => {
    // DB only needed for gate_analysis table check
    const stubDb = {
      prepare: vi.fn().mockImplementation((q: string) => {
        if (
          q.includes("SELECT name FROM sqlite_master WHERE type='table' AND name='gate_analysis'")
        ) {
          return { get: vi.fn().mockReturnValue(null) }
        }
        return { get: vi.fn().mockReturnValue(null), all: vi.fn().mockReturnValue([]) }
      }),
    } as any
    const dbMod = await import('../../src/storage/database.js')
    vi.spyOn(dbMod, 'getDatabase').mockReturnValue(stubDb as any)

    // Overview contains gate g1
    const configMod = await import('../../src/utils/config.ts')
    vi.spyOn(configMod, 'readProjectOverview' as any).mockResolvedValue({
      completedGates: [],
      currentGateInfo: { sequence: 1, name: 'G1', hash: 'h1', estimatedComplexity: 3 },
      upcomingGates: [],
      currentGate: 'g1',
    })
    vi.spyOn(configMod, 'getGatesFromOverview' as any).mockReturnValue([
      { id: 'g1', sequence: 1, name: 'G1', status: 'in_progress', hash: 'h1' },
      { id: 'g2', sequence: 2, name: 'G2', status: 'pending', hash: 'h2' },
    ])

    // mock decomposition/sequencer to produce a predictable suggestion
    vi.mock('../../src/core/zeno-engine.ts', () => ({
      decomposeWork: (wd: any) => ({
        gates: [
          {
            id: 's1',
            name: 'S1',
            estimatedComplexity: 5,
            confidence: 0,
            objectives: [],
            dependencies: [],
            description: '',
            type: 'feature',
            status: 'pending',
          },
        ],
      }),
    }))
    vi.mock('../../src/core/gate-sequencer.ts', () => ({
      sequenceGates: (r: any) => ({ gates: r.gates }),
    }))

    const mod = await import('../../src/core/gate-generator.ts')

    const result = await mod.regenerateGatesWithAnalysis('g1')
    expect(result.suggestedGates.length).toBe(1)
    expect(result.reasoning).toMatch(/No analysis data available/i)
  })

  it('regenerateGatesTheoreticalFromProject: uses project overview and decomposition', async () => {
    // No DB needed — this function reads entirely from project overview

    // Spy on config to return overview with 2 completed gates and endState
    const configMod = await import('../../src/utils/config.ts')
    vi.spyOn(configMod, 'readProjectOverview' as any).mockResolvedValue({
      endState: 'Ship it',
      completedGates: [
        { sequence: 1, name: 'G1', hash: 'h1', completedAt: '2026-01-01' },
        { sequence: 2, name: 'G2', hash: 'h2', completedAt: '2026-01-02' },
      ],
      upcomingGates: [],
      currentGateInfo: null,
      currentGate: null,
    })
    vi.spyOn(configMod, 'getGatesFromOverview' as any).mockReturnValue([
      { id: 'gate-01', sequence: 1, name: 'G1', status: 'completed', hash: 'h1' },
      { id: 'gate-02', sequence: 2, name: 'G2', status: 'completed', hash: 'h2' },
    ])

    // mock decomposeWork and sequenceGates
    vi.mock('../../src/core/zeno-engine.ts', () => ({
      decomposeWork: (wd: any) => ({
        gates: [
          {
            id: 's1',
            name: 'S1',
            estimatedComplexity: 1,
            confidence: 0,
            objectives: [],
            dependencies: [],
            description: '',
            type: 'feature',
            status: 'pending',
          },
        ],
        raw: true,
      }),
    }))
    vi.mock('../../src/core/gate-sequencer.ts', () => ({
      sequenceGates: (r: any) => ({ gates: r.gates }),
    }))

    const mod = await import('../../src/core/gate-generator.ts')

    const res = await mod.regenerateGatesTheoreticalFromProject()
    expect(res.reasoning).toMatch(/Ship it/)
    expect(res.originalGates.length).toBe(2)
    expect(res.suggestedGates.length).toBe(1)
  })
})
