import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reconcileGatePRD, computeTemplateHash } from '../../src/core/gate-prd-reconciler.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReadFile = vi.fn<() => Promise<string>>()
const mockWriteFile = vi.fn<() => Promise<void>>()
const mockFindGateByGateId = vi.fn<() => Promise<string | null>>()

vi.mock('../../src/utils/file.js', () => ({
  readFile: (...args: unknown[]) => (mockReadFile as (...a: unknown[]) => unknown)(...args),
  writeFile: (...args: unknown[]) => (mockWriteFile as (...a: unknown[]) => unknown)(...args),
}))

vi.mock('../../src/utils/artifact-locator.js', () => ({
  findGateByGateId: (...args: unknown[]) => (mockFindGateByGateId as (...a: unknown[]) => unknown)(...args),
}))

const mockDbPrepare = vi.fn()
const mockDbAll = vi.fn()
vi.mock('../../src/storage/database.js', () => ({
  getDatabase: vi.fn(() => ({
    prepare: mockDbPrepare,
  })),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    readFileSync: vi.fn(() => 'fake-template-content'),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIXTURE_PLACEHOLDER = `---
zeno:
  id: gate-01
  status: in_progress
---

# Gate 01: Test Gate

### Gate-Specific Requirements

**Status**: Requirements will be generated when gate is started.

[After gate start, view detailed requirement information via: \`zeno req show <hash>\`]

### Proposal Status

**Status**: Proposals will be generated when gate is started.

[After gate start, view detailed proposal information via: \`zeno proposal show <hash>\`]
`

const FIXTURE_WITH_MARKERS = `---
zeno:
  id: gate-01
  status: in_progress
  template_hash: 'abc123def456789a'
---

# Gate 01: Test Gate

<!-- ZENO:AUTO:START:requirements -->
| Hash | Name | Type | Priority | Status |
| ---- | ---- | ---- | -------- | ------ |
| #oldhash | Old Req | functional | must | pending |
<!-- ZENO:AUTO:END:requirements -->

<!-- ZENO:AUTO:START:proposals -->
| Proposal | Hash | Status |
| -------- | ---- | ------ |
| Old Prop | #oldprop | pending |
<!-- ZENO:AUTO:END:proposals -->
`

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeTemplateHash', () => {
  it('returns a 16-character hex string', () => {
    const hash = computeTemplateHash()
    expect(hash).toMatch(/^[a-f0-9]{16}$/)
  })

  it('is stable (same result on two calls)', () => {
    expect(computeTemplateHash()).toBe(computeTemplateHash())
  })
})

describe('reconcileGatePRD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindGateByGateId.mockResolvedValue('/project/zeno/gates/gate-01-test-gate.md')
    mockReadFile.mockResolvedValue(FIXTURE_PLACEHOLDER)
    mockWriteFile.mockResolvedValue(undefined)
    const statement = { all: mockDbAll }
    mockDbPrepare.mockReturnValue(statement)
    mockDbAll.mockReturnValue([])
  })

  it('handles missing gate file gracefully without throwing', async () => {
    mockFindGateByGateId.mockResolvedValue(null)
    await expect(reconcileGatePRD('gate-01', '/project')).resolves.toBeUndefined()
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('embeds template_hash into YAML frontmatter when absent', async () => {
    await reconcileGatePRD('gate-01', '/project')
    const written: string = (mockWriteFile.mock.calls[0] as unknown as [string, string])[1]
    expect(written).toMatch(/template_hash:\s*'[a-f0-9]{16}'/)
  })

  it('replaces stale Requirements placeholder with live requirement rows', async () => {
    mockDbAll
      .mockReturnValueOnce([
        { hash: 'aabbccddeeff0011', name: 'Validate input', type: 'functional', priority: 'must', status: 'pending' },
      ])
      .mockReturnValueOnce([])
    await reconcileGatePRD('gate-01', '/project')
    const written: string = (mockWriteFile.mock.calls[0] as unknown as [string, string])[1]
    expect(written).toContain('ZENO:AUTO:START:requirements')
    expect(written).toContain('#aabbccddeeff0011')
    expect(written).toContain('Validate input')
  })

  it('replaces stale Proposals placeholder with live proposal rows', async () => {
    mockDbAll
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        { hash: '1122334455667788', title: 'Build API layer', status: 'in_progress' },
      ])
    await reconcileGatePRD('gate-01', '/project')
    const written: string = (mockWriteFile.mock.calls[0] as unknown as [string, string])[1]
    expect(written).toContain('ZENO:AUTO:START:proposals')
    expect(written).toContain('Build API layer')
    expect(written).toContain('#1122334455667788')
  })

  it('replaces marker-bounded sections on subsequent reconciliation passes', async () => {
    mockReadFile.mockResolvedValue(FIXTURE_WITH_MARKERS)
    mockDbAll
      .mockReturnValueOnce([
        { hash: 'newhash000000001', name: 'New Req', type: 'non_functional', priority: 'should', status: 'implemented' },
      ])
      .mockReturnValueOnce([
        { hash: 'newproph00000001', title: 'New Proposal', status: 'pending' },
      ])
    await reconcileGatePRD('gate-01', '/project')
    const written: string = (mockWriteFile.mock.calls[0] as unknown as [string, string])[1]
    expect(written).toContain('New Req')
    expect(written).toContain('New Proposal')
    expect(written).not.toContain('Old Req')
    expect(written).not.toContain('Old Prop')
  })

  it('writes valid tables for gate with no requirements or proposals', async () => {
    mockDbAll.mockReturnValue([])
    await reconcileGatePRD('gate-01', '/project')
    const written: string = (mockWriteFile.mock.calls[0] as unknown as [string, string])[1]
    expect(written).toContain('ZENO:AUTO:START:requirements')
    expect(written).toContain('ZENO:AUTO:START:proposals')
    expect(written).toContain('No requirements generated yet')
    expect(written).toContain('No proposals generated yet')
  })

  it('preserves user-edited content outside auto-managed sections', async () => {
    mockReadFile.mockResolvedValue(FIXTURE_WITH_MARKERS)
    mockDbAll.mockReturnValue([])
    await reconcileGatePRD('gate-01', '/project')
    const written: string = (mockWriteFile.mock.calls[0] as unknown as [string, string])[1]
    expect(written).toContain('# Gate 01: Test Gate')
    expect(written).toContain('id: gate-01')
  })

  it('still writes template_hash when DB query fails', async () => {
    mockDbPrepare.mockImplementation(() => { throw new Error('DB unavailable') })
    await expect(reconcileGatePRD('gate-01', '/project')).resolves.toBeUndefined()
    const written: string = (mockWriteFile.mock.calls[0] as unknown as [string, string])[1]
    expect(written).toMatch(/template_hash:\s*'[a-f0-9]{16}'/)
  })
})