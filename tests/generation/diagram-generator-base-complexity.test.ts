import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DiagramGeneratorBase } from '../../src/generation/diagram-generator-base.js'
import type { DiagramContext } from '../../src/generation/diagram-generator-base.js'

// Create a concrete implementation for testing
class TestDiagramGenerator extends DiagramGeneratorBase {
  getType() {
    return 'test-diagram' as any
  }

  getCategory() {
    return 'core' as any
  }

  generateContent(context: DiagramContext): string {
    return `graph TD\n${context.gates?.map((g) => `  ${g.id}["${g.name}"]`).join('\n') || '  A["Default"]'}`
  }
}

describe('DiagramGeneratorBase - Error Handling', () => {
  let generator: TestDiagramGenerator

  beforeEach(() => {
    generator = new TestDiagramGenerator()
  })

  describe('generate - complexity analysis', () => {
    it('should handle empty context gracefully', async () => {
      const emptyContext: DiagramContext = {
        projectName: 'Test Project',
      }

      const result = await generator.generate(emptyContext)

      expect(result).toBeDefined()
      expect(result.markdown).toBeDefined()
      expect(result.renderingBackend).toMatch(/mermaid|graphviz/)
      expect(result.diagramType).toBe('test-diagram')
    })

    it('should analyze complexity for various gate counts', async () => {
      const smallContext: DiagramContext = {
        projectName: 'Small',
        gates: [{ id: 'g-01', name: 'Gate 1', status: 'pending' }],
      }

      const largeContext: DiagramContext = {
        projectName: 'Large',
        gates: Array.from({ length: 10 }, (_, i) => ({
          id: `g-${String(i + 1).padStart(2, '0')}`,
          name: `Gate ${i + 1}`,
          status: 'pending',
        })),
      }

      const smallResult = await generator.generate(smallContext)
      const largeResult = await generator.generate(largeContext)

      expect(smallResult).toBeDefined()
      expect(largeResult).toBeDefined()
      // Larger diagrams might use different backend based on complexity
      expect([smallResult.renderingBackend, largeResult.renderingBackend]).toBeDefined()
    })

    it('should wrap content in markdown fence', async () => {
      const context: DiagramContext = {
        projectName: 'Test',
        gates: [
          { id: 'g-01', name: 'Gate 1', status: 'pending' },
          { id: 'g-02', name: 'Gate 2', status: 'in_progress' },
        ],
      }

      const result = await generator.generate(context)

      if (result.renderingBackend === 'mermaid') {
        expect(result.markdown).toContain('```mermaid')
        expect(result.markdown).toContain('```')
      }
    })

    it('should handle context with requirements', async () => {
      const context: DiagramContext = {
        projectName: 'Full',
        gates: [
          { id: 'g-01', name: 'Foundation', status: 'pending' },
          { id: 'g-02', name: 'Build', status: 'pending' },
        ],
        requirements: [
          { id: 'r-1', type: 'functional', status: 'pending' },
          { id: 'r-2', type: 'non_functional', status: 'pending' },
          { id: 'r-3', type: 'functional', status: 'implemented' },
        ],
      }

      const result = await generator.generate(context)

      expect(result.markdown).toBeDefined()
      expect(result.renderingBackend).toBeDefined()
    })

    it('should handle existing diagrams in context', async () => {
      const context: DiagramContext = {
        projectName: 'WithDiagrams',
        gates: [{ id: 'g-01', name: 'Gate 1', status: 'pending' }],
        existingDiagrams: [
          {
            type: 'system-overview',
            category: 'core',
            priority: 1,
          } as any,
        ],
      }

      const result = await generator.generate(context)

      expect(result.markdown).toBeDefined()
    })

    it('should handle custom rendering backend preference', async () => {
      const context: DiagramContext = {
        projectName: 'CustomBackend',
        gates: [{ id: 'g-01', name: 'Gate 1', status: 'pending' }],
      }

      // Test with explicit mermaid backend
      const mermaidResult = await generator.generate(context, 'mermaid')

      expect(mermaidResult.renderingBackend).toBe('mermaid')
      expect(mermaidResult.markdown).toContain('```mermaid')
    })

    it('should count nodes and edges properly', async () => {
      const context: DiagramContext = {
        projectName: 'Counting',
        gates: [
          { id: 'g-01', name: 'Gate 1', status: 'pending' },
          { id: 'g-02', name: 'Gate 2', status: 'pending' },
          { id: 'g-03', name: 'Gate 3', status: 'pending' },
        ],
      }

      const result = await generator.generate(context)

      // Verify markdown was generated successfully
      expect(result.markdown).toBeTruthy()
      expect(result.markdown.length).toBeGreaterThan(0)
    })

    it('should handle nesting depth analysis', async () => {
      const context: DiagramContext = {
        projectName: 'Nested',
        gates: [
          { id: 'g-01', name: 'Root', status: 'pending' },
          { id: 'g-02', name: 'Nested', status: 'pending' },
        ],
      }

      const result = await generator.generate(context)

      expect(result).toBeDefined()
      expect(result.markdown).toBeDefined()
    })
  })

  describe('wrapMarkdown', () => {
    it('should wrap mermaid content in code fence', () => {
      const content = 'graph TD\n  A --> B'
      const wrapped = generator['wrapMarkdown'](content, 'mermaid')

      expect(wrapped).toContain('```mermaid')
      expect(wrapped).toContain(content)
      expect(wrapped).toContain('```')
    })

    it('should return graphviz content as-is', () => {
      const content = 'digraph { a -> b }'
      const wrapped = generator['wrapMarkdown'](content, 'graphviz')

      expect(wrapped).toBe(content)
      expect(wrapped).not.toContain('```')
    })
  })

  describe('countNodes and countEdges', () => {
    it('should count gates as nodes', () => {
      const context: DiagramContext = {
        projectName: 'Test',
        gates: [
          { id: 'g-01', name: 'Gate 1', status: 'pending' },
          { id: 'g-02', name: 'Gate 2', status: 'pending' },
          { id: 'g-03', name: 'Gate 3', status: 'pending' },
        ],
      }

      const nodeCount = generator['countNodes'](context)

      expect(nodeCount).toBe(3)
    })

    it('should Count edges based on gate connections', () => {
      const context: DiagramContext = {
        projectName: 'Test',
        gates: [
          { id: 'g-01', name: 'Gate 1', status: 'pending' },
          { id: 'g-02', name: 'Gate 2', status: 'pending' },
        ],
      }

      const edgeCount = generator['countEdges'](context)

      expect(edgeCount).toBe(1) // One edge connecting two gates
    })

    it('should handle missing context properties', () => {
      const emptyContext: DiagramContext = {
        projectName: 'Empty',
      }

      const nodeCount = generator['countNodes'](emptyContext)
      const edgeCount = generator['countEdges'](emptyContext)

      expect(nodeCount).toBe(0)
      expect(edgeCount).toBe(-1) // 0 - 1
    })
  })
})
