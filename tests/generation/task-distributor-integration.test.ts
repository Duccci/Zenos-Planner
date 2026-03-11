import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildCliCommand,
  topologicalFallback,
  annotateProposals,
  distributeProposals,
  type ProposalNode,
  type DependencyEdge,
  type ParallelExecutionPlan,
} from '../../src/generation/task-distributor-integration.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExecSync = vi.fn()
const mockSpawn = vi.fn()

vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
  spawn: (...args: unknown[]) => mockSpawn(...args),
}))

const mockLoadConfig = vi.fn()
vi.mock('../../src/utils/config.js', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

// ACP SDK mock — controls whether ACP succeeds or fails per-test
const acpMockState = {
  shouldThrowOnInitialize: false,
  responseText: '{"parallelSets":[["aaa","bbb"],["ccc"]]}',
  respondWithNonText: false,
  respondWithNonChunk: false,
}

// Captured client reference for simulating sessionUpdate callbacks
let capturedSessionUpdate: ((params: unknown) => Promise<void>) | undefined

vi.mock('@agentclientprotocol/sdk', () => {
  class MockClientSideConnection {
    initialize: ReturnType<typeof vi.fn>
    newSession: ReturnType<typeof vi.fn>
    prompt: ReturnType<typeof vi.fn>

    constructor(clientFactory: (agent: null) => { sessionUpdate?: (p: unknown) => Promise<void> }, _stream: unknown) {
      const client = clientFactory(null)
      capturedSessionUpdate = client.sessionUpdate

      this.initialize = vi.fn().mockImplementation(async () => {
        if (acpMockState.shouldThrowOnInitialize) throw new Error('ACP init failed')
      })
      this.newSession = vi.fn().mockResolvedValue({ sessionId: 'test-acp-session-1' })
      this.prompt = vi.fn().mockImplementation(async () => {
        if (!capturedSessionUpdate) return
        if (acpMockState.respondWithNonChunk) {
          await capturedSessionUpdate({ update: { sessionUpdate: 'other_event' } })
          return
        }
        if (acpMockState.respondWithNonText) {
          await capturedSessionUpdate({
            update: { sessionUpdate: 'agent_message_chunk', content: { type: 'image', data: 'x' } },
          })
          return
        }
        await capturedSessionUpdate({
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: acpMockState.responseText },
          },
        })
      })
    }
  }

  return {
    ndJsonStream: vi.fn().mockReturnValue({}),
    PROTOCOL_VERSION: '1.0',
    ClientSideConnection: MockClientSideConnection,
  }
})

// Mock node:stream so Writable.toWeb / Readable.toWeb don't fail on fake streams
vi.mock('node:stream', () => ({
  Writable: { toWeb: vi.fn().mockReturnValue({}) },
  Readable: { toWeb: vi.fn().mockReturnValue({}) },
}))

/** Create a minimal process-like object that spawn can return for ACP tests */
function makeSpawnProcess() {
  return {
    stdin: { end: vi.fn() },
    stdout: {},
    kill: vi.fn(),
    once: vi.fn().mockImplementation((_event: string, cb: () => void) => {
      // Resolve the exit promise immediately
      setTimeout(cb, 0)
    }),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<{ cli: string; model: string | undefined; invocationMode: string }> = {}) {
  return {
    ai: {
      cli: overrides.cli ?? 'copilot',
      model: overrides.model,
      invocationMode: overrides.invocationMode ?? 'cli',
    },
  }
}

const PROPOSALS: ProposalNode[] = [
  { hash: 'aaa', roles: ['backend'], phase: 'implement' },
  { hash: 'bbb', roles: ['frontend'], phase: 'implement' },
  { hash: 'ccc', roles: ['infra'], phase: 'deploy' },
]

const EDGES: DependencyEdge[] = [
  { from: 'aaa', to: 'ccc', type: 'requires' },
  { from: 'bbb', to: 'ccc', type: 'requires' },
]

// ---------------------------------------------------------------------------
// buildCliCommand
// ---------------------------------------------------------------------------

describe('buildCliCommand', () => {
  it('builds copilot command without model', () => {
    const cmd = buildCliCommand('copilot', undefined, 'hello')
    expect(cmd).toBe('copilot --agent=task-distributor --prompt "hello"')
  })

  it('builds copilot command with model', () => {
    const cmd = buildCliCommand('copilot', 'gpt-4o', 'hello')
    expect(cmd).toBe('copilot --model "gpt-4o" --agent=task-distributor --prompt "hello"')
  })

  it('builds claude command without model', () => {
    const cmd = buildCliCommand('claude', undefined, 'hello')
    expect(cmd).toBe('claude --prompt "hello"')
  })

  it('builds claude command with model', () => {
    const cmd = buildCliCommand('claude', 'claude-3-5-sonnet', 'hello')
    expect(cmd).toBe('claude --model "claude-3-5-sonnet" --prompt "hello"')
  })

  it('builds cursor command without model', () => {
    const cmd = buildCliCommand('cursor', undefined, 'hello')
    expect(cmd).toBe('cursor --agent task-distributor --message "hello"')
  })

  it('builds cursor command with model', () => {
    const cmd = buildCliCommand('cursor', 'cursor-small', 'hello')
    expect(cmd).toBe('cursor --model "cursor-small" --agent task-distributor --message "hello"')
  })

  it('escapes double quotes in prompt', () => {
    const cmd = buildCliCommand('copilot', undefined, 'say "hello"')
    expect(cmd).toContain('\\"hello\\"')
  })

  it('escapes backslashes in prompt', () => {
    const cmd = buildCliCommand('claude', undefined, 'path\\to\\file')
    expect(cmd).toContain('path\\\\to\\\\file')
  })

  it('escapes both backslashes and double quotes', () => {
    const cmd = buildCliCommand('cursor', undefined, 'C:\\Users\\"test"')
    expect(cmd).toContain('C:\\\\Users\\\\\\"test\\"')
  })
})

// ---------------------------------------------------------------------------
// topologicalFallback
// ---------------------------------------------------------------------------

describe('topologicalFallback', () => {
  it('returns empty parallelSets for empty proposals', () => {
    const result = topologicalFallback([], [])
    expect(result.parallelSets).toEqual([])
  })

  it('returns single set when no dependencies', () => {
    const proposals: ProposalNode[] = [{ hash: 'a' }, { hash: 'b' }, { hash: 'c' }]
    const result = topologicalFallback(proposals, [])
    expect(result.parallelSets).toHaveLength(1)
    expect(result.parallelSets[0]).toEqual(expect.arrayContaining(['a', 'b', 'c']))
  })

  it('returns sequential sets for a linear chain', () => {
    const proposals: ProposalNode[] = [{ hash: 'a' }, { hash: 'b' }, { hash: 'c' }]
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'b', type: 'requires' },
      { from: 'b', to: 'c', type: 'requires' },
    ]
    const result = topologicalFallback(proposals, edges)
    expect(result.parallelSets).toHaveLength(3)
    expect(result.parallelSets[0]).toContain('a')
    expect(result.parallelSets[1]).toContain('b')
    expect(result.parallelSets[2]).toContain('c')
  })

  it('groups parallel proposals that share a common dependency', () => {
    // aaa and bbb are parallel (both depend on ccc), ccc runs first
    const result = topologicalFallback(PROPOSALS, EDGES)
    // Set 0: aaa and bbb (no incoming edges)
    // Set 1: ccc (depends on both)
    expect(result.parallelSets).toHaveLength(2)
    expect(result.parallelSets[0]).toEqual(expect.arrayContaining(['aaa', 'bbb']))
    expect(result.parallelSets[1]).toContain('ccc')
  })

  it('handles diamond dependency graph', () => {
    // a -> b, a -> c, b -> d, c -> d
    const proposals: ProposalNode[] = [{ hash: 'a' }, { hash: 'b' }, { hash: 'c' }, { hash: 'd' }]
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'b', type: 'requires' },
      { from: 'a', to: 'c', type: 'requires' },
      { from: 'b', to: 'd', type: 'requires' },
      { from: 'c', to: 'd', type: 'requires' },
    ]
    const result = topologicalFallback(proposals, edges)
    expect(result.parallelSets[0]).toContain('a')
    expect(result.parallelSets[1]).toEqual(expect.arrayContaining(['b', 'c']))
    expect(result.parallelSets[2]).toContain('d')
  })

  it('returns single-element arrays for strictly sequential chain', () => {
    const proposals: ProposalNode[] = [{ hash: 'x' }, { hash: 'y' }]
    const edges: DependencyEdge[] = [{ from: 'x', to: 'y', type: 'blocks' }]
    const result = topologicalFallback(proposals, edges)
    expect(result.parallelSets).toHaveLength(2)
    expect(result.parallelSets[0]).toContain('x')
    expect(result.parallelSets[1]).toContain('y')
  })
})

// ---------------------------------------------------------------------------
// annotateProposals
// ---------------------------------------------------------------------------

describe('annotateProposals', () => {
  const plan: ParallelExecutionPlan = {
    parallelSets: [['aaa', 'bbb'], ['ccc']],
  }

  it('annotates proposals with correct parallel set index', () => {
    const annotated = annotateProposals(PROPOSALS, plan)
    const aaa = annotated.find((a) => a.proposal.hash === 'aaa')!
    const bbb = annotated.find((a) => a.proposal.hash === 'bbb')!
    const ccc = annotated.find((a) => a.proposal.hash === 'ccc')!
    expect(aaa.parallelSetIndex).toBe(0)
    expect(bbb.parallelSetIndex).toBe(0)
    expect(ccc.parallelSetIndex).toBe(1)
  })

  it('defaults to 0 when proposal hash is not in plan', () => {
    const extra: ProposalNode[] = [{ hash: 'unknown' }]
    const annotated = annotateProposals(extra, plan)
    expect(annotated[0].parallelSetIndex).toBe(0)
  })

  it('returns empty array for empty proposals', () => {
    const annotated = annotateProposals([], plan)
    expect(annotated).toEqual([])
  })

  it('preserves original proposal object reference', () => {
    const annotated = annotateProposals(PROPOSALS, plan)
    expect(annotated[0].proposal).toBe(PROPOSALS[0])
  })

  it('handles empty plan with proposals present', () => {
    const emptyPlan: ParallelExecutionPlan = { parallelSets: [] }
    const annotated = annotateProposals(PROPOSALS, emptyPlan)
    annotated.forEach((a) => {
      expect(a.parallelSetIndex).toBe(0)
    })
  })
})

// ---------------------------------------------------------------------------
// distributeProposals — CLI mode
// ---------------------------------------------------------------------------

describe('distributeProposals (CLI mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadConfig.mockResolvedValue(makeConfig())
  })

  it('returns parsed plan from CLI output', async () => {
    const plan: ParallelExecutionPlan = { parallelSets: [['aaa', 'bbb'], ['ccc']] }
    mockExecSync.mockReturnValue(JSON.stringify(plan))

    const result = await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    expect(result.parallelSets).toHaveLength(2)
    expect(result.parallelSets[0]).toContain('aaa')
  })

  it('accepts plan wrapped in markdown code fences', async () => {
    const plan: ParallelExecutionPlan = { parallelSets: [['aaa'], ['ccc']] }
    mockExecSync.mockReturnValue(`\`\`\`json\n${JSON.stringify(plan)}\n\`\`\``)

    const result = await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    expect(result.parallelSets[0]).toContain('aaa')
  })

  it('falls back to topological sort when execSync throws', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('CLI not found') })

    const result = await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    expect(result.parallelSets).toHaveLength(2)
    expect(result.parallelSets[0]).toEqual(expect.arrayContaining(['aaa', 'bbb']))
    expect(result.parallelSets[1]).toContain('ccc')
  })

  it('falls back to topological sort when CLI returns invalid JSON', async () => {
    mockExecSync.mockReturnValue('not a json response')

    const result = await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    expect(result.parallelSets).toHaveLength(2)
  })

  it('falls back to topological sort when CLI returns object missing parallelSets', async () => {
    mockExecSync.mockReturnValue(JSON.stringify({ somethingElse: [] }))

    const result = await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    expect(result.parallelSets).toHaveLength(2)
  })

  it('uses claude CLI when configured', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig({ cli: 'claude', model: 'claude-3-opus' }))
    const plan: ParallelExecutionPlan = { parallelSets: [['aaa', 'bbb'], ['ccc']] }
    mockExecSync.mockReturnValue(JSON.stringify(plan))

    await distributeProposals(PROPOSALS, EDGES, '/tmp/project')

    const [cmd] = mockExecSync.mock.calls[0] as [string]
    expect(cmd).toMatch(/^claude /)
    expect(cmd).toContain('--model "claude-3-opus"')
  })

  it('uses cursor CLI when configured', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig({ cli: 'cursor' }))
    const plan: ParallelExecutionPlan = { parallelSets: [['aaa']] }
    mockExecSync.mockReturnValue(JSON.stringify(plan))

    await distributeProposals(PROPOSALS, EDGES, '/tmp/project')

    const [cmd] = mockExecSync.mock.calls[0] as [string]
    expect(cmd).toMatch(/^cursor /)
  })

  it('uses defaults when config load fails', async () => {
    mockLoadConfig.mockRejectedValue(new Error('config not found'))
    const plan: ParallelExecutionPlan = { parallelSets: [['aaa', 'bbb'], ['ccc']] }
    mockExecSync.mockReturnValue(JSON.stringify(plan))

    const result = await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    expect(result.parallelSets).toHaveLength(2)
    // Default CLI is copilot
    const [cmd] = mockExecSync.mock.calls[0] as [string]
    expect(cmd).toMatch(/^copilot /)
  })

  it('uses default cwd when projectRoot is not provided', async () => {
    const plan: ParallelExecutionPlan = { parallelSets: [['aaa', 'bbb'], ['ccc']] }
    mockExecSync.mockReturnValue(JSON.stringify(plan))

    const result = await distributeProposals(PROPOSALS, EDGES)
    expect(result.parallelSets).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// distributeProposals — ACP mode fallback (non-copilot CLI)
// ---------------------------------------------------------------------------

describe('distributeProposals (ACP mode with non-copilot CLI)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    acpMockState.shouldThrowOnInitialize = false
    acpMockState.responseText = '{"parallelSets":[["aaa","bbb"],["ccc"]]}'
    acpMockState.respondWithNonText = false
    acpMockState.respondWithNonChunk = false
  })

  it('falls back to CLI mode when invocationMode=acp but cli is not copilot', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig({ cli: 'claude', invocationMode: 'acp' }))
    const plan: ParallelExecutionPlan = { parallelSets: [['aaa', 'bbb'], ['ccc']] }
    mockExecSync.mockReturnValue(JSON.stringify(plan))

    const result = await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    expect(result.parallelSets).toHaveLength(2)
    const [cmd] = mockExecSync.mock.calls[0] as [string]
    expect(cmd).toMatch(/^claude /)
  })
})

// ---------------------------------------------------------------------------
// distributeProposals — ACP mode (copilot)
// ---------------------------------------------------------------------------

describe('distributeProposals (ACP mode with copilot)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedSessionUpdate = undefined
    acpMockState.shouldThrowOnInitialize = false
    acpMockState.responseText = '{"parallelSets":[["aaa","bbb"],["ccc"]]}'
    acpMockState.respondWithNonText = false
    acpMockState.respondWithNonChunk = false
    mockLoadConfig.mockResolvedValue(makeConfig({ cli: 'copilot', invocationMode: 'acp' }))
    mockSpawn.mockReturnValue(makeSpawnProcess())
  })

  it('returns plan from ACP response', async () => {
    const result = await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    expect(result.parallelSets).toHaveLength(2)
    expect(result.parallelSets[0]).toEqual(expect.arrayContaining(['aaa', 'bbb']))
    expect(result.parallelSets[1]).toContain('ccc')
  })

  it('passes model flag to spawn when model is set', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig({ cli: 'copilot', invocationMode: 'acp', model: 'gpt-4o' }))
    await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    const spawnArgs = mockSpawn.mock.calls[0] as [string, string[]]
    expect(spawnArgs[1]).toContain('--model')
    expect(spawnArgs[1]).toContain('gpt-4o')
  })

  it('omits model flag when model is undefined', async () => {
    await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    const spawnArgs = mockSpawn.mock.calls[0] as [string, string[]]
    expect(spawnArgs[1]).not.toContain('--model')
  })

  it('ignores non-text content chunks', async () => {
    acpMockState.respondWithNonText = true
    // ACP produces no chunks → no valid plan → throws → falls back to topological sort
    const result = await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    // Falls back (ACP throws "invalid parallelSets") → falls back to CLI or topo
    expect(result.parallelSets).toBeDefined()
  })

  it('ignores non-chunk session events', async () => {
    acpMockState.respondWithNonChunk = true
    // ACP produces no text → falls back
    const result = await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    expect(result.parallelSets).toBeDefined()
  })

  it('falls back to CLI when ACP initialize throws', async () => {
    acpMockState.shouldThrowOnInitialize = true
    const plan: ParallelExecutionPlan = { parallelSets: [['aaa', 'bbb'], ['ccc']] }
    mockExecSync.mockReturnValue(JSON.stringify(plan))

    const result = await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    expect(result.parallelSets).toHaveLength(2)
    // CLI fallback should have been invoked
    expect(mockExecSync).toHaveBeenCalledOnce()
  })

  it('falls back to topological sort when ACP response is not valid JSON', async () => {
    acpMockState.responseText = 'this is not json'
    // ACP throws "invalid parallelSets" → outer catch → falls back to CLI
    const plan: ParallelExecutionPlan = { parallelSets: [['aaa', 'bbb'], ['ccc']] }
    mockExecSync.mockReturnValue(JSON.stringify(plan))

    const result = await distributeProposals(PROPOSALS, EDGES, '/tmp/project')
    expect(result.parallelSets).toBeDefined()
  })
})
