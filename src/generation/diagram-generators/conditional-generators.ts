/**
 * Conditional Diagram Generators Module
 *
 * Re-exports and wraps conditional diagram generators with a consistent interface
 * for accessing generator metadata and functionality.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { SequenceDiagramGenerator as SequenceDiagramGeneratorImpl } from './sequence-diagram-generator.js'
import { ComponentDiagramGenerator as ComponentDiagramGeneratorImpl } from './component-diagram-generator.js'
import { PackageDiagramGenerator as PackageDiagramGeneratorImpl } from './package-diagram-generator.js'
import { DeploymentDiagramGenerator as DeploymentDiagramGeneratorImpl } from './deployment-diagram-generator.js'
import { NetworkDiagramGenerator as NetworkDiagramGeneratorImpl } from './network-diagram-generator.js'

/**
 * Wrapper class for SequenceDiagramGenerator with additional properties
 */
export class SequenceDiagramGenerator extends SequenceDiagramGeneratorImpl {
  type = 'sequence'
  category = 'conditional'
  preferredRenderer = 'mermaid'

  getFilename(gateHash: string, descriptor = 'interaction'): string {
    return `sequence-${gateHash}-${descriptor}.md`
  }

  override generateContent(_context: DiagramContext): string {
    return super.generateContent(_context)
  }
}

/**
 * Wrapper class for ComponentDiagramGenerator with additional properties
 */
export class ComponentDiagramGenerator extends ComponentDiagramGeneratorImpl {
  type = 'component'
  category = 'conditional'
  preferredRenderer = 'mermaid'

  getFilename(gateHash: string, componentName = 'component'): string {
    return `component-${gateHash}-${componentName}.md`
  }

  override generateContent(_context: DiagramContext): string {
    return super.generateContent(_context)
  }
}

/**
 * Wrapper class for PackageDiagramGenerator with additional properties
 */
export class PackageDiagramGenerator extends PackageDiagramGeneratorImpl {
  type = 'package'
  category = 'conditional'
  preferredRenderer = 'mermaid'

  getFilename(gateHash: string, _scope = 'project'): string {
    return `package-${gateHash}.md`
  }

  override generateContent(_context: DiagramContext): string {
    return super.generateContent(_context)
  }
}

/**
 * Wrapper class for DeploymentDiagramGenerator with additional properties
 */
export class DeploymentDiagramGenerator extends DeploymentDiagramGeneratorImpl {
  type = 'deployment'
  category = 'conditional'
  preferredRenderer = 'graphviz'

  getFilename(gateHash: string, env = 'production'): string {
    return `deployment-${gateHash}-${env}.md`
  }

  override generateContent(_context: DiagramContext): string {
    return super.generateContent(_context)
  }
}

/**
 * Wrapper class for NetworkDiagramGenerator with additional properties
 */
export class NetworkDiagramGenerator extends NetworkDiagramGeneratorImpl {
  type = 'network'
  category = 'conditional'
  preferredRenderer = 'graphviz'

  getFilename(gateHash: string, networkName = 'enterprise'): string {
    return `network-${gateHash}-${networkName}.md`
  }

  override generateContent(_context: DiagramContext): string {
    return super.generateContent(_context)
  }
}

/**
 * Array of all conditional generator instances
 */
export const CONDITIONAL_GENERATORS = [
  new SequenceDiagramGenerator(),
  new ComponentDiagramGenerator(),
  new PackageDiagramGenerator(),
  new DeploymentDiagramGenerator(),
  new NetworkDiagramGenerator(),
] as const

/**
 * Array of all generators (core + conditional)
 * Core generators: system-overview, data-flow, gate-lifecycle, gate-roadmap, context (5)
 * Conditional generators: sequence, component, package, deployment, network (5)
 * Total: 10 generators
 */
export const ALL_GENERATORS = [
  // Core generators (by type reference, not instance)
  'system-overview',
  'data-flow',
  'gate-lifecycle',
  'gate-roadmap',
  'context',
  // Conditional generators (instances with properties)
  ...CONDITIONAL_GENERATORS,
] as const

export default {
  generators: CONDITIONAL_GENERATORS,
}
