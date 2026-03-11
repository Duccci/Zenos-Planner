import { describe, it, expect, beforeEach } from 'vitest'
import {
  getCatalogue,
  getCatalogueByCategory,
} from '../../src/generation/diagram-catalogue.js'
import { DiagramSelector, type ComplexityThresholds } from '../../src/generation/diagram-selector.js'

// ---------------------------------------------------------------------------
// Diagram Catalogue
// ---------------------------------------------------------------------------
describe('getCatalogue', () => {
  it('returns all 10 diagram entries', () => {
    const catalogue = getCatalogue()
    expect(catalogue).toHaveLength(10)
  })

  it('includes core diagram types', () => {
    const catalogue = getCatalogue()
    const types = catalogue.map((entry) => entry.type)
    expect(types).toContain('system-overview')
    expect(types).toContain('data-flow')
    expect(types).toContain('gate-lifecycle')
    expect(types).toContain('gate-roadmap')
    expect(types).toContain('context')
  })

  it('includes conditional diagram types', () => {
    const catalogue = getCatalogue()
    const types = catalogue.map((entry) => entry.type)
    expect(types).toContain('sequence')
    expect(types).toContain('component')
    expect(types).toContain('package')
    expect(types).toContain('deployment')
    expect(types).toContain('network')
  })

  it('each entry has complete metadata', () => {
    const catalogue = getCatalogue()
    catalogue.forEach((entry) => {
      expect(entry).toHaveProperty('type')
      expect(entry).toHaveProperty('name')
      expect(entry).toHaveProperty('description')
      expect(entry).toHaveProperty('category')
      expect(entry).toHaveProperty('whenUseful')
      expect(entry).toHaveProperty('templatePath')
      expect(entry).toHaveProperty('alwaysGenerated')
    })
  })
})

describe('getCatalogueByCategory', () => {
  it('returns 5 entries for core category', () => {
    const core = getCatalogueByCategory('core')
    expect(core).toHaveLength(5)
  })

  it('returns correct types for core category', () => {
    const core = getCatalogueByCategory('core')
    const types = core.map((entry) => entry.type)
    expect(types).toContain('system-overview')
    expect(types).toContain('data-flow')
    expect(types).toContain('gate-lifecycle')
    expect(types).toContain('gate-roadmap')
    expect(types).toContain('context')
  })

  it('returns entries for conditional category', () => {
    const conditional = getCatalogueByCategory('conditional')
    expect(conditional.length).toBeGreaterThan(0)
  })

  it('all entries in category have correct category value', () => {
    const core = getCatalogueByCategory('core')
    core.forEach((entry) => {
      expect(entry.category).toBe('core')
    })
  })

  it('returns empty array for non-existent category', () => {
    const result = getCatalogueByCategory('nonexistent')
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Diagram Selector
// ---------------------------------------------------------------------------
describe('DiagramSelector', () => {
  let selector: DiagramSelector
  const mockThresholds = {
    mermaidMaxElements: 10,
    graphvizMaxNodes: 20,
  }

  beforeEach(() => {
    selector = new DiagramSelector(mockThresholds)
  })

  it('selectCoreDiagrams returns 5 core generators', () => {
    const generators = selector.selectCoreDiagrams()
    expect(generators).toHaveLength(5)
  })

  it('selectCoreDiagrams returns correct generator instances', () => {
    const generators = selector.selectCoreDiagrams()
    expect(generators.length).toBe(5)
    generators.forEach((gen) => {
      expect(gen).toBeTruthy()
      expect(gen.getType).toBeDefined()
    })
  })

  it('selectConditionalDiagrams returns generators for selected types', () => {
    const generators = selector.selectConditionalDiagrams(['sequence', 'component'], 'gate-01')
    expect(generators).toHaveLength(2)
    const types = generators.map((g) => g.getType())
    expect(types).toContain('sequence')
    expect(types).toContain('component')
  })

  it('selectConditionalDiagrams returns empty for empty input', () => {
    const generators = selector.selectConditionalDiagrams([], 'gate-01')
    expect(generators).toHaveLength(0)
  })

  it('selectConditionalDiagrams rejects invalid types with error', () => {
    expect(() => {
      selector.selectConditionalDiagrams(['invalid-type'], 'gate-01')
    }).toThrow()
  })

  it('selectConditionalDiagrams error message is descriptive', () => {
    expect(() => {
      selector.selectConditionalDiagrams(['invalid-type'], 'gate-01')
    }).toThrow(/invalid-type|diagram type/)
  })

  it('selectConditionalDiagrams rejects core types', () => {
    expect(() => {
      selector.selectConditionalDiagrams(['system-overview'], 'gate-01')
    }).toThrow()
  })

  it('selectAll combines core and conditional generators', () => {
    const all = selector.selectAll(['sequence', 'component'], 'gate-01')
    expect(all.length).toBe(7) // 5 core + 2 conditional
  })

  it('selectAll returns core generators first', () => {
    const all = selector.selectAll(['sequence'], 'gate-01')
    expect(all[0].getType()).toBe('system-overview') // First core generator
  })

  it('selectAll returns selected conditional generators', () => {
    const all = selector.selectAll(['sequence', 'package'], 'gate-01')
    const conditionalTypes = all.slice(5).map((g) => g.getType())
    expect(conditionalTypes).toContain('sequence')
    expect(conditionalTypes).toContain('package')
  })

  it('selectAll supports custom descriptors', () => {
    const descriptors = { sequence: 'State Machine' }
    const all = selector.selectAll(['sequence'], 'gate-01', descriptors)
    expect(all.length).toBe(6) // 5 core + 1 conditional
  })

  it('selectConditionalDiagrams returns deployment generator', () => {
    const generators = selector.selectConditionalDiagrams(['deployment'], 'gate-01')
    expect(generators).toHaveLength(1)
    expect(generators[0].getType()).toBe('deployment')
  })

  it('selectConditionalDiagrams returns network generator', () => {
    const generators = selector.selectConditionalDiagrams(['network'], 'gate-01')
    expect(generators).toHaveLength(1)
    expect(generators[0].getType()).toBe('network')
  })

  it('selectConditionalDiagrams returns all conditional types', () => {
    const generators = selector.selectConditionalDiagrams(
      ['sequence', 'component', 'package', 'deployment', 'network'],
      'gate-01'
    )
    expect(generators).toHaveLength(5)
    const types = generators.map((g) => g.getType())
    expect(types).toContain('deployment')
    expect(types).toContain('network')
  })
})
