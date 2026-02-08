/**
 * Requirement Generation Types
 *
 * TypeScript interfaces and types for requirement generation and storage.
 * Aligned with SQLite database schema for requirements table.
 */

/**
 * Requirement type categories
 */
export type RequirementType = 'functional' | 'non_functional' | 'constraint'

/**
 * Requirement priority levels (MoSCoW method)
 */
export type RequirementPriority = 'must' | 'should' | 'could' | 'wont'

/**
 * Requirement status in the development lifecycle
 */
export type RequirementStatus = 'pending' | 'implemented' | 'tested'

/**
 * Requirement level (project-wide or gate-specific)
 */
export type RequirementLevel = 'project' | 'gate'

/**
 * How the requirement was created
 */
export type RequirementSource = 'generated' | 'inherited' | 'transferred'

/**
 * Core requirement interface
 * Includes status field for lifecycle tracking (pending → implemented → tested).
 * Implementation progress tracked through Git commits and proposal completion.
 */
export interface Requirement {
  /** Unique identifier */
  id: string
  /** Associated gate ID (null for project-level) */
  gateId: string | null
  /** Parent requirement ID for hierarchical requirements */
  parentId: string | null
  /** Project-level requirement this derives from */
  projectRequirementId: string | null
  /** Type of requirement */
  type: RequirementType
  /** Priority level */
  priority: RequirementPriority
  /** Whether this is project or gate level */
  level: RequirementLevel
  /** How this requirement was created */
  source: RequirementSource
  /** Human-readable description */
  description: string
  /** Acceptance criteria for completion */
  acceptanceCriteria?: string
  /** Content-addressed hash for uniqueness */
  hash: string
  /** Gate where this requirement originated (for transferred requirements) */
  sourceGateId?: string
  /** Requirement status in lifecycle: pending → implemented → tested */
  status: RequirementStatus
  /** Creation timestamp */
  createdAt: Date
}

/**
 * Extracted requirement candidate before validation
 */
export interface RequirementCandidate {
  /** Extracted description */
  description: string
  /** Inferred type */
  type: RequirementType
  /** Inferred priority */
  priority: RequirementPriority
  /** Confidence score (0.0 to 1.0) */
  confidence: number
  /** Source text that led to this extraction */
  sourceText: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Pattern for requirement extraction
 */
export interface RequirementPattern {
  /** Pattern name for debugging */
  name: string
  /** Regular expression or keyword list */
  pattern: RegExp | string[]
  /** Default type for matches */
  type: RequirementType
  /** Default priority for matches */
  priority: RequirementPriority
  /** Base confidence score */
  confidence: number
  /** Optional transformation function */
  transform?: (match: string, context: string) => string
}

/**
 * Result of requirement generation
 */
export interface GenerationResult {
  /** Successfully generated requirements */
  requirements: Requirement[]
  /** Candidates that couldn't be validated */
  candidates: RequirementCandidate[]
  /** Any errors during generation */
  errors: string[]
  /** Metadata about the generation process */
  metadata: {
    sourceTextLength: number
    patternsMatched: number
    duplicatesRemoved: number
    processingTimeMs: number
  }
}
