/**
 * Proposals Registry: proposal_create Coverage Tests
 *
 * Tests the proposal_create operation branches:
 * - Solitary + gateId conflict → error
 * - No gateId and not solitary → error
 * - gateId not found in overview → warning
 * - gateId found in overview → no warning
 * - readProjectOverview throws → skip gate check (no warning)
 * - Dependencies with validation errors → early return
 * - Dependencies with warnings only → success with warnings
 * - Solitary proposal → solitary file path
 * - Gate-tied proposal → gate dir file path
 * - syncProposalsFromDisk failure → non-fatal (still succeeds)
 * - Tasks with empty acceptanceCriteria → fallback text
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerProposalsOps } from '../../src/integration/proposals-registry.js'

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockShortHash = vi.fn()
const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockGetDatabase = vi.fn()
const mockSyncProposalsFromDisk = vi.fn()
const mockReadProjectOverview = vi.fn()
const mockGetGatesFromOverview = vi.fn()
const mockValidateDependencies = vi.fn()
const mockPrepare = vi.fn()
const mockAll = vi.fn()

vi.mock('../../src/mcp/schemas/proposal-create-schemas.js', () => ({
  ProposalCreateInputSchema: {
    parse: (params: unknown) => {
      const p = params as Record<string, unknown>
      return {
        title: String(p.title ?? 'Test Proposal'),
        summary: String(p.summary ?? 'A test proposal summary.'),
        gateId: (p.gateId as string | undefined) ?? undefined,
        solitary: Boolean(p.solitary ?? false),
        tasks: (p.tasks as Array<{ description: string; acceptanceCriteria?: string[] }>) ?? [
          { description: 'Default task', acceptanceCriteria: ['Done'] },
        ],
        filesAffected: (p.filesAffected as string[]) ?? [],
        dependencies: (p.dependencies as string[]) ?? [],
        context: p.context as string | undefined,
      }
    },
  },
}))

vi.mock('../../src/utils/hash.js', () => ({
  shortHash: (...args: unknown[]) => mockShortHash(...args),
}))

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock('path', () => ({
  join: (...parts: string[]) => parts.join('/'),
}))

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}))

vi.mock('../../src/storage/proposal-sync.js', () => ({
  syncProposalsFromDisk: (...args: unknown[]) => mockSyncProposalsFromDisk(...args),
}))

vi.mock('../../src/utils/config.js', () => ({
  getZenoDir: vi.fn().mockReturnValue('/project/zeno/.zeno'),
  readProjectOverview: (...args: unknown[]) => mockReadProjectOverview(...args),
  getGatesFromOverview: (...args: unknown[]) => mockGetGatesFromOverview(...args),
  loadConfig: vi.fn().mockResolvedValue({ quality: { coverageThreshold: 90 } }),
  getDefaultConfig: vi.fn().mockReturnValue({}),
}))

vi.mock('../../src/mcp/validators/dependency-validator.js', () => ({
  validateDependencies: (...args: unknown[]) => mockValidateDependencies(...args),
}))

// Mocks for other ops registered alongside proposal_create
vi.mock('../../src/integration/command-invoker.js', () => ({
  invokeCommand: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('../../src/mcp/validators/quality-validator.js', () => ({
  validateQuality: vi.fn().mockResolvedValue({ allowed: true, warnings: [] }),
}))
vi.mock('../../src/mcp/validators/proposal-phases-validator.js', () => ({
  validateProposalPhases: vi.fn().mockReturnValue({ errors: [], warnings: [] }),
}))
vi.mock('../../src/mcp/validators/apply-phase-validator.js', () => ({
  validateApplyPhase: vi.fn().mockReturnValue({ allowed: true, warnings: [] }),
}))
vi.mock('../../src/mcp/validators/artifact-validator.js', () => ({
  validateArtifactFile: vi.fn().mockResolvedValue({ allowed: true }),
}))
vi.mock('../../src/utils/artifact-locator.js', () => ({
  findProposalByHash: vi.fn().mockResolvedValue(null),
}))
vi.mock('../../src/utils/file.js', () => ({
  readFile: vi.fn().mockResolvedValue(''),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readdirSync: vi.fn().mockReturnValue([]),
}))

// ---------------------------------------------------------------------------
// Minimal proposal template
// ---------------------------------------------------------------------------
const PROPOSAL_TEMPLATE = `# Proposal: [Proposal Title]

**Hash**: #[Generated SHA-256 first 16 chars]
**Date**: [DATE]
**Status**: pending

## Summary

[2-3 sentence description of what this proposal accomplishes. Focus on the outcome, not the process.]

---

## Tasks

### Task 1: Placeholder

**Acceptance**:
- [ ] Done

---

### Task 2: Placeholder

**Acceptance**:
- [ ] Done

---

### Task 3: Placeholder

**Acceptance**:
- [ ] Done

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| src/example.ts | modify | Example |

---

## Dependencies

No dependencies.
`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('proposals-registry: proposal_create', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new FunctionRegistry()

    mockShortHash.mockReturnValue('abcdef1234567890')
    mockReadFile.mockResolvedValue(PROPOSAL_TEMPLATE)
    mockWriteFile.mockResolvedValue(undefined)
    mockReadProjectOverview.mockResolvedValue({})
    mockGetGatesFromOverview.mockReturnValue([{ id: 'gate-01' }])
    mockGetDatabase.mockReturnValue({ prepare: mockPrepare })
    mockPrepare.mockReturnValue({ all: mockAll })
    mockAll.mockReturnValue([])
    mockValidateDependencies.mockReturnValue({ errors: [], warnings: [] })
    mockSyncProposalsFromDisk.mockImplementation(() => undefined)

    registerProposalsOps(registry)
  })

  it('returns validation error when solitary and gateId both provided', async () => {
    const result = (await registry.invoke('proposal_create', {
      title: 'Conflict Proposal',
      summary: 'Summary',
      solitary: true,
      gateId: 'gate-01',
      tasks: [{ description: 'task', acceptanceCriteria: ['done'] }],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as { validation: { passed: boolean; errors: string[] } }
    expect(data.validation.passed).toBe(false)
    expect(data.validation.errors).toContain('Proposal cannot be both solitary and gate-tied')
  })

  it('returns validation error when neither solitary nor gateId provided', async () => {
    const result = (await registry.invoke('proposal_create', {
      title: 'Orphan Proposal',
      summary: 'Summary',
      solitary: false,
      tasks: [{ description: 'task', acceptanceCriteria: [] }],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as { validation: { passed: boolean; errors: string[] } }
    expect(data.validation.passed).toBe(false)
    expect(data.validation.errors).toContain('Proposal must either be solitary or have a gateId')
  })

  it('adds warning when gateId is provided but gate not found in overview', async () => {
    mockGetGatesFromOverview.mockReturnValue([]) // no matching gates

    const result = (await registry.invoke('proposal_create', {
      title: 'Gate Missing Proposal',
      summary: 'Summary',
      gateId: 'gate-99',
      tasks: [{ description: 'task', acceptanceCriteria: ['criterion'] }],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as { validation: { passed: boolean; warnings: string[] } }
    expect(data.validation.passed).toBe(true)
    expect(data.validation.warnings.some((w) => w.includes('gate-99'))).toBe(true)
  })

  it('does not add gate warning when gateId found in overview', async () => {
    mockGetGatesFromOverview.mockReturnValue([{ id: 'gate-01' }, { id: 'gate-02' }])

    const result = (await registry.invoke('proposal_create', {
      title: 'Known Gate Proposal',
      summary: 'Summary',
      gateId: 'gate-01',
      tasks: [{ description: 'task', acceptanceCriteria: ['done'] }],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as { validation: { passed: boolean; warnings: string[] } }
    expect(data.validation.passed).toBe(true)
    // No warning about gate not found
    expect(data.validation.warnings.every((w) => !w.includes('not found'))).toBe(true)
  })

  it('skips gate check without warning when readProjectOverview throws', async () => {
    mockReadProjectOverview.mockRejectedValue(new Error('overview not available'))

    const result = (await registry.invoke('proposal_create', {
      title: 'Proposal',
      summary: 'Summary',
      gateId: 'gate-01',
      tasks: [{ description: 'task', acceptanceCriteria: [] }],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as { validation: { passed: boolean; warnings: string[] } }
    expect(data.validation.passed).toBe(true)
    // No warning from gate check (skipped due to exception)
    expect(data.validation.warnings).toHaveLength(0)
  })

  it('returns errors when dependency validation produces errors', async () => {
    mockValidateDependencies.mockReturnValue({
      errors: ['Circular dependency detected'],
      warnings: ['dep-abc not found'],
    })

    const result = (await registry.invoke('proposal_create', {
      title: 'Dep Error Proposal',
      summary: 'Summary',
      gateId: 'gate-01',
      tasks: [{ description: 'task', acceptanceCriteria: [] }],
      dependencies: ['dep-abc12345'],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as { validation: { passed: boolean; errors: string[] } }
    expect(data.validation.passed).toBe(false)
    expect(data.validation.errors).toContain('Circular dependency detected')
  })

  it('includes dependency warnings in successful result', async () => {
    mockValidateDependencies.mockReturnValue({
      errors: [],
      warnings: ['dependency warning message'],
    })

    const result = (await registry.invoke('proposal_create', {
      title: 'Dep Warning Proposal',
      summary: 'Summary',
      gateId: 'gate-01',
      tasks: [{ description: 'task', acceptanceCriteria: [] }],
      dependencies: ['dep-abc12345'],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as { validation: { passed: boolean; warnings: string[] } }
    expect(data.validation.passed).toBe(true)
    expect(data.validation.warnings).toContain('dependency warning message')
  })

  it('creates solitary proposal with solitary path', async () => {
    const result = (await registry.invoke('proposal_create', {
      title: 'Solo Feature',
      summary: 'Summary',
      solitary: true,
      tasks: [{ description: 'task', acceptanceCriteria: ['done'] }],
      filesAffected: ['src/feature.ts'],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as { filePath: string; validation: { passed: boolean } }
    expect(data.validation.passed).toBe(true)
    expect(data.filePath).toContain('solitary')
    expect(mockWriteFile).toHaveBeenCalled()
  })

  it('creates gate-tied proposal with gate directory path', async () => {
    const result = (await registry.invoke('proposal_create', {
      title: 'Gate Proposal',
      summary: 'Summary',
      gateId: 'gate-03',
      tasks: [{ description: 'task', acceptanceCriteria: [] }],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as { filePath: string; validation: { passed: boolean } }
    expect(data.validation.passed).toBe(true)
    expect(data.filePath).toContain('gate-03')
    expect(mockWriteFile).toHaveBeenCalled()
  })

  it('handles non-fatal syncProposalsFromDisk failure gracefully', async () => {
    mockSyncProposalsFromDisk.mockImplementation(() => {
      throw new Error('sync failed')
    })

    const result = (await registry.invoke('proposal_create', {
      title: 'Sync Fail Test',
      summary: 'Summary',
      gateId: 'gate-01',
      tasks: [{ description: 'task', acceptanceCriteria: [] }],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as { validation: { passed: boolean } }
    expect(data.validation.passed).toBe(true)
  })

  it('uses fallback acceptance criteria text when task criteria is empty', async () => {
    const result = (await registry.invoke('proposal_create', {
      title: 'Empty AC Proposal',
      summary: 'Summary',
      gateId: 'gate-01',
      tasks: [{ description: 'task with no criteria', acceptanceCriteria: [] }],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    expect(mockWriteFile).toHaveBeenCalled()
    const writtenContent = mockWriteFile.mock.calls[0]?.[1] as string
    expect(writtenContent).toContain('Implementation complete')
  })

  it('returns result with all expected fields', async () => {
    const result = (await registry.invoke('proposal_create', {
      title: 'Full Proposal',
      summary: 'A complete proposal for testing.',
      gateId: 'gate-01',
      tasks: [{ description: 'main task', acceptanceCriteria: ['criterion 1', 'criterion 2'] }],
      filesAffected: ['src/module.ts', 'tests/module.test.ts'],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as {
      hash: string
      filePath: string
      status: string
      createdAt: string
      validation: { passed: boolean; errors: string[]; warnings: string[] }
    }
    expect(data.hash).toBeDefined()
    expect(data.filePath).toBeDefined()
    expect(data.status).toBe('pending')
    expect(data.createdAt).toBeDefined()
    expect(data.validation.passed).toBe(true)
  })
})
