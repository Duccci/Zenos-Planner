/**
 * Diagram Generators Barrel Export
 *
 * Re-exports all core diagram generators for convenient importing.
 */

export { SystemOverviewGenerator } from './system-overview-generator.js'
export { DataFlowGenerator } from './data-flow-generator.js'
export { GateLifecycleGenerator } from './gate-lifecycle-generator.js'
export { GateRoadmapGenerator } from './gate-roadmap-generator.js'
export { ContextDiagramGenerator } from './context-diagram-generator.js'

// Array of all core generator classes for iteration
export const CORE_GENERATORS = [
  'system-overview',
  'data-flow',
  'gate-lifecycle',
  'gate-roadmap',
  'context',
] as const

export type CoreGeneratorType = (typeof CORE_GENERATORS)[number]

export default {
  generators: CORE_GENERATORS,
}
