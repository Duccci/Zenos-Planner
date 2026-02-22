/**
 * Diagram Generators Barrel Export
 *
 * Re-exports all core and conditional diagram generators for convenient importing.
 */

// Core generators
export { SystemOverviewGenerator } from './system-overview-generator.js'
export { DataFlowGenerator } from './data-flow-generator.js'
export { GateLifecycleGenerator } from './gate-lifecycle-generator.js'
export { GateRoadmapGenerator } from './gate-roadmap-generator.js'
export { ContextDiagramGenerator } from './context-diagram-generator.js'

// Conditional generators
export { SequenceDiagramGenerator } from './sequence-diagram-generator.js'
export { ComponentDiagramGenerator } from './component-diagram-generator.js'
export { PackageDiagramGenerator } from './package-diagram-generator.js'
export { DeploymentDiagramGenerator } from './deployment-diagram-generator.js'
export { NetworkDiagramGenerator } from './network-diagram-generator.js'

// Array of all core generator class names for iteration
export const CORE_GENERATORS = [
  'system-overview',
  'data-flow',
  'gate-lifecycle',
  'gate-roadmap',
  'context',
] as const

export type CoreGeneratorType = (typeof CORE_GENERATORS)[number]

// Array of all conditional generator class names for iteration
export const CONDITIONAL_GENERATORS = [
  'sequence',
  'component',
  'package',
  'deployment',
  'network',
] as const

export type ConditionalGeneratorType = (typeof CONDITIONAL_GENERATORS)[number]

// Combined array of all generators
export const ALL_GENERATORS = [...CORE_GENERATORS, ...CONDITIONAL_GENERATORS] as const

export type AllGeneratorType = CoreGeneratorType | ConditionalGeneratorType

export default {
  generators: ALL_GENERATORS,
  coreGenerators: CORE_GENERATORS,
  conditionalGenerators: CONDITIONAL_GENERATORS,
}
