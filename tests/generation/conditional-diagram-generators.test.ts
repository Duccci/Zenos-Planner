import { describe, it, expect } from 'vitest'
import {
  SequenceDiagramGenerator,
  ComponentDiagramGenerator,
  PackageDiagramGenerator,
  DeploymentDiagramGenerator,
  NetworkDiagramGenerator,
  CONDITIONAL_GENERATORS,
  ALL_GENERATORS,
} from '../../src/generation/diagram-generators/conditional-generators.js'

// ---------------------------------------------------------------------------
// Conditional Diagram Generators
// ---------------------------------------------------------------------------
describe('SequenceDiagramGenerator', () => {
  it('returns correct type and category', () => {
    const generator = new SequenceDiagramGenerator()
    expect(generator.type).toBe('sequence')
    expect(generator.category).toBe('conditional')
  })

  it('includes gate hash in filename for per-gate scoping', () => {
    const generator = new SequenceDiagramGenerator()
    const filename = generator.getFilename('g05architecture')
    expect(filename).toContain('g05architecture')
    expect(filename).toContain('sequence')
  })

  it('generates valid Mermaid sequence diagram syntax', () => {
    const generator = new SequenceDiagramGenerator()
    const content = generator.generateContent({})
    expect(content).toContain('sequenceDiagram')
  })
})

describe('ComponentDiagramGenerator', () => {
  it('returns correct type and category', () => {
    const generator = new ComponentDiagramGenerator()
    expect(generator.type).toBe('component')
    expect(generator.category).toBe('conditional')
  })

  it('includes gate hash in filename for per-gate scoping', () => {
    const generator = new ComponentDiagramGenerator()
    const filename = generator.getFilename('g05architecture')
    expect(filename).toContain('g05architecture')
    expect(filename).toContain('component')
  })

  it('generates valid Mermaid component diagram syntax', () => {
    const generator = new ComponentDiagramGenerator()
    const content = generator.generateContent({})
    expect(content).toContain('graph')
  })
})

describe('PackageDiagramGenerator', () => {
  it('returns correct type and category', () => {
    const generator = new PackageDiagramGenerator()
    expect(generator.type).toBe('package')
    expect(generator.category).toBe('conditional')
  })

  it('includes gate hash in filename for per-gate scoping', () => {
    const generator = new PackageDiagramGenerator()
    const filename = generator.getFilename('g05architecture')
    expect(filename).toContain('g05architecture')
    expect(filename).toContain('package')
  })

  it('generates valid Mermaid package diagram syntax', () => {
    const generator = new PackageDiagramGenerator()
    const content = generator.generateContent({})
    expect(content).toMatch(/graph|package/)
  })
})

describe('DeploymentDiagramGenerator', () => {
  it('returns correct type and category', () => {
    const generator = new DeploymentDiagramGenerator()
    expect(generator.type).toBe('deployment')
    expect(generator.category).toBe('conditional')
  })

  it('includes gate hash in filename for per-gate scoping', () => {
    const generator = new DeploymentDiagramGenerator()
    const filename = generator.getFilename('g05architecture')
    expect(filename).toContain('g05architecture')
    expect(filename).toContain('deployment')
  })

  it('defaults to DOT rendering backend', () => {
    const generator = new DeploymentDiagramGenerator()
    expect(generator.preferredRenderer).toBe('graphviz')
  })

  it('generates valid diagram syntax', () => {
    const generator = new DeploymentDiagramGenerator()
    const content = generator.generateContent({})
    expect(content).toBeTruthy()
  })
})

describe('NetworkDiagramGenerator', () => {
  it('returns correct type and category', () => {
    const generator = new NetworkDiagramGenerator()
    expect(generator.type).toBe('network')
    expect(generator.category).toBe('conditional')
  })

  it('includes gate hash in filename for per-gate scoping', () => {
    const generator = new NetworkDiagramGenerator()
    const filename = generator.getFilename('g05architecture')
    expect(filename).toContain('g05architecture')
    expect(filename).toContain('network')
  })

  it('defaults to DOT rendering backend', () => {
    const generator = new NetworkDiagramGenerator()
    expect(generator.preferredRenderer).toBe('graphviz')
  })

  it('generates valid diagram syntax', () => {
    const generator = new NetworkDiagramGenerator()
    const content = generator.generateContent({})
    expect(content).toBeTruthy()
  })
})

describe('Conditional Generators Collections', () => {
  it('CONDITIONAL_GENERATORS contains all five generators', () => {
    expect(CONDITIONAL_GENERATORS).toHaveLength(5)
    const types = CONDITIONAL_GENERATORS.map((g) => g.type)
    expect(types).toContain('sequence')
    expect(types).toContain('component')
    expect(types).toContain('package')
    expect(types).toContain('deployment')
    expect(types).toContain('network')
  })

  it('ALL_GENERATORS includes conditional generators', () => {
    expect(ALL_GENERATORS).toContain(...CONDITIONAL_GENERATORS)
  })

  it('ALL_GENERATORS has correct total count', () => {
    // 5 core + 5 conditional = 10 total
    expect(ALL_GENERATORS).toHaveLength(10)
  })
})
