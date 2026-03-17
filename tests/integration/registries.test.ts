import { describe, it, expect } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerGatesOps } from '../../src/integration/gates-registry.js'
import { registerProposalsOps } from '../../src/integration/proposals-registry.js'
import { registerRequirementsOps } from '../../src/integration/requirements-registry.js'
import { registerConfigOps } from '../../src/integration/config-registry.js'
import { registerTemplateOps } from '../../src/integration/template-registry.js'
import { registerRepositoryOps, registerArchitectureOps, registerAnalysisOps } from '../../src/integration/schema-registry.js'

describe('Domain Registries', () => {
  it('registers gates functions', () => {
    const registry = new FunctionRegistry()
    registerGatesOps(registry)

    expect(registry.get('gates_list')).toBeDefined()
    expect(registry.get('gates_show')).toBeDefined()
    // Validate parameter schema for gates_show
    const schema = (registry.get('gates_show') as any).schema
    expect(() => schema.parse({ gateId: 'gate-01' })).not.toThrow()
  })

  it('registers proposal functions', () => {
    const registry = new FunctionRegistry()
    registerProposalsOps(registry)

    expect(registry.get('proposal_list')).toBeDefined()
    expect(registry.get('proposal_show')).toBeDefined()
    const schema = (registry.get('proposal_show') as any).schema
    expect(() => schema.parse({ hash: 's123' })).not.toThrow()
  })

  it('registers requirement functions', () => {
    const registry = new FunctionRegistry()
    registerRequirementsOps(registry)

    expect(registry.get('reg_action')).toBeDefined()
    const schema = (registry.get('reg_action') as any).schema
    expect(() => schema.parse({ action: 'show', payload: { hash: 'r1' } })).not.toThrow()
  })

  it('registers template functions', () => {
    const registry = new FunctionRegistry()
    registerTemplateOps(registry)

    expect(registry.get('template_list')).toBeDefined()
    expect(registry.get('template_get')).toBeDefined()
  })

  it('registers repository/architecture/analysis ops', () => {
    const registry = new FunctionRegistry()
    registerRepositoryOps(registry)
    registerArchitectureOps(registry)
    registerAnalysisOps(registry)

    expect(registry.get('repos_list')).toBeDefined()
    expect(registry.get('arch_generate')).toBeDefined()
    expect(registry.get('analyze')).toBeDefined()
  })
})