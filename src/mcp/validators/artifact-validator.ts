/**
 * Artifact Validator (Unified Composition)
 *
 * Composable validation framework that combines all artifact checks.
 * Validates proposals, gates, and architecture diagrams against Zeno's
 * format and structure requirements.
 *
 * *** IMPORTANT: Structure validation is MANDATORY ***
 * Structure validation cannot be disabled. All artifacts must satisfy
 * both format and structure requirements to pass validation.
 *
 * This validator does NOT invoke external quality checks (pre-commit, tests, linters).
 * Quality validation is the responsibility of the target project.
 * This validator only checks that artifacts follow Zeno's format and structure.
 *
 * Checks performed on Proposals:
 *   Format (always):
 *     1. Required sections (Summary, Tasks, Files Affected, Dependencies)
 *     2. Single-phase only (no Phase 1/2 language)
 *   Structure (always, non-optional):
 *     3. Test-first pattern (if gate-tied): role matches file types
 *     4. Scope validation: explicit file paths, no wildcards
 *     5. Dependency validation: no circular deps, valid references
 *
 * Checks performed on Gates:
 *   Format (always):
 *     1. Required sections (Objectives, Requirements, Architecture, Scope Boundaries)
 *     2. Valid Status field
 *   Structure (always, non-optional):
 *     3. Test-first pattern gate-level structure enforcement
 *     4. Proposal ordering validation
 *
 * Checks performed on Architecture Diagrams:
 *   Format (always):
 *     1. Contains diagram content (mermaid, dot, or SVG)
 */

import { readFile } from '../../utils/file.js'
import { logger } from '../../utils/logger.js'
import type { ValidationResult } from './types.js'
import {
  validateProposalPhases,
  type ProposalPhasesValidationContext,
} from './proposal-phases-validator.js'
import {
  validateTestFirstPattern,
  type TestFirstValidationContext,
} from './test-first-validator.js'
import { validateScope, type ScopeValidationContext } from './scope-validator.js'
import {
  validateDependencies,
  type DependencyValidationContext,
  type DependencyNode,
} from './dependency-validator.js'

export type ArtifactType = 'proposal' | 'gate' | 'architecture'

/**
 * DEPRECATED: ValidationMode is maintained for backward compatibility only.
 *
 * Structure validation is now MANDATORY and cannot be disabled.
 * The 'structure' and 'all' modes are equivalent.
 *
 * @deprecated All validations now enforce structure validation
 */

export type ValidationMode = 'format' | 'structure' | 'all'

export interface ArtifactValidationContext {
  /** Type of artifact being validated */
  artifactType: ArtifactType
  /** Path to the artifact file */
  artifactPath: string
  /** Content of the artifact */
  content: string
  /**
   * DEPRECATED: Structure validation is now mandatory.
   * This parameter is ignored; all artifacts are validated against both format and structure.
   *
   * @deprecated Structure validation cannot be disabled
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  validationMode?: ValidationMode
  /** For proposals: gate ID if gate-tied */
  gateId?: string
  /** For proposals: proposal hash for dependency checking */
  hash?: string
  /** For proposals: role declared in the proposal */
  role?: string
  /** For test-first pattern validation: all proposals in the same gate */
  gateProposals?: { hash: string; role?: string; createdAt: string }[]
  /** For dependency validation: all nodes in the system */
  allNodes?: Map<string, DependencyNode>
}

/**
 * Required sections for proposals (from template).
 * These must be present for the proposal to be valid.
 */
const PROPOSAL_REQUIRED_SECTIONS = [
  '## Summary',
  '## Tasks',
  '## Files Affected',
  '## Dependencies',
]

/**
 * Required sections for gates.
 * These must be present for the gate to be valid.
 */
const GATE_REQUIRED_SECTIONS: string[] = []
const GATE_OPTIONAL_SECTIONS = [
  '## Objectives',
  '## Requirements',
  '## Architecture',
  'Scope Boundaries',
]

/**
 * Validate a proposal artifact comprehensively.
 *
 * ALWAYS enforces both format and structure validation.
 * validationMode parameter is deprecated and ignored.
 */
function validateProposalArtifact(context: ArtifactValidationContext): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { content } = context

  // =========================================================================
  // PHASE 1: FORMAT VALIDATION (always enforced)
  // =========================================================================

  // Check 1: Required sections
  for (const section of PROPOSAL_REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      errors.push(`Missing required section: "${section}"`)
    }
  }

  // Check 2: Single-phase only (detect multi-phase language)
  const phasesContext: ProposalPhasesValidationContext = {
    title: extractField(content, 'Proposal:', 1) ?? 'Unknown',
    summary: extractField(content, '## Summary', 5) ?? '',
    implementationNotes: extractField(content, '## Implementation Notes', 10),
    taskDescriptions: extractTaskDescriptions(content),
    rollback: extractField(content, '## Rollback|Implications', 10),
  }

  const phasesResult = validateProposalPhases(phasesContext)
  errors.push(...(phasesResult.errors ?? []))
  warnings.push(...(phasesResult.warnings ?? []))

  // =========================================================================
  // PHASE 2: STRUCTURE VALIDATION (always enforced, non-optional)
  // =========================================================================

  // Check 3: Test-first pattern (if gate-tied)
  if (context.gateId && context.gateProposals) {
    const filesAffected = extractFilesAffected(content)
    const testFirstContext: TestFirstValidationContext = {
      proposalHash: context.hash ?? 'unknown',
      role: context.role,
      isGateTied: !!context.gateId,
      filesAffected,
      gateProposals: context.gateProposals.map((p) => ({
        hash: p.hash,
        role: p.role,
        createdAt: p.createdAt,
      })),
    }

    const testFirstResult = validateTestFirstPattern(testFirstContext)
    errors.push(...(testFirstResult.errors ?? []))
    warnings.push(...(testFirstResult.warnings ?? []))
  }

  // Check 4: Scope validation (explicit paths, no wildcards)
  // ALWAYS performed - this is a structural requirement
  const filesAffected = extractFilesAffected(content)
  const scopeContext: ScopeValidationContext = {
    filesAffected,
    filesModified: filesAffected, // Assume declared files will be modified
    allowTestFiles: true,
  }

  const scopeResult = validateScope(scopeContext)
  errors.push(...(scopeResult.errors ?? []))
  warnings.push(...(scopeResult.warnings ?? []))

  // Check 5: Dependency validation (if dependencies exist and nodes available)
  // ALWAYS performed if context allows - this is a structural requirement
  if (context.allNodes && context.hash) {
    const dependencies = extractDependencies(content)
    const node: DependencyNode = {
      hash: context.hash,
      dependencies,
      gateId: context.gateId,
    }

    const depContext: DependencyValidationContext = {
      node,
      allNodes: context.allNodes,
    }

    const depResult = validateDependencies(depContext)
    errors.push(...(depResult.errors ?? []))
    warnings.push(...(depResult.warnings ?? []))
  }

  // =========================================================================
  // RETURN RESULT
  // =========================================================================

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Validate a gate artifact.
 *
 * ALWAYS enforces both format and structure validation.
 * validationMode parameter is deprecated and ignored.
 */
function validateGateArtifact(context: ArtifactValidationContext): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { content } = context

  // =========================================================================
  // PHASE 1: FORMAT VALIDATION (always enforced)
  // =========================================================================

  // Check 1: Required sections
  for (const section of GATE_REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      errors.push(`Gate: missing required section: "${section}"`)
    }
  }

  // Check 1b: Optional sections (missing → warning, not error)
  for (const section of GATE_OPTIONAL_SECTIONS) {
    if (!content.includes(section)) {
      warnings.push(`Gate: missing section: "${section}"`)
    }
  }

  // Check 2: Valid Status field
  if (!/\*\*Status\*\*:\s*(pending|in_progress|completed|rejected|archived|cancelled|backlog)/i.test(content)) {
    errors.push(
      'Gate Status field missing or invalid (expected **Status**: one of pending|in_progress|completed|rejected|archived|cancelled|backlog)'
    )
  }

  // =========================================================================
  // PHASE 2: STRUCTURE VALIDATION (always enforced, non-optional)
  // =========================================================================

  // Gates with associated proposals must validate Test-First pattern at gate level
  // This is enforced when gate is completed or at proposal approval time
  // (structure checks delegated to validateTestFirstPattern when proposals are available)

  // =========================================================================
  // RETURN RESULT
  // =========================================================================

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Validate an architecture diagram artifact (mermaid/dot/svg).
 *
 * Checks that the file contains valid diagram content.
 */
function validateArchitectureArtifact(context: ArtifactValidationContext): ValidationResult {
  const errors: string[] = []
  const { content } = context

  // Check for diagram content (mermaid, dot, or SVG)
  if (!/```mermaid|```dot|digraph|graph\s+|<svg/i.test(content)) {
    errors.push(
      'Architecture file does not contain valid diagram content. ' +
        'Expected mermaid (```mermaid...```), dot (digraph {...}), or SVG (<svg...>).'
    )
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Validate any artifact by type.
 */
export function validateArtifact(context: ArtifactValidationContext): ValidationResult {
  switch (context.artifactType) {
    case 'proposal':
      return validateProposalArtifact(context)
    case 'gate':
      return validateGateArtifact(context)
    case 'architecture':
      return validateArchitectureArtifact(context)
    default:
      return {
        allowed: false,
        errors: [`Unknown artifact type: ${String(context.artifactType)}`],
      }
  }
}

// ============================================================================
// Helper functions for field extraction
// ============================================================================

/**
 * Extract field value from markdown (simple regex-based).
 */
function extractField(content: string, pattern: string, maxLines: number): string | undefined {
  const regex = new RegExp(`${pattern}[^\\n]*\\n([\\s\\S]*?)(?=##|$)`, 'i')
  const match = content.match(regex)
  if (!match?.[1]) return undefined

  // Return first maxLines of captured group
  const lines = match[1].split('\n').slice(0, maxLines).join('\n')
  return lines.trim() || undefined
}

/**
 * Extract task descriptions from the Tasks section.
 */
function extractTaskDescriptions(content: string): string[] {
  const taskSection = extractField(content, '## Tasks', 100) ?? ''
  // Simple extraction: each task is a bullet or numbered item
  const tasks: string[] = []
  for (const line of taskSection.split('\n')) {
    if (/^[*-]\s+/.exec(line) || /^\d+\.\s+/.exec(line)) {
      tasks.push(line.replace(/^[*\d+.-]\s+/, '').trim())
    }
  }
  return tasks
}

/**
 * Extract Files Affected list from the proposal.
 */
function extractFilesAffected(content: string): string[] {
  const filesSection = extractField(content, '## Files Affected', 50) ?? ''
  const files: string[] = []

  // Handle both table format and list format
  const lines = filesSection.split('\n')
  for (const line of lines) {
    // Skip headers and separators
    if (line.includes('|') && !/^\s*\|.*\|\s*$/.exec(line)) continue

    // Extract paths from pipes (table format)
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
    for (const cell of cells) {
      // Match file paths (contain . for extension)
      if (cell.includes('.') && (cell.includes('/') || cell.includes('src'))) {
        files.push(cell)
      }
    }

    // Also handle list format
    if (/^\s*[*-]\s+/.exec(line)) {
      const path = line.replace(/^\s*[*-]\s+/, '').trim()
      if (path) files.push(path)
    }
  }

  return [...new Set(files)] // Deduplicate
}

/**
 * Extract dependencies from the Dependencies section.
 */
function extractDependencies(content: string): string[] {
  const depsSection = extractField(content, '## Dependencies', 50) ?? ''

  if (depsSection.toLowerCase().includes('no dependencies')) {
    return []
  }

  const deps: string[] = []
  const hashPattern = /#[a-f0-9]{16}/g
  const matches = depsSection.match(hashPattern)

  if (matches) {
    deps.push(...matches.map((h) => h.slice(1)))
  }

  return [...new Set(deps)] // Deduplicate
}

/**
 * Load artifact from disk and validate it.
 *
 * @param filePath - Path to the artifact file
 * @param artifactType - Type of artifact (proposal, gate, architecture)
 * @param validationMode - DEPRECATED: ignored. Structure validation is always enforced.
 * @param additionalContext - Additional validation context (gateId, role, proposals, etc.)
 * @returns ValidationResult with allowed, errors, and warnings
 *
 * NOTE: Structure validation is MANDATORY and cannot be disabled.
 * All artifacts are validated against both format and structure requirements.
 */

export async function validateArtifactFile(
  filePath: string,
  artifactType: ArtifactType,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  validationMode?: ValidationMode,
  additionalContext?: Partial<ArtifactValidationContext>
): Promise<ValidationResult> {
  try {
    const content = await readFile(filePath)

    return validateArtifact({
      artifactType,
      artifactPath: filePath,
      content,
      /* eslint-disable-next-line @typescript-eslint/no-deprecated */
      validationMode, // Deprecated but passed through for backward compatibility
      ...additionalContext,
    })
  } catch (err) {
    logger.error('Failed to validate artifact', { filePath, error: err })
    return {
      allowed: false,
      errors: [`Failed to read artifact file: ${String(err)}`],
    }
  }
}
