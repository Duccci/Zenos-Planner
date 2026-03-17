/**
 * Gates Registry: gate_create Coverage Tests
 *
 * Tests the gate_create operation which has the following branches:
 * - Duplicate gate ID validation
 * - Invalid gate type validation
 * - Missing dependency (warning path)
 * - Successful creation with file write
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerGatesOps } from '../../src/integration/gates-registry.js'

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockGet = vi.fn()
const mockAll = vi.fn()
const mockRun = vi.fn()
const mockPrepare = vi.fn()
const mockGetDatabase = vi.fn()
const mockReadProjectOverview = vi.fn()
const mockGetGatesFromOverview = vi.fn()
const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockInvokeCommand = vi.fn()

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}))

vi.mock('../../src/utils/config.js', () => ({
  getZenoDir: vi.fn().mockReturnValue('/project/zeno/.zeno'),
  getWorkspaceRoot: vi.fn().mockReturnValue('/mock/project'),
  readProjectOverview: (...args: unknown[]) => mockReadProjectOverview(...args),
  getGatesFromOverview: (...args: unknown[]) => mockGetGatesFromOverview(...args),
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readdirSync: vi.fn().mockReturnValue([]),
}))

vi.mock('../../src/integration/command-invoker.js', () => ({
  invokeCommand: (...args: unknown[]) => mockInvokeCommand(...args),
}))

// Dynamic imports inside gate_create need to be mocked
vi.mock('../../src/mcp/schemas/gate-create-schemas.js', () => ({
  GateCreateInputSchema: {
    parse: (params: unknown) => {
      // Minimal passthrough parse for testing
      const p = params as Record<string, unknown>
      return {
        gateId: p.gateId ?? 'gate-01',
        name: p.name ?? 'Test Gate',
        type: p.type ?? 'feature',
        sequence: p.sequence ?? 1,
        dependencies: (p.dependencies ?? []) as string[],
        objectives: (p.objectives ?? ['Objective 1']) as string[],
        description: p.description as string | undefined,
      }
    },
  },
}))

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock('../../src/utils/file.js', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  normalizePath: (p: string) => p.replace(/\\/g, '/'),
}))

vi.mock('path', () => ({
  join: (...parts: string[]) => parts.join('/'),
}))

const GATE_TEMPLATE = `# Gate [XX]: [Gate Name]
**Type**: [feature | quality | rescope]
**Date**: [YYYY-MM-DD]
**Hash**: [hash]

## Objectives
- [ ] [Objective with measurable outcome]
- [ ] [Objective with measurable outcome]
- [ ] [Objective with measurable outcome]
`

describe('gates-registry: gate_create', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new FunctionRegistry()

    mockPrepare.mockImplementation(() => ({ get: mockGet, all: mockAll, run: mockRun }))
    mockRun.mockReturnValue({ changes: 1 })
    mockGet.mockReturnValue(undefined) // no existing gate by default
    mockGetDatabase.mockReturnValue({ prepare: mockPrepare })
    mockReadProjectOverview.mockResolvedValue({})
    mockGetGatesFromOverview.mockReturnValue([])
    mockInvokeCommand.mockResolvedValue({ success: true })
    mockReadFile.mockResolvedValue(GATE_TEMPLATE)
    mockWriteFile.mockResolvedValue(undefined)

    registerGatesOps(registry)
  })

  it('returns validation error for duplicate gate ID', async () => {
    // existing gate found
    mockGet.mockReturnValue({ id: 'gate-01' })

    const result = (await registry.invoke('gate_create', {
      gateId: 'gate-01',
      name: 'Duplicate Gate',
      type: 'feature',
      sequence: 1,
      objectives: ['Obj 1'],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as { validation: { passed: boolean; errors: string[] } }
    expect(data.validation.passed).toBe(false)
    expect(data.validation.errors).toContain('Gate ID gate-01 already exists')
  })

  it('adds warning for non-existent dependency but still succeeds', async () => {
    mockGet
      .mockReturnValueOnce(undefined) // gate-03 doesn't exist => no duplicate
      .mockReturnValueOnce(undefined) // dep gate-02 doesn't exist

    const result = (await registry.invoke('gate_create', {
      gateId: 'gate-03',
      name: 'New Gate',
      type: 'feature',
      sequence: 3,
      objectives: ['Launch product'],
      dependencies: ['gate-02'],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    const data = result.data as { validation: { passed: boolean; warnings: string[] } }
    expect(data.validation.passed).toBe(true)
    expect(data.validation.warnings.some((w) => w.includes('gate-02'))).toBe(true)
  })

  it('creates gate file successfully with valid input', async () => {
    mockGet.mockReturnValue(undefined) // no duplicate, no missing deps

    const result = (await registry.invoke('gate_create', {
      gateId: 'gate-02',
      name: 'Core Infrastructure',
      type: 'feature',
      sequence: 2,
      objectives: ['Build foundation', 'Enable extensibility'],
    })) as { success: boolean; data: unknown }

    expect(result.success).toBe(true)
    expect(mockWriteFile).toHaveBeenCalled()

    const data = result.data as {
      gateId: string
      filePath: string
      validation: { passed: boolean; errors: string[] }
      roadmapUpdated: boolean
    }
    expect(data.gateId).toBe('gate-02')
    expect(data.validation.passed).toBe(true)
    expect(data.validation.errors).toHaveLength(0)
    expect(data.roadmapUpdated).toBe(false)
  })

  it('fails schema validation for missing name (schema throws)', async () => {
    // Use a completely invalid type to trigger ZodError from the real schema
    // (our vi.mock passthrough just returns the params, so we make parse throw)
    const { GateCreateInputSchema } = await import('../../src/mcp/schemas/gate-create-schemas.js')
    const savedParse = GateCreateInputSchema.parse
    GateCreateInputSchema.parse = (() => {
      throw new Error('Name is required')
    }) as typeof GateCreateInputSchema.parse

    const result = (await registry.invoke('gate_create', {
      gateId: 'gate-10',
      type: 'feature',
      sequence: 10,
      objectives: ['Obj'],
    })) as { success: boolean }

    GateCreateInputSchema.parse = savedParse

    expect(result.success).toBe(false)
  })
})
