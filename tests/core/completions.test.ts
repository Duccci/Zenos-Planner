import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfigError, DatabaseError, ValidationError } from '../../src/utils/errors.js'

// Hoisted mock for the database module with runtime-configurable behavior
vi.mock('../../src/storage/database.js', () => {
  let state: { throwOnGet?: boolean; getStub?: any } = {}
  return {
    initializeDatabase: () => undefined,
    getDatabase: () => {
      if (state.throwOnGet) throw new Error('boom')
      if (state.getStub) return state.getStub
      throw new Error('[test mock] getDatabase not configured')
    },
    __setMockDbState: (s: any) => { state = s || {} },
  }
})

// Avoid running git commands in write-time-analyzer during tests
vi.mock('../../src/core/write-time-analyzer.js', () => ({
  analyzeGateChanges: vi.fn().mockResolvedValue(undefined)
}))

// Provide default config mocks to avoid reading actual config files
vi.mock('../../src/utils/config.js', async () => {
  const actual = await vi.importActual('../../src/utils/config.js')
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue({
      version: '1.2.3',
      versioning: { enabled: true, lifecycleBump: 'major', gateBump: 'minor', proposalBump: 'minor' },
      git: { autoCommit: true, autoTag: true, autoPush: false, remote: 'origin' }
    }),
    saveConfig: vi.fn().mockResolvedValue(undefined),
  }
})

// Mock git operations to avoid repository checks and network interactions
vi.mock('../../src/utils/git.js', () => ({
  syncWithGit: vi.fn().mockResolvedValue(undefined)
}))

beforeEach(async () => {
  vi.resetModules()
  vi.restoreAllMocks()
  // ensure mock DB state is cleared before each test
  const dbMock = await import('../../src/storage/database.js')
  if (dbMock && dbMock.__setMockDbState) dbMock.__setMockDbState({})
})

describe('completions: completeGate and approveProposal flows', () => {
  it('completeGate throws DatabaseError when getDatabase fails', async () => {
    // make findProjectRoot succeed
    vi.mock('../../src/core/completions.ts', async () => (await vi.importActual('../../src/core/completions.ts')))
    const findMod = await import('../../src/utils/config.js')
    vi.spyOn(findMod, 'findProjectRoot').mockReturnValue('project-root')

    // mock database module to throw from getDatabase
    const dbMock = await import('../../src/storage/database.js')
    // configure mock to throw on getDatabase
    dbMock.__setMockDbState({ throwOnGet: true })

    try {
      const mod = await import('../../src/core/completions.ts')
      await expect(mod.completeGate('gate-1')).rejects.toThrow('Failed to open database')
    } finally {
      dbMock.__setMockDbState({})
    }
  })

  it('completeGate throws ValidationError when gate not found', async () => {
    const findMod = await import('../../src/utils/config.js')
    vi.spyOn(findMod, 'findProjectRoot').mockReturnValue('project-root')

    // mock database module to return a getDatabase that provides undefined for gate lookup
    const dbMock = await import('../../src/storage/database.js')
    // configure mock to return undefined for gate lookup
    dbMock.__setMockDbState({ getStub: { prepare: () => ({ get: () => undefined }) } })

    try {
      const mod = await import('../../src/core/completions.ts')
      await expect(mod.completeGate('gate-01')).rejects.toThrow('Gate not found')
    } finally {
      dbMock.__setMockDbState({})
    }
  })

  it('completeGate completes gate, bumps lifecycle (major) and calls syncWithGit', async () => {
    const projectRoot = 'project-root'
    const findMod = await import('../../src/utils/config.js')
    vi.spyOn(findMod, 'findProjectRoot').mockReturnValue(projectRoot)

    // mock initialize and provide stub DB
    const gateRow = { id: 'gate-01', name: 'Test Gate', status: 'pending' }
    const stubPrepare = vi.fn().mockImplementation((q: string) => {
      const normalized = q.replace(/\s+/g, ' ').toLowerCase()
      if (normalized.includes('from gates') && normalized.includes('where id')) {
        return { get: (id: string) => (id === 'gate-01' ? gateRow : undefined) }
      }
      if (normalized.includes("count(*)")) {
        return { get: () => ({ count: 0 }) }
      }
      if (normalized.includes('select hash from proposals where gate_id')) {
        return { all: () => [] }
      }
      // generic runner
      return { run: () => undefined, all: () => [] }
    })

    const dbMock = await import('../../src/storage/database.js')
    // configure mock to return stub DB for this test
    dbMock.__setMockDbState({ getStub: { prepare: stubPrepare, transaction: (fn: any) => (...args: any[]) => fn(...args) } })

    try {
      // mock analyzers and regenerators
      const analyzer = await import('../../src/core/write-time-analyzer.js')
    vi.spyOn(analyzer, 'analyzeGateChanges').mockResolvedValue(undefined as any)
    const generator = await import('../../src/core/gate-generator.js')
    vi.spyOn(generator, 'regenerateGatesWithAnalysis').mockResolvedValue({ originalGates: [], suggestedGates: [], changes: [], reasoning: '' } as any)

    // mock consolidation and file ops
    const consolidation = await import('../../src/utils/gate-consolidation.js')
    vi.spyOn(consolidation, 'consolidateGateProposals').mockResolvedValue({} as any)
    vi.spyOn(consolidation, 'generateConsolidationMarkdown').mockReturnValue('MD')

    const fileMod = await import('../../src/utils/file.js')
    vi.spyOn(fileMod, 'readFile').mockRejectedValue(new Error('no file'))
    vi.spyOn(fileMod, 'writeFile').mockResolvedValue(undefined as any)
    vi.spyOn(fileMod, 'ensureDir').mockResolvedValue(undefined as any)

    vi.mock('node:fs/promises', () => ({
      readdir: vi.fn().mockResolvedValue([]),
      rename: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined)
    }))

    // config and versioning
    const configMod = await import('../../src/utils/config.js')
    vi.spyOn(configMod, 'loadConfig').mockResolvedValue({
      version: '1.2.3',
      versioning: { enabled: true, lifecycleBump: 'major', gateBump: 'minor', proposalBump: 'minor' },
      git: { autoCommit: true, autoTag: true, autoPush: false, remote: 'origin' }
    } as any)
    const saveSpy = vi.spyOn(configMod, 'saveConfig').mockResolvedValue(undefined as any)

    // ensure git sync stub is used
    const gitMod = await import('../../src/utils/git.js')
    const syncSpy = vi.spyOn(gitMod, 'syncWithGit').mockResolvedValue(undefined as any)

    // spy on bumpSemver to ensure new version computed
    const versionMod = await import('../../src/utils/version.js')
    vi.spyOn(versionMod, 'bumpSemver').mockImplementation((v: string) => '2.0.0' as any)

    const mod = await import('../../src/core/completions.ts')

    const res = await mod.completeGate('gate-1', { push: true })

    expect(res.bump).toBe('major')
    expect(res.gateId).toBe('gate-01')
    expect(saveSpy).toHaveBeenCalled()
    expect(syncSpy).toHaveBeenCalled()

    // check that syncWithGit was called with autoPush true (because options.push === true)
    const calledWith = syncSpy.mock.calls[0][0] as any
    expect(calledWith.autoPush).toBe(true)
    
    } finally {
      const dbMock = await import('../../src/storage/database.js')
      if (dbMock && dbMock.__setMockDbState) dbMock.__setMockDbState({})
    }
  })

  it('approveProposal throws when proposal not found', async () => {
    const findMod = await import('../../src/utils/config.js')
    vi.spyOn(findMod, 'findProjectRoot').mockReturnValue('project-root')

    const stubPrepare = vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined), run: vi.fn() })
    const dbMock = await import('../../src/storage/database.js')
    dbMock.__setMockDbState({ getStub: { prepare: stubPrepare, transaction: (fn: any) => (...args: any[]) => fn(...args) } })

    try {
      const mod = await import('../../src/core/completions.ts')
      await expect(mod.approveProposal('#missing')).rejects.toThrow('Proposal not found')
    } finally {
      dbMock.__setMockDbState({})
    }
  })

  it('approveProposal moves proposal file and returns metadata', async () => {
    const projectRoot = 'project-root'
    const findMod = await import('../../src/utils/config.js')
    vi.spyOn(findMod, 'findProjectRoot').mockReturnValue(projectRoot)

    const proposalRow = { id: 'p1', gateId: 'gate-01', title: 'Add feature', status: 'pending', requirement_id: null }
    const stubPrepare = vi.fn().mockImplementation((q: string) => ({ get: vi.fn().mockReturnValue(proposalRow), run: vi.fn() }))
    const dbMock = await import('../../src/storage/database.js')
    dbMock.__setMockDbState({ getStub: { prepare: stubPrepare, transaction: (fn: any) => (...args: any[]) => fn(...args) } })

    try {
      const fileMod = await import('../../src/utils/file.js')
      vi.spyOn(fileMod, 'ensureDir').mockResolvedValue(undefined as any)

      vi.mock('node:fs/promises', () => ({
        readdir: vi.fn(async (p: string) => {
          if (p.endsWith('gate-01')) return ['something.md']
          if (p.endsWith('archive')) return []
          return []
        }),
        rename: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined)
      }))

      const readSpy = vi.spyOn(fileMod, 'readFile').mockImplementation(async (p: string) => {
        if (p.endsWith('something.md')) {
          return `# Proposal: Add feature\n\n**Hash**: #abc\n\n## Summary\n\nThis adds a new command` 
        }
        return ''
      })

      const { rename: renameSpy } = await import('node:fs/promises')

      // ensure config is available for version info
      const configMod = await import('../../src/utils/config.js')
      vi.spyOn(configMod, 'loadConfig').mockResolvedValue({ version: '1.2.3', versioning: { enabled: true }, git: {} } as any)

      const mod = await import('../../src/core/completions.ts')
      const res = await mod.approveProposal('#abc')

      expect(res.proposalHash).toBe('abc')
      expect(res.gateId).toBe('gate-01')
    } finally {
      dbMock.__setMockDbState({})
    }
  })
})
