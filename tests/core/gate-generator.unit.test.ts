import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('gate-generator (unit)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('generateGates uses estimate logic and caps totalComplexity at 100', async () => {
    const { generateGates } = await import('../../src/core/gate-generator.ts');

    const analysis = {
      metrics: { linesOfCode: 200_000, cyclomaticComplexity: 500, coupling: 1 },
      dependencies: []
    } as any;

    const result = generateGates('Very big project description that is long enough to matter', analysis as any, Array.from({ length: 10 }).map((_, i) => ({ id: `r${i}`, description: `req${i}` })));

    expect(result.totalComplexity).toBeLessThanOrEqual(100);
    expect(result.totalComplexity).toBeGreaterThan(0);
  });

  it('regenerateGatesWithAnalysis: returns archive message when gate not found', async () => {
    // stub DB to return undefined for gate
    const stubDb = { prepare: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined) }) } as any;
    const dbMod = await import('../../src/storage/database.js');
    vi.spyOn(dbMod, 'getDatabase').mockReturnValue(stubDb as any);

    const mod = await import('../../src/core/gate-generator.ts');

    const result = await mod.regenerateGatesWithAnalysis('missing-gate');
    expect(result.originalGates).toEqual([]);
    expect(result.suggestedGates).toEqual([]);
    expect(result.reasoning).toMatch(/archive/i);
  });

  it('regenerateGatesWithAnalysis: delegates to theoretical regeneration when gate exists', async () => {
    const stubGate = { id: 'g1' };
    // DB returns gate when queried
    const gateRows = [
      { id: 'g1', name: 'G1', description: '', status: 'pending', type: 'feature', depends_on: null },
      { id: 'g2', name: 'G2', description: '', status: 'pending', type: 'feature', depends_on: null }
    ];

    const stubDb = { prepare: vi.fn().mockImplementation((q: string) => {
      if (q.includes("SELECT name FROM sqlite_master WHERE type='table' AND name='gate_analysis'")) {
        return { get: vi.fn().mockReturnValue(null) };
      }
      if (q.includes('WHERE id = ?')) {
        return { get: vi.fn().mockReturnValue(gateRows[0]) };
      }
      if (q.includes('ORDER BY sequence')) {
        return { all: vi.fn().mockReturnValue(gateRows) };
      }
      return { get: vi.fn().mockReturnValue(null), all: vi.fn().mockReturnValue([]) };
    }) } as any;
    const dbMod = await import('../../src/storage/database.js');
    vi.spyOn(dbMod, 'getDatabase').mockReturnValue(stubDb as any);

    // mock decomposition/sequencer to produce a predictable suggestion
    vi.mock('../../src/core/zeno-engine.ts', () => ({ decomposeWork: (wd: any) => ({ gates: [{ id: 's1', name: 'S1', estimatedComplexity: 5, confidence: 0, objectives: [], dependencies: [], description: '', type: 'feature', status: 'pending' }] }) }));
    vi.mock('../../src/core/gate-sequencer.ts', () => ({ sequenceGates: (r: any) => ({ gates: r.gates }) }));

    const mod = await import('../../src/core/gate-generator.ts');

    const result = await mod.regenerateGatesWithAnalysis('g1');
    expect(result.suggestedGates.length).toBe(1);
    expect(result.reasoning).toMatch(/No analysis data available/i);
  });

  it('regenerateGatesTheoreticalFromProject: uses project overview and decomposition', async () => {
    // stub DB gate rows
    const gateRows = [
      { id: 'g1', name: 'G1', description: '', status: 'pending', type: 'feature', depends_on: null },
      { id: 'g2', name: 'G2', description: '', status: 'pending', type: 'feature', depends_on: null }
    ];

    const stubDb = { prepare: vi.fn().mockImplementation((q: string) => ({ all: vi.fn().mockReturnValue(gateRows) })) } as any;
    const dbMod = await import('../../src/storage/database.js');
    vi.spyOn(dbMod, 'getDatabase').mockReturnValue(stubDb as any);

    // mock readProjectOverview
    vi.mock('../../src/utils/config.ts', () => ({ readProjectOverview: async () => ({ endState: 'Ship it' }) }));

    // mock decomposeWork and sequenceGates
    vi.mock('../../src/core/zeno-engine.ts', () => ({ decomposeWork: (wd: any) => ({ gates: [{ id: 's1', name: 'S1', estimatedComplexity: 1, confidence: 0, objectives: [], dependencies: [], description: '', type: 'feature', status: 'pending' }], raw: true }) }));
    vi.mock('../../src/core/gate-sequencer.ts', () => ({ sequenceGates: (r: any) => ({ gates: r.gates }) }));

    const mod = await import('../../src/core/gate-generator.ts');

    const res = await mod.regenerateGatesTheoreticalFromProject();
    expect(res.reasoning).toMatch(/Ship it/);
    expect(res.originalGates.length).toBe(2);
    expect(res.suggestedGates.length).toBe(1);
  });



});
