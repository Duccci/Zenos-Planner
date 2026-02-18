// Central re-exports for MCP schemas + tool registry utilities
export * from './gate-schemas.js'
export * from './gate-create-schemas.js'
export * from './gates-action-schemas.js'
export * from './proposal-schemas.js'
export * from './proposal-create-schemas.js'
export * from './proposal-action-schemas.js'
export * from './requirement-schemas.js'
export * from './req-action-schemas.js'
export * from './archive-schemas.js'
export * from './config-schemas.js'
export * from './common-schemas.js'
export * from './analysis-schemas.js'
export * from './workflow-schemas.js'
export * from './architecture-action-schemas.js'
export * from './git-trace-schemas.js'
export * from './repository-action-schemas.js'
// Note: repository-schemas exports DependencyEdge which conflicts with requirement-schemas
// Import directly from './repository-schemas.js' when needed in specific modules
export * from './worktree-schemas.js'
export * from './artifact-validation-schemas.js'

// Registry imports and exports
import { ToolRegistry, type ToolRegistryType } from './registry.js'
export { ToolRegistry, type ToolRegistryType }

// Utility to get schema by entity key
export function getToolSchema(
  entity: keyof typeof ToolRegistry
): (typeof ToolRegistry)[keyof typeof ToolRegistry] {
  return ToolRegistry[entity]
}

// Utility to get actions for an entity
export function getToolActions(entity: keyof typeof ToolRegistry): string[] {
  return [...ToolRegistry[entity].actions] as string[]
}
