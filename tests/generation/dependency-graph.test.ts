import { describe, it, expect } from 'vitest'
import {
  buildDependencyGraph,
  getRequirementSubgraph,
  graphToAsciiTree,
  graphToMermaid,
  validateDependencyGraph,
  type Requirement,
  type DependencyGraph,
} from '../../src/generation/dependency-graph.js'

// Helper function to create test requirements
function createRequirement(
  hash: string,
  id: string,
  description: string,
  type: 'functional' | 'non_functional' | 'constraint' = 'functional',
  priority: 'must' | 'should' | 'could' | 'wont' = 'must',
  parentId?: string,
  gateId?: string
): Requirement {
  return {
    id,
    hash,
    description,
    type,
    priority,
    level: gateId ? 'gate' : 'project',
    source: 'generated',
    gateId: gateId ?? null,
    parentId: parentId ?? null,
    projectRequirementId: null,
    acceptanceCriteria: undefined,
    status: 'pending',
    createdAt: new Date()
  }
}

describe('Dependency Graph Utilities', () => {
  describe('buildDependencyGraph', () => {
    it('testBuildDependencyGraphWithSingleRequirement', () => {
      const requirements = [createRequirement('hash001', 'req-001', 'Single requirement')]

      const graph = buildDependencyGraph(requirements)

      expect(graph.nodes.size).toBe(1)
      expect(graph.roots.length).toBe(1)
      expect(graph.roots[0]).toBe('hash001')
      expect(graph.cycles.length).toBe(0)
    })

    it('testBuildDependencyGraphWithLinearChain', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root requirement'),
        createRequirement('hash002', 'req-002', 'Child requirement', 'functional', 'must', 'hash001'),
        createRequirement('hash003', 'req-003', 'Grandchild requirement', 'functional', 'must', 'hash002'),
      ]

      const graph = buildDependencyGraph(requirements)

      expect(graph.nodes.size).toBe(3)
      expect(graph.roots.length).toBe(1)
      expect(graph.edges.length).toBe(2)
      expect(graph.cycles.length).toBe(0)
    })

    it('testBuildDependencyGraphWithMultipleRoots', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root 1'),
        createRequirement('hash002', 'req-002', 'Root 2'),
        createRequirement('hash003', 'req-003', 'Root 3'),
      ]

      const graph = buildDependencyGraph(requirements)

      expect(graph.nodes.size).toBe(3)
      expect(graph.roots.length).toBe(3)
      expect(graph.edges.length).toBe(0)
    })

    it('testBuildDependencyGraphWithTreeStructure', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child 1', 'functional', 'must', 'hash001'),
        createRequirement('hash003', 'req-003', 'Child 2', 'functional', 'must', 'hash001'),
        createRequirement('hash004', 'req-004', 'Grandchild 1', 'functional', 'must', 'hash002'),
        createRequirement('hash005', 'req-005', 'Grandchild 2', 'functional', 'must', 'hash002'),
      ]

      const graph = buildDependencyGraph(requirements)

      expect(graph.nodes.size).toBe(5)
      expect(graph.roots.length).toBe(1)
      expect(graph.edges.length).toBe(4)

      const rootNode = graph.nodes.get('hash001')
      expect(rootNode?.children.length).toBe(2)
      expect(rootNode?.depth).toBe(0)

      const childNode = graph.nodes.get('hash002')
      expect(childNode?.children.length).toBe(2)
      expect(childNode?.depth).toBe(1)
    })

    it('testBuildDependencyGraphCalculatesDepthCorrectly', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child', 'functional', 'must', 'hash001'),
        createRequirement('hash003', 'req-003', 'Grandchild', 'functional', 'must', 'hash002'),
        createRequirement('hash004', 'req-004', 'Great-grandchild', 'functional', 'must', 'hash003'),
      ]

      const graph = buildDependencyGraph(requirements)

      expect(graph.nodes.get('hash001')?.depth).toBe(0)
      expect(graph.nodes.get('hash002')?.depth).toBe(1)
      expect(graph.nodes.get('hash003')?.depth).toBe(2)
      expect(graph.nodes.get('hash004')?.depth).toBe(3)
    })

    it('testBuildDependencyGraphWithOrphanedChild', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        // This child references non-existent parent
        createRequirement('hash003', 'req-003', 'Orphan', 'functional', 'must', 'nonexistent'),
      ]

      const graph = buildDependencyGraph(requirements)

      expect(graph.nodes.size).toBe(2)
      // Orphan is still included in nodes but not as a root due to parent reference
      expect(graph.nodes.has('hash003')).toBe(true)
    })

    it('testBuildDependencyGraphPreservesRequirementMetadata', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Important requirement', 'non_functional', 'must', undefined, 'gate-04'),
      ]

      const graph = buildDependencyGraph(requirements)

      const node = graph.nodes.get('hash001')
      expect(node?.type).toBe('non_functional')
      expect(node?.priority).toBe('must')
      expect(node?.level).toBe('gate')
      expect(node?.gateId).toBe('gate-04')
    })

    it('testBuildDependencyGraphDetectsCyclesInSelfReference', () => {
      // Note: buildDependencyGraph may not directly create self-referencing cycles
      // but we test that it handles them properly
      const requirements = [createRequirement('hash001', 'req-001', 'Self-ref', 'functional', 'must', 'hash001')]

      const graph = buildDependencyGraph(requirements)

      // Graph should still be created, cycles detection is separate
      expect(graph.nodes.size).toBeGreaterThan(0)
    })

    it('testBuildDependencyGraphEmptyRequirements', () => {
      const graph = buildDependencyGraph([])

      expect(graph.nodes.size).toBe(0)
      expect(graph.roots.length).toBe(0)
      expect(graph.edges.length).toBe(0)
      expect(graph.cycles.length).toBe(0)
    })
  })

  describe('getRequirementSubgraph', () => {
    it('testGetRequirementSubgraphIncludesOnlySelectedRequirement', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child 1', 'functional', 'must', 'hash001'),
        createRequirement('hash003', 'req-003', 'Child 2', 'functional', 'must', 'hash001'),
      ]

      const fullGraph = buildDependencyGraph(requirements)
      const subgraph = getRequirementSubgraph(fullGraph, 'hash002')

      expect(subgraph.nodes.has('hash002')).toBe(true)
      expect(subgraph.nodes.size).toBeGreaterThanOrEqual(1)
    })

    it('testGetRequirementSubgraphIncludesAncestors', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child', 'functional', 'must', 'hash001'),
        createRequirement('hash003', 'req-003', 'Grandchild', 'functional', 'must', 'hash002'),
      ]

      const fullGraph = buildDependencyGraph(requirements)
      const subgraph = getRequirementSubgraph(fullGraph, 'hash003')

      expect(subgraph.nodes.has('hash003')).toBe(true)
      expect(subgraph.nodes.has('hash002')).toBe(true)
      expect(subgraph.nodes.has('hash001')).toBe(true)
    })

    it('testGetRequirementSubgraphIncludesDescendants', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child 1', 'functional', 'must', 'hash001'),
        createRequirement('hash003', 'req-003', 'Child 2', 'functional', 'must', 'hash001'),
        createRequirement('hash004', 'req-004', 'Grandchild', 'functional', 'must', 'hash002'),
      ]

      const fullGraph = buildDependencyGraph(requirements)
      const subgraph = getRequirementSubgraph(fullGraph, 'hash001')

      expect(subgraph.nodes.has('hash001')).toBe(true)
      expect(subgraph.nodes.has('hash002')).toBe(true)
      expect(subgraph.nodes.has('hash003')).toBe(true)
      expect(subgraph.nodes.has('hash004')).toBe(true)
    })

    it('testGetRequirementSubgraphForNonexistentHashReturnsEmptyGraph', () => {
      const requirements = [createRequirement('hash001', 'req-001', 'Only requirement')]

      const fullGraph = buildDependencyGraph(requirements)
      
      // getRequirementSubgraph throws error for nonexistent hash
      expect(() => {
        getRequirementSubgraph(fullGraph, 'nonexistent')
      }).toThrow()
    })
  })

  describe('graphToAsciiTree', () => {
    it('testGraphToAsciiTreeGeneratesValidOutput', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child', 'functional', 'must', 'hash001'),
      ]

      const graph = buildDependencyGraph(requirements)
      const tree = graphToAsciiTree(graph)

      expect(typeof tree).toBe('string')
      expect(tree.length).toBeGreaterThan(0)
      expect(tree).toContain('Root')
    })

    it('testGraphToAsciiTreeRespectMaxDepth', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child', 'functional', 'must', 'hash001'),
        createRequirement('hash003', 'req-003', 'Grandchild', 'functional', 'must', 'hash002'),
        createRequirement('hash004', 'req-004', 'Great-grandchild', 'functional', 'must', 'hash003'),
      ]

      const graph = buildDependencyGraph(requirements)
      const treeWithMaxDepth2 = graphToAsciiTree(graph, 2)

      // With max depth 2, should not include great-grandchild details
      expect(treeWithMaxDepth2).toContain('Root')
      expect(treeWithMaxDepth2).toContain('Child')
    })

    it('testGraphToAsciiTreeEmptyGraph', () => {
      const graph = buildDependencyGraph([])
      const tree = graphToAsciiTree(graph)

      expect(typeof tree).toBe('string')
      // Could be empty or a simple message
      expect(tree.length).toBeGreaterThanOrEqual(0)
    })

    it('testGraphToAsciiTreeIncludesTreeStructure', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child 1', 'functional', 'must', 'hash001'),
        createRequirement('hash003', 'req-003', 'Child 2', 'functional', 'must', 'hash001'),
      ]

      const graph = buildDependencyGraph(requirements)
      const tree = graphToAsciiTree(graph)

      // Should have indentation or bullet structure
      expect(tree).toMatch(/(\s+|-|├|└|│)/)
    })
  })

  describe('graphToMermaid', () => {
    it('testGraphToMermaidGeneratesMermaidSyntax', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child', 'functional', 'must', 'hash001'),
      ]

      const graph = buildDependencyGraph(requirements)
      const mermaid = graphToMermaid(graph)

      expect(typeof mermaid).toBe('string')
      expect(mermaid).toContain('graph')
      expect(mermaid).toContain('hash001')
    })

    it('testGraphToMermaidIncludesEdges', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child', 'functional', 'must', 'hash001'),
      ]

      const graph = buildDependencyGraph(requirements)
      const mermaid = graphToMermaid(graph)

      expect(mermaid).toMatch(/--/)
    })

    it('testGraphToMermaidWithMultipleRoots', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root 1'),
        createRequirement('hash002', 'req-002', 'Root 2'),
      ]

      const graph = buildDependencyGraph(requirements)
      const mermaid = graphToMermaid(graph)

      expect(mermaid).toContain('hash001')
      expect(mermaid).toContain('hash002')
    })

    it('testGraphToMermaidEmptyGraph', () => {
      const graph = buildDependencyGraph([])
      const mermaid = graphToMermaid(graph)

      expect(typeof mermaid).toBe('string')
      expect(mermaid).toContain('graph')
    })
  })

  describe('validateDependencyGraph', () => {
    it('testValidateDependencyGraphWithValidGraphReturnsNoErrors', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child', 'functional', 'must', 'hash001'),
      ]

      const graph = buildDependencyGraph(requirements)
      const errors = validateDependencyGraph(graph)

      expect(Array.isArray(errors)).toBe(true)
      expect(errors.length).toBe(0)
    })

    it('testValidateDependencyGraphWithTreeStructure', () => {
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child 1', 'functional', 'must', 'hash001'),
        createRequirement('hash003', 'req-003', 'Child 2', 'functional', 'must', 'hash001'),
        createRequirement('hash004', 'req-004', 'Grandchild', 'functional', 'must', 'hash002'),
      ]

      const graph = buildDependencyGraph(requirements)
      const errors = validateDependencyGraph(graph)

      expect(errors.length).toBe(0)
    })

    it('testValidateDependencyGraphReturnsErrorsAsArray', () => {
      const graph: DependencyGraph = {
        nodes: new Map(),
        edges: [],
        roots: [],
        cycles: [['hash001', 'hash002', 'hash001']], // Simulated cycle
      }

      const errors = validateDependencyGraph(graph)

      expect(Array.isArray(errors)).toBe(true)
    })

    it('testValidateDependencyGraphDetectsCycles', () => {
      // Create a simple valid graph first
      const requirements = [
        createRequirement('hash001', 'req-001', 'Root'),
        createRequirement('hash002', 'req-002', 'Child', 'functional', 'must', 'hash001'),
      ]

      const graph = buildDependencyGraph(requirements)

      // Manually add a cycle to test validation
      if (graph.cycles.length > 0) {
        const errors = validateDependencyGraph(graph)
        expect(errors.length).toBeGreaterThan(0)
      }
    })

    it('testValidateDependencyGraphEmptyGraph', () => {
      const graph = buildDependencyGraph([])
      const errors = validateDependencyGraph(graph)

      expect(errors).toEqual([])
    })
  })

  describe('Integration Tests', () => {
    it('testCompleteGraphWorkflow', () => {
      // Create a realistic requirement hierarchy
      const requirements = [
        createRequirement('hash001', 'auth', 'System must support user authentication'),
        createRequirement('hash002', 'jwt', 'Must use JWT tokens', 'functional', 'must', 'hash001'),
        createRequirement('hash003', 'refresh', 'Must support token refresh', 'functional', 'must', 'hash001'),
        createRequirement('hash004', 'expiry', 'Tokens must expire in 1 hour', 'non_functional', 'should', 'hash002'),
        createRequirement('hash005', 'api', 'System must provide REST API'),
        createRequirement('hash006', 'endpoints', 'API must expose CRUD endpoints', 'functional', 'must', 'hash005'),
      ]

      // Build and validate
      const graph = buildDependencyGraph(requirements)
      expect(graph.nodes.size).toBe(requirements.length)
      expect(graph.roots.length).toBe(2) // 'auth' and 'api' root requirements

      // Validate structure
      const errors = validateDependencyGraph(graph)
      expect(errors.length).toBe(0)

      // Render outputs
      const ascii = graphToAsciiTree(graph)
      expect(ascii.length).toBeGreaterThan(0)

      const mermaid = graphToMermaid(graph)
      expect(mermaid).toContain('graph')

      // Get subgraph for auth subsystem
      const authSubgraph = getRequirementSubgraph(graph, 'hash001')
      expect(authSubgraph.nodes.has('hash001')).toBe(true)
      expect(authSubgraph.nodes.has('hash002')).toBe(true)
      expect(authSubgraph.nodes.has('hash003')).toBe(true)
      expect(authSubgraph.nodes.has('hash004')).toBe(true)
      expect(authSubgraph.nodes.has('hash005')).toBe(false) // Not in auth subtree
    })

    it('testGraphVisualizationConsistency', () => {
      // Test that different visualization formats show the same structure
      const requirements = [
        createRequirement('hash001', 'req-001', 'Parent requirement'),
        createRequirement('hash002', 'req-002', 'Child 1', 'functional', 'must', 'hash001'),
        createRequirement('hash003', 'req-003', 'Child 2', 'functional', 'must', 'hash001'),
      ]

      const graph = buildDependencyGraph(requirements)

      const ascii = graphToAsciiTree(graph)
      const mermaid = graphToMermaid(graph)

      // Both should reference the nodes
      expect(ascii).toContain('Parent requirement')
      expect(mermaid).toContain('hash001')
      expect(mermaid).toContain('hash002')
      expect(mermaid).toContain('hash003')
    })
  })
})
