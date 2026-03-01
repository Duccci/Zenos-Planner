import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ComplexityAnalyzer } from '../../src/generation/complexity-analyzer.js'
import { MermaidRenderer } from '../../src/generation/mermaid-renderer.js'
import { GraphvizRenderer } from '../../src/generation/graphviz-renderer.js'
import {
  discoverDiagramTemplates,
  getTemplateRegistry,
  getAvailableDiagramTypes,
} from '../../src/generation/diagram-types.js'
import { SystemOverviewGenerator } from '../../src/generation/diagram-generators/system-overview-generator.js'
import { DataFlowGenerator } from '../../src/generation/diagram-generators/data-flow-generator.js'
import { GateLifecycleGenerator } from '../../src/generation/diagram-generators/gate-lifecycle-generator.js'
import { GateRoadmapGenerator } from '../../src/generation/diagram-generators/gate-roadmap-generator.js'
import { ContextDiagramGenerator } from '../../src/generation/diagram-generators/context-diagram-generator.js'
import { CORE_GENERATORS } from '../../src/generation/diagram-generators/index.js'

// ---------------------------------------------------------------------------
// ComplexityAnalyzer
// ---------------------------------------------------------------------------
describe('ComplexityAnalyzer', () => {
  it('scores with default thresholds', () => {
    const analyzer = new ComplexityAnalyzer()
    const score = analyzer.score(3, 4, 2)
    expect(score.nodeCount).toBe(3)
    expect(score.edgeCount).toBe(4)
    expect(score.nestingDepth).toBe(2)
    expect(score.totalScore).toBe(3 + 4 + 2 * 2) // = 11
  })

  it('selects mermaid when within thresholds', () => {
    const analyzer = new ComplexityAnalyzer()
    const score = analyzer.score(3, 5, 1)
    expect(analyzer.selectBackend(score)).toBe('mermaid')
  })

  it('selects graphviz when exceeding thresholds', () => {
    const analyzer = new ComplexityAnalyzer()
    const score = analyzer.score(10, 15, 1)
    expect(analyzer.selectBackend(score)).toBe('graphviz')
  })

  it('accepts custom thresholds in constructor', () => {
    const analyzer = new ComplexityAnalyzer({
      maxMermaidNodes: 20,
      maxMermaidEdges: 30,
      nestingDepthMultiplier: 1,
    })
    const score = analyzer.score(15, 25, 2)
    expect(analyzer.selectBackend(score)).toBe('mermaid')
  })

  it('selectBackend accepts overriding thresholds argument', () => {
    const analyzer = new ComplexityAnalyzer()
    const score = analyzer.score(3, 5, 1)
    const backend = analyzer.selectBackend(score, {
      maxMermaidNodes: 1,
      maxMermaidEdges: 1,
      nestingDepthMultiplier: 1,
    })
    expect(backend).toBe('graphviz')
  })
})

// ---------------------------------------------------------------------------
// MermaidRenderer
// ---------------------------------------------------------------------------
describe('MermaidRenderer', () => {
  let renderer: MermaidRenderer

  beforeEach(() => {
    renderer = new MermaidRenderer()
  })

  it('wraps content in mermaid code fence', () => {
    const result = renderer.render('graph LR\n    A --> B')
    expect(result).toBe('```mermaid\ngraph LR\n    A --> B\n```')
  })

  it('validates valid mermaid syntax', () => {
    const result = renderer.validateSyntax('graph LR\n    A --> B')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('reports error for empty content', () => {
    const result = renderer.validateSyntax('   ')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('empty')
  })

  it('reports error when no diagram keyword present', () => {
    const result = renderer.validateSyntax('A --> B')
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('diagram type keyword'))).toBe(true)
  })

  it('reports error for unbalanced parentheses', () => {
    const result = renderer.validateSyntax('graph LR\n    A("open"')
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('parentheses'))).toBe(true)
  })

  it('reports error for unbalanced square brackets', () => {
    const result = renderer.validateSyntax('graph LR\n    A[open')
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('square brackets'))).toBe(true)
  })

  it('reports error for unbalanced curly braces', () => {
    const result = renderer.validateSyntax('graph LR\n    A{open')
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('curly braces'))).toBe(true)
  })

  it('accepts sequenceDiagram keyword', () => {
    const result = renderer.validateSyntax('sequenceDiagram\n    A->>B: hello')
    expect(result.valid).toBe(true)
  })

  it('accepts flowchart keyword', () => {
    const result = renderer.validateSyntax('flowchart LR\n    A --> B')
    expect(result.valid).toBe(true)
  })

  it('accepts stateDiagram keyword on new line', () => {
    const result = renderer.validateSyntax('some header\nstateDiagram\n    A --> B')
    expect(result.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// GraphvizRenderer
// ---------------------------------------------------------------------------
describe('GraphvizRenderer', () => {
  it('buildMarkdownImgRef returns an <img> tag with the given relative path', () => {
    const renderer = new GraphvizRenderer()
    const result = renderer.buildMarkdownImgRef('dot-diagrams/system-overview.svg', 'system-overview')
    expect(result).toContain('<img')
    expect(result).toContain('src="dot-diagrams/system-overview.svg"')
    expect(result).toContain('alt="system-overview"')
    expect(result).not.toContain('<svg')
  })

  it('buildMarkdownImgRef uses default alt text when none provided', () => {
    const renderer = new GraphvizRenderer()
    const result = renderer.buildMarkdownImgRef('dot-diagrams/foo.svg')
    expect(result).toContain('alt="Architecture Diagram"')
  })

  it('isAvailable returns a boolean', async () => {
    const renderer = new GraphvizRenderer()
    const available = await renderer.isAvailable()
    expect(typeof available).toBe('boolean')
  })

  it('renderToSvg rejects when dot is unavailable', async () => {
    // On CI or Windows without graphviz, this should reject gracefully
    const renderer = new GraphvizRenderer()
    const available = await renderer.isAvailable()
    if (!available) {
      await expect(renderer.renderToSvg('digraph G { A -> B }')).rejects.toThrow()
    } else {
      const svg = await renderer.renderToSvg('digraph G { A -> B }')
      expect(svg).toContain('<svg')
    }
  })
})

// ---------------------------------------------------------------------------
// diagram-types utility functions
// ---------------------------------------------------------------------------
describe('diagram-types utilities', () => {
  it('discoverDiagramTemplates returns an array', () => {
    const templates = discoverDiagramTemplates(process.cwd())
    expect(Array.isArray(templates)).toBe(true)
  })

  it('getTemplateRegistry returns an object', () => {
    const registry = getTemplateRegistry(process.cwd())
    expect(typeof registry).toBe('object')
  })

  it('getAvailableDiagramTypes returns an array', () => {
    const types = getAvailableDiagramTypes(process.cwd())
    expect(Array.isArray(types)).toBe(true)
  })

  it('discoverDiagramTemplates handles missing directory gracefully', () => {
    const templates = discoverDiagramTemplates('/nonexistent/path')
    expect(Array.isArray(templates)).toBe(true)
    expect(templates.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Diagram Generators index
// ---------------------------------------------------------------------------
describe('CORE_GENERATORS', () => {
  it('contains expected generator types', () => {
    expect(CORE_GENERATORS).toContain('system-overview')
    expect(CORE_GENERATORS).toContain('data-flow')
    expect(CORE_GENERATORS).toContain('gate-lifecycle')
    expect(CORE_GENERATORS).toContain('gate-roadmap')
    expect(CORE_GENERATORS).toContain('context')
  })
})

// ---------------------------------------------------------------------------
// SystemOverviewGenerator
// ---------------------------------------------------------------------------
describe('SystemOverviewGenerator', () => {
  it('returns correct type and category', () => {
    const gen = new SystemOverviewGenerator()
    expect(gen.getType()).toBe('system-overview')
    expect(gen.getCategory()).toBe('core')
  })

  it('generateContent returns a mermaid graph', () => {
    const gen = new SystemOverviewGenerator()
    const content = gen.generateContent({ projectName: 'Test' })
    expect(content).toContain('graph TB')
    expect(content).toContain('subgraph')
  })

  it('generate returns DiagramOutput with correct type', async () => {
    const gen = new SystemOverviewGenerator()
    const output = await gen.generate({ projectName: 'Test' }, 'mermaid')
    expect(output.diagramType).toBe('system-overview')
    expect(output.renderingBackend).toBe('mermaid')
    expect(output.markdown).toContain('```mermaid')
  })

  it('generate selects backend automatically', async () => {
    const gen = new SystemOverviewGenerator()
    const output = await gen.generate({ projectName: 'Test' })
    expect(['mermaid', 'graphviz']).toContain(output.renderingBackend)
  })
})

// ---------------------------------------------------------------------------
// DataFlowGenerator
// ---------------------------------------------------------------------------
describe('DataFlowGenerator', () => {
  it('returns correct type and category', () => {
    const gen = new DataFlowGenerator()
    expect(gen.getType()).toBe('data-flow')
    expect(gen.getCategory()).toBe('core')
  })

  it('generateContent returns a mermaid graph', () => {
    const gen = new DataFlowGenerator()
    const content = gen.generateContent({ projectName: 'Test' })
    expect(content).toContain('flowchart TD')
  })

  it('generate returns DiagramOutput', async () => {
    const gen = new DataFlowGenerator()
    const output = await gen.generate({ projectName: 'Test' }, 'mermaid')
    expect(output.diagramType).toBe('data-flow')
    expect(output.markdown).toContain('```mermaid')
  })
})

// ---------------------------------------------------------------------------
// GateLifecycleGenerator
// ---------------------------------------------------------------------------
describe('GateLifecycleGenerator', () => {
  it('returns correct type and category', () => {
    const gen = new GateLifecycleGenerator()
    expect(gen.getType()).toBe('gate-lifecycle')
    expect(gen.getCategory()).toBe('core')
  })

  it('generateContent returns a stateDiagram', () => {
    const gen = new GateLifecycleGenerator()
    const content = gen.generateContent({ projectName: 'Test' })
    expect(content).toContain('stateDiagram-v2')
    expect(content).toContain('pending')
    expect(content).toContain('completed')
  })

  it('generate returns DiagramOutput', async () => {
    const gen = new GateLifecycleGenerator()
    const output = await gen.generate({ projectName: 'Test' }, 'mermaid')
    expect(output.diagramType).toBe('gate-lifecycle')
    expect(output.markdown).toContain('stateDiagram')
  })
})

// ---------------------------------------------------------------------------
// GateRoadmapGenerator
// ---------------------------------------------------------------------------
describe('GateRoadmapGenerator', () => {
  it('returns correct type and category', () => {
    const gen = new GateRoadmapGenerator()
    expect(gen.getType()).toBe('gate-roadmap')
    expect(gen.getCategory()).toBe('core')
  })

  it('generateContent with no gates returns default roadmap', () => {
    const gen = new GateRoadmapGenerator()
    const content = gen.generateContent({ projectName: 'Test', gates: [] })
    expect(content).toContain('graph LR')
    expect(content).toContain('G1')
    expect(content).toContain('G4')
  })

  it('generateContent with gates uses them', () => {
    const gen = new GateRoadmapGenerator()
    const content = gen.generateContent({
      projectName: 'Test',
      gates: [
        { id: 'gate-01', name: 'Setup', status: 'completed' },
        { id: 'gate-02', name: 'Build', status: 'in_progress' },
      ],
    })
    expect(content).toContain('Setup')
    expect(content).toContain('Build')
    expect(content).toContain('G1 --> G2')
  })

  it('generate returns DiagramOutput', async () => {
    const gen = new GateRoadmapGenerator()
    const output = await gen.generate({ projectName: 'Test' }, 'mermaid')
    expect(output.diagramType).toBe('gate-roadmap')
  })
})

// ---------------------------------------------------------------------------
// ContextDiagramGenerator
// ---------------------------------------------------------------------------
describe('ContextDiagramGenerator', () => {
  it('returns correct type and category', () => {
    const gen = new ContextDiagramGenerator()
    expect(gen.getType()).toBe('context')
    expect(gen.getCategory()).toBe('core')
  })

  it('generateContent returns a context diagram', () => {
    const gen = new ContextDiagramGenerator()
    const content = gen.generateContent({ projectName: 'Test' })
    expect(content).toContain('graph TB')
    expect(content).toContain('System')
  })

  it('generate returns DiagramOutput', async () => {
    const gen = new ContextDiagramGenerator()
    const output = await gen.generate({ projectName: 'Test' }, 'mermaid')
    expect(output.diagramType).toBe('context')
    expect(output.markdown).toContain('```mermaid')
  })

  it('generate falls back to mermaid when graphviz unavailable', async () => {
    const gen = new ContextDiagramGenerator()
    // Mock GraphvizRenderer to simulate unavailability
    const { GraphvizRenderer } = await import('../../src/generation/graphviz-renderer.js')
    vi.spyOn(GraphvizRenderer.prototype, 'isAvailable').mockResolvedValueOnce(false)
    const output = await gen.generate({ projectName: 'Test' }, 'graphviz')
    expect(output.renderingBackend).toBe('mermaid')
  })
})

// ---------------------------------------------------------------------------
// Architecture Diagram Generation: Test-First Validation
// ---------------------------------------------------------------------------
describe('Architecture Diagram Generation (Test-First)', () => {
  describe('SystemOverviewGenerator - Content Structure Validation', () => {
    it('generates diagram with required graph declaration', () => {
      const gen = new SystemOverviewGenerator()
      const content = gen.generateContent({ projectName: 'MyProject' })
      expect(content).toMatch(/^graph\s+(TB|LR|RL|BT)/)
    })

    it('contains valid mermaid graph structure', () => {
      const gen = new SystemOverviewGenerator()
      const content = gen.generateContent({ projectName: 'Test' })
      expect(content).toContain('subgraph')
      expect(content).toMatch(/-->/)
    })

    it('contains defined subgraphs for system layers', () => {
      const gen = new SystemOverviewGenerator()
      const content = gen.generateContent({ projectName: 'Test' })
      expect(content).toContain('subgraph')
    })
  })

  describe('DataFlowGenerator - Content Structure Validation', () => {
    it('generateContent returns a mermaid graph', () => {
      const gen = new DataFlowGenerator()
      const content = gen.generateContent({ projectName: 'Test' })
      expect(content).toMatch(/^flowchart\s+TD/)
      expect(content).toContain('-->')
    })

    it('includes entry and exit points for data flow', () => {
      const gen = new DataFlowGenerator()
      const content = gen.generateContent({ projectName: 'Test' })
      expect(content).toMatch(/Input|Entry|Start|Source/) // Some entry point indicator
    })
  })

  describe('GateLifecycleGenerator - State Machine Validation', () => {
    it('implements proper state diagram syntax', () => {
      const gen = new GateLifecycleGenerator()
      const content = gen.generateContent({ projectName: 'Test' })
      expect(content).toContain('stateDiagram-v2')
    })

    it('includes all required gate states', () => {
      const gen = new GateLifecycleGenerator()
      const content = gen.generateContent({ projectName: 'Test' })
      expect(content).toContain('pending')
      expect(content).toContain('in_progress')
      expect(content).toContain('completed')
    })

    it('defines state transitions', () => {
      const gen = new GateLifecycleGenerator()
      const content = gen.generateContent({ projectName: 'Test' })
      expect(content).toMatch(/--\>/) // State transitions
    })
  })

  describe('DiagramOutput Validation', () => {
    it('DiagramOutput contains all required properties', async () => {
      const gen = new SystemOverviewGenerator()
      const output = await gen.generate({ projectName: 'Test' }, 'mermaid')

      expect(output).toHaveProperty('diagramType')
      expect(output).toHaveProperty('renderingBackend')
      expect(output).toHaveProperty('markdown')
      expect(output).toHaveProperty('category')
    })

    it('markdown is properly formatted with code fence', async () => {
      const gen = new SystemOverviewGenerator()
      const output = await gen.generate({ projectName: 'Test' }, 'mermaid')

      expect(output.markdown).toMatch(/^```\w+\n/)
      expect(output.markdown).toMatch(/\n```$/)
    })

    it('markdown type matches rendering backend', async () => {
      const gen = new SystemOverviewGenerator()
      const mermaidOutput = await gen.generate({ projectName: 'Test' }, 'mermaid')

      expect(mermaidOutput.markdown).toContain('```mermaid')
      expect(mermaidOutput.renderingBackend).toBe('mermaid')
    })
  })

  describe('Diagram Generation Error Handling', () => {
    it('handles missing projectName gracefully', async () => {
      const gen = new SystemOverviewGenerator()
      const output = await gen.generate({} as never, 'mermaid')

      expect(output).toBeDefined()
      expect(output.markdown).toBeDefined()
    })
  })

  describe('MermaidRenderer Validation Pipeline', () => {
    it('validates generated diagram before rendering', () => {
      const renderer = new MermaidRenderer()
      const content = 'graph LR\n    A --> B'
      const validation = renderer.validateSyntax(content)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('detects invalid mermaid syntax', () => {
      const renderer = new MermaidRenderer()
      const content = 'graph LR\n    A --> [unclosed'
      const validation = renderer.validateSyntax(content)

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })

    it('render wraps valid content in markdown fence', () => {
      const renderer = new MermaidRenderer()
      const content = 'graph LR\n    A --> B'
      const rendered = renderer.render(content)

      expect(rendered).toMatch(/^```mermaid\n/)
      expect(rendered).toMatch(/\n```$/)
    })
  })

  describe('Diagram Generator Factory Pattern', () => {
    it('all core generators implement required interface', async () => {
      const generators = [
        new SystemOverviewGenerator(),
        new DataFlowGenerator(),
        new GateLifecycleGenerator(),
        new GateRoadmapGenerator(),
        new ContextDiagramGenerator(),
      ]

      for (const gen of generators) {
        expect(gen.getType()).toBeDefined()
        expect(gen.getCategory()).toBeDefined()
        expect(typeof gen.generateContent).toBe('function')
        expect(typeof gen.generate).toBe('function')
      }
    })

    it('each generator has unique type identifier', () => {
      const generators = [
        new SystemOverviewGenerator(),
        new DataFlowGenerator(),
        new GateLifecycleGenerator(),
        new GateRoadmapGenerator(),
        new ContextDiagramGenerator(),
      ]

      const types = generators.map((g) => g.getType())
      const uniqueTypes = new Set(types)
      expect(uniqueTypes.size).toBe(types.length)
    })
  })

  // Additional tests for conditional diagram generators (lower coverage)
  describe('Sequence Diagram Generator', () => {
    it('returns sequence diagram type', async () => {
      const { SequenceDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/sequence-diagram-generator.js'
      )
      const gen = new SequenceDiagramGenerator()
      expect(gen.getType()).toBe('sequence')
      expect(gen.getCategory()).toBe('conditional')
    })

    it('generates valid sequence diagram content', async () => {
      const { SequenceDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/sequence-diagram-generator.js'
      )
      const gen = new SequenceDiagramGenerator()
      const content = gen.generateContent({})
      expect(content).toContain('sequenceDiagram')
      expect(content).toContain('participant')
      expect(content).toContain('->>') // Message syntax
    })

    it('counts nodes and edges correctly', async () => {
      const { SequenceDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/sequence-diagram-generator.js'
      )
      const gen = new SequenceDiagramGenerator()
      expect(gen['countNodes']()).toBe(4) // User, API, Service, DB
      expect(gen['countEdges']()).toBe(8) // 8 interactions
      expect(gen['countNestingDepth']()).toBe(3) // Activation levels
    })

    it('accepts optional descriptor parameter', async () => {
      const { SequenceDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/sequence-diagram-generator.js'
      )
      const gen = new SequenceDiagramGenerator('my-descriptor')
      const content = gen.generateContent({})
      expect(content).toBeDefined()
    })

    it('handles complexity analyzer parameter', async () => {
      const { SequenceDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/sequence-diagram-generator.js'
      )
      const analyzer = new ComplexityAnalyzer()
      const gen = new SequenceDiagramGenerator('desc', analyzer)
      expect(gen).toBeDefined()
    })
  })

  describe('Package Diagram Generator', () => {
    it('returns package diagram type', async () => {
      const { PackageDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/package-diagram-generator.js'
      )
      const gen = new PackageDiagramGenerator()
      expect(gen.getType()).toBe('package')
      expect(gen.getCategory()).toBe('conditional')
    })

    it('generates valid package diagram with subgraphs', async () => {
      const { PackageDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/package-diagram-generator.js'
      )
      const gen = new PackageDiagramGenerator()
      const content = gen.generateContent({})
      expect(content).toContain('subgraph')
      expect(content).toContain('graph TB')
      expect(content).toContain('-->|uses|')
    })

    it('counts package and module nodes', async () => {
      const { PackageDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/package-diagram-generator.js'
      )
      const gen = new PackageDiagramGenerator()
      expect(gen['countNodes']()).toBe(14) // 4 packages + 10 modules
      expect(gen['countEdges']()).toBe(6) // Package dependencies
      expect(gen['countNestingDepth']()).toBe(2) // Packages containing modules
    })

    it('accepts optional scope prefix parameter', async () => {
      const { PackageDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/package-diagram-generator.js'
      )
      const gen = new PackageDiagramGenerator('@scope')
      expect(gen).toBeDefined()
    })
  })

  describe('Component Diagram Generator', () => {
    it('returns component diagram type', async () => {
      const { ComponentDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/component-diagram-generator.js'
      )
      const gen = new ComponentDiagramGenerator()
      expect(gen.getType()).toBe('component')
      expect(gen.getCategory()).toBe('conditional')
    })

    it('generates component diagram with default system name', async () => {
      const { ComponentDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/component-diagram-generator.js'
      )
      const gen = new ComponentDiagramGenerator()
      const content = gen.generateContent({})
      expect(content).toContain('System Component')
      expect(content).toContain('subgraph')
    })

    it('generates component diagram with custom component name', async () => {
      const { ComponentDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/component-diagram-generator.js'
      )
      const gen = new ComponentDiagramGenerator('MyService')
      const content = gen.generateContent({})
      expect(content).toContain('MyService Component')
    })

    it('includes interface, modules, and external system', async () => {
      const { ComponentDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/component-diagram-generator.js'
      )
      const gen = new ComponentDiagramGenerator()
      const content = gen.generateContent({})
      expect(content).toContain('[interface]')
      expect(content).toContain('Parser')
      expect(content).toContain('Validator')
      expect(content).toContain('Processor')
      expect(content).toContain('External')
    })

    it('counts nodes and nesting depth', async () => {
      const { ComponentDiagramGenerator } = await import(
        '../../src/generation/diagram-generators/component-diagram-generator.js'
      )
      const gen = new ComponentDiagramGenerator()
      // Component diagram should count internal components
      expect(gen['countNodes']()).toBeGreaterThan(0)
    })
  })
})
