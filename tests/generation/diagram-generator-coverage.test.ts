/**
 * Targeted coverage tests for diagram generators with low coverage.
 *
 * Covers:
 *  - context-diagram-generator.ts   lines 35, 49-50
 *  - data-flow-generator.ts         lines 42, 58-152
 *  - deployment-diagram-generator.ts lines 24-28, 134-142
 *  - network-diagram-generator.ts   lines 25-29, 130-138
 *  - gate-roadmap-generator.ts      line 47
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContextDiagramGenerator } from '../../src/generation/diagram-generators/context-diagram-generator.js'
import { DataFlowGenerator } from '../../src/generation/diagram-generators/data-flow-generator.js'
import { DeploymentDiagramGenerator } from '../../src/generation/diagram-generators/deployment-diagram-generator.js'
import { NetworkDiagramGenerator } from '../../src/generation/diagram-generators/network-diagram-generator.js'
import { GateRoadmapGenerator } from '../../src/generation/diagram-generators/gate-roadmap-generator.js'

// ---------------------------------------------------------------------------
// node:fs mock — hoisted by vitest so all generators that import readFileSync
// will use the mock.  Default impl throws ENOENT; individual tests override.
// ---------------------------------------------------------------------------
const mockReadFileSync = vi.fn<(...args: unknown[]) => unknown>()

vi.mock('node:fs', () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}))

beforeEach(() => {
  mockReadFileSync.mockImplementation(() => {
    const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException
    err.code = 'ENOENT'
    throw err
  })
})

// ---------------------------------------------------------------------------
// ContextDiagramGenerator — lines 35, 49-50
// ---------------------------------------------------------------------------
describe('ContextDiagramGenerator (coverage gaps)', () => {
  it('extracts and returns mermaid content from context-diagram.md when present', () => {
    // Covers extractMermaidFromMarkdown (lines 49-50) and the `return diagram` branch (line 35)
    const markdownWithMermaid =
      '# Context Diagram\n\n```mermaid\ngraph LR\n    A --> B\n```\n'
    mockReadFileSync.mockReturnValueOnce(markdownWithMermaid)

    const gen = new ContextDiagramGenerator()
    const content = gen.generateContent({ projectName: 'Test' })

    expect(content).toBe('graph LR\n    A --> B')
  })

  it('falls back to aspirational diagram when file contains no mermaid block', () => {
    // Covers extractMermaidFromMarkdown returning null (lines 49-50 executed, null returned)
    mockReadFileSync.mockReturnValueOnce('# Context Diagram\n\nNo mermaid block here.\n')

    const gen = new ContextDiagramGenerator()
    const content = gen.generateContent({ projectName: 'Test' })

    expect(content).toContain('graph TB')
    expect(content).toContain('Zeno')
  })

  it('falls back to aspirational diagram when file is not found (default mock)', () => {
    const gen = new ContextDiagramGenerator()
    const content = gen.generateContent({ projectName: 'Test' })

    expect(content).toContain('graph TB')
    expect(content).toContain('subgraph')
  })

  it('countNodes returns 10 fixed value', () => {
    const gen = new ContextDiagramGenerator()
    // Access protected method via bracket notation
    const count = (gen as unknown as { countNodes: (c: object) => number }).countNodes({
      projectName: 'Test',
    })
    expect(count).toBe(10)
  })

  it('countEdges returns 13 fixed value', () => {
    const gen = new ContextDiagramGenerator()
    const count = (gen as unknown as { countEdges: (c: object) => number }).countEdges({
      projectName: 'Test',
    })
    expect(count).toBe(13)
  })
})

// ---------------------------------------------------------------------------
// DataFlowGenerator — lines 42, 58-152
// ---------------------------------------------------------------------------
describe('DataFlowGenerator (coverage gaps)', () => {
  it('generates aspirational flowchart when data-flow.md is not found', () => {
    // Default mock throws → exercises generateAspirationaDataFlow (lines 58-152)
    // and the fallback return statement (line 42)
    const gen = new DataFlowGenerator()
    const content = gen.generateContent({ projectName: 'Test' })

    expect(content).toMatch(/^flowchart TD/)
    expect(content).toContain('-->') // Has edges
  })

  it('aspirational flowchart includes entry and completion nodes', () => {
    const gen = new DataFlowGenerator()
    const content = gen.generateContent({ projectName: 'Test' })

    expect(content).toMatch(/User|Start|Init/) // entry point
    expect(content).toMatch(/Complete|ProjectComplete/) // completion node
  })

  it('generates aspirational flowchart when file exists but has no mermaid block', () => {
    mockReadFileSync.mockReturnValueOnce('# Data Flow\n\nNo mermaid block here.\n')

    const gen = new DataFlowGenerator()
    const content = gen.generateContent({ projectName: 'Test' })

    expect(content).toMatch(/^flowchart TD/)
  })

  it('countNodes uses context.gates length when gates are provided', () => {
    // Covers the `context.gates?.length` branch (vs the `?? 25` fallback)
    const gen = new DataFlowGenerator()
    const context = {
      projectName: 'T',
      gates: [
        { id: 'g01', number: 1, name: 'G1', status: 'completed' as const },
        { id: 'g02', number: 2, name: 'G2', status: 'pending' as const },
      ],
    }
    const count = (gen as unknown as { countNodes: (c: typeof context) => number }).countNodes(
      context
    )
    expect(count).toBe(2)
  })

  it('countEdges scales 1.5x from gates length when gates are provided', () => {
    const gen = new DataFlowGenerator()
    const context = {
      projectName: 'T',
      gates: [
        { id: 'g01', number: 1, name: 'G1', status: 'completed' as const },
        { id: 'g02', number: 2, name: 'G2', status: 'pending' as const },
        { id: 'g03', number: 3, name: 'G3', status: 'in_progress' as const },
        { id: 'g04', number: 4, name: 'G4', status: 'pending' as const },
      ],
    }
    const count = (gen as unknown as { countEdges: (c: typeof context) => number }).countEdges(
      context
    )
    expect(count).toBe(6) // 4 * 1.5
  })
})

// ---------------------------------------------------------------------------
// DeploymentDiagramGenerator (impl class direct) — lines 24-28, 134-142
// ---------------------------------------------------------------------------
describe('DeploymentDiagramGenerator impl (coverage gaps)', () => {
  it('getType returns deployment', () => {
    // Covers lines 24-25 (getType method body)
    const gen = new DeploymentDiagramGenerator()
    expect(gen.getType()).toBe('deployment')
  })

  it('getCategory returns conditional', () => {
    // Covers lines 27-28 (getCategory method body)
    const gen = new DeploymentDiagramGenerator()
    expect(gen.getCategory()).toBe('conditional')
  })

  it('countEdges returns 15', () => {
    // Covers countEdges method body (~line 138-140)
    const gen = new DeploymentDiagramGenerator()
    const count = (gen as unknown as { countEdges: () => number }).countEdges()
    expect(count).toBe(15)
  })

  it('countNestingDepth returns 4', () => {
    // Covers countNestingDepth method body (~line 142-144)
    const gen = new DeploymentDiagramGenerator()
    const count = (gen as unknown as { countNestingDepth: () => number }).countNestingDepth()
    expect(count).toBe(4)
  })

  it('countNodes returns 8', () => {
    const gen = new DeploymentDiagramGenerator()
    const count = (gen as unknown as { countNodes: () => number }).countNodes()
    expect(count).toBe(8)
  })

  it('uses default Production env in generated DOT diagram', () => {
    const gen = new DeploymentDiagramGenerator()
    const content = gen.generateContent({ projectName: 'Test' })
    expect(content).toContain('ProductionDeployment')
  })

  it('uses custom env name in generated DOT diagram', () => {
    const gen = new DeploymentDiagramGenerator('Staging')
    const content = gen.generateContent({ projectName: 'Test' })
    expect(content).toContain('StagingDeployment')
  })
})

// ---------------------------------------------------------------------------
// NetworkDiagramGenerator (impl class direct) — lines 25-29, 130-138
// ---------------------------------------------------------------------------
describe('NetworkDiagramGenerator impl (coverage gaps)', () => {
  it('getType returns network', () => {
    // Covers lines 25-26 (getType method body)
    const gen = new NetworkDiagramGenerator()
    expect(gen.getType()).toBe('network')
  })

  it('getCategory returns conditional', () => {
    // Covers lines 28-29 (getCategory method body)
    const gen = new NetworkDiagramGenerator()
    expect(gen.getCategory()).toBe('conditional')
  })

  it('countEdges returns 17', () => {
    // Covers countEdges method body (~line 133-135)
    const gen = new NetworkDiagramGenerator()
    const count = (gen as unknown as { countEdges: () => number }).countEdges()
    expect(count).toBe(17)
  })

  it('countNestingDepth returns 5', () => {
    // Covers countNestingDepth method body (~line 137-138)
    const gen = new NetworkDiagramGenerator()
    const count = (gen as unknown as { countNestingDepth: () => number }).countNestingDepth()
    expect(count).toBe(5)
  })

  it('countNodes returns 13', () => {
    const gen = new NetworkDiagramGenerator()
    const count = (gen as unknown as { countNodes: () => number }).countNodes()
    expect(count).toBe(13)
  })

  it('uses default Enterprise network name in generated DOT diagram', () => {
    const gen = new NetworkDiagramGenerator()
    const content = gen.generateContent({ projectName: 'Test' })
    expect(content).toContain('EnterpriseNetwork')
  })

  it('uses custom network name in generated DOT diagram', () => {
    const gen = new NetworkDiagramGenerator('Corporate')
    const content = gen.generateContent({ projectName: 'Test' })
    expect(content).toContain('CorporateNetwork')
  })
})

// ---------------------------------------------------------------------------
// GateRoadmapGenerator — line 47
// ---------------------------------------------------------------------------
describe('GateRoadmapGenerator with gates (coverage gaps)', () => {
  it('generates a node per gate with name and status when gates are provided', () => {
    // Covers line 47: const label = `${gate.name}<br/><small>${gate.status}</small>`
    const gen = new GateRoadmapGenerator()
    const content = gen.generateContent({
      projectName: 'Test',
      gates: [
        { id: 'g01', number: 1, name: 'Core Setup', status: 'completed' },
        { id: 'g02', number: 2, name: 'API Layer', status: 'in_progress' },
        { id: 'g03', number: 3, name: 'Frontend', status: 'pending' },
      ],
    })

    expect(content).toContain('G1["Core Setup')
    expect(content).toContain('G2["API Layer')
    expect(content).toContain('G3["Frontend')
    expect(content).toContain('completed')
    expect(content).toContain('in_progress')
    expect(content).toContain('G1 --> G2')
    expect(content).toContain('G2 --> G3')
  })

  it('includes all gates in sequential connections', () => {
    const gen = new GateRoadmapGenerator()
    const content = gen.generateContent({
      projectName: 'Test',
      gates: [
        { id: 'g01', number: 1, name: 'Gate One', status: 'completed' },
        { id: 'g02', number: 2, name: 'Gate Two', status: 'pending' },
      ],
    })

    expect(content).toContain('G1 --> G2')
    expect(content).not.toContain('G2 --> G3') // Only 2 gates
  })

  it('skips undefined gate entries gracefully (covers the `if (!gate) continue` branch)', () => {
    // Line 47: `if (!gate) continue` — the `continue` is only executed when gate is falsy.
    // Force this with a sparse array entry cast past TypeScript's type checking.
    const gen = new GateRoadmapGenerator()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gatesWithHole = [
      { id: 'g01', number: 1, name: 'First Gate', status: 'completed' as const },
      undefined as never, // falsy entry → triggers `continue`
      { id: 'g03', number: 3, name: 'Third Gate', status: 'pending' as const },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = gen.generateContent({
      projectName: 'Test',
      gates: gatesWithHole as never,
    })

    // Valid gates are rendered; the undefined entry is silently skipped
    expect(content).toContain('First Gate')
    expect(content).toContain('Third Gate')
  })

  it('always includes classDef styling regardless of gate source', () => {
    const gen = new GateRoadmapGenerator()
    const content = gen.generateContent({
      projectName: 'Test',
      gates: [{ id: 'g01', number: 1, name: 'Solo Gate', status: 'in_progress' }],
    })

    expect(content).toContain('classDef pending')
    expect(content).toContain('classDef in_progress')
    expect(content).toContain('classDef completed')
  })

  it('countNodes uses max of 4 and gates.length', () => {
    const gen = new GateRoadmapGenerator()
    const type = gen as unknown as { countNodes: (c: object) => number }

    // Very few gates → still returns 4 minimum
    expect(type.countNodes({ projectName: 'T', gates: [{ id: 'g1', number: 1, name: 'G', status: 'pending' }] })).toBe(4)

    // More than 4 gates → returns actual count
    expect(
      type.countNodes({
        projectName: 'T',
        gates: [
          { id: 'g1', number: 1, name: 'A', status: 'pending' },
          { id: 'g2', number: 2, name: 'B', status: 'pending' },
          { id: 'g3', number: 3, name: 'C', status: 'pending' },
          { id: 'g4', number: 4, name: 'D', status: 'pending' },
          { id: 'g5', number: 5, name: 'E', status: 'pending' },
        ],
      })
    ).toBe(5)
  })

  it('countEdges uses n-1 edges with a floor of 3', () => {
    const gen = new GateRoadmapGenerator()
    const type = gen as unknown as { countEdges: (c: object) => number }

    // Single gate → still returns 3 minimum
    expect(type.countEdges({ projectName: 'T', gates: [{ id: 'g1', number: 1, name: 'A', status: 'pending' }] })).toBe(3)

    // 6 gates → 5 edges
    const manyGates = Array.from({ length: 6 }, (_, i) => ({
      id: `g${String(i + 1)}`,
      number: i + 1,
      name: `G${String(i + 1)}`,
      status: 'pending' as const,
    }))
    expect(type.countEdges({ projectName: 'T', gates: manyGates })).toBe(5)
  })
})
