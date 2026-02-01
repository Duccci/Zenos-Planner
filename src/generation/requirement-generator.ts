/**
 * Requirement Generator
 *
 * Main class for generating project-level requirements from end state descriptions.
 * Uses pattern matching to extract requirements and stores them in the database.
 */

import { extractRequirementCandidates, validateCandidates } from './requirement-patterns.js'
import { RequirementStorage } from './requirement-storage.js'
import { Requirement, GenerationResult } from './types.js'

/**
 * Main requirement generator class
 */
export class RequirementGenerator {
  private storage: RequirementStorage

  constructor(storage?: RequirementStorage) {
    this.storage = storage ?? new RequirementStorage()
  }

  /**
   * Generate requirements from an end state description
   * @param description - Natural language description of the desired end state
   * @returns Promise resolving to generated requirements
   */
  generateFromEndState(description: string): Requirement[] {
    const startTime = Date.now()

    try {
      // Extract candidate requirements using pattern matching
      const rawCandidates = extractRequirementCandidates(description)

      // Validate and filter candidates
      const validatedCandidates = validateCandidates(rawCandidates)

      // Store requirements in database (idempotent)
      const requirements = this.storage.storeRequirementsFromCandidates(
        validatedCandidates,
        'project', // Project-level requirements
        'generated' // Generated from end state
      )

      // Log generation statistics
      const processingTime = Date.now() - startTime
      console.log(`Generated ${String(requirements.length)} requirements from ${String(description.length)} characters in ${String(processingTime)}ms`)

      return requirements
    } catch (error) {
      console.error('Failed to generate requirements from end state:', error)
      throw error
    }
  }

  /**
   * Generate requirements with detailed result information
   * @param description - Natural language description of the desired end state
   * @returns Detailed generation result
   */
  generateWithDetails(description: string): GenerationResult {
    const startTime = Date.now()

    try {
      // Extract candidate requirements
      const rawCandidates = extractRequirementCandidates(description)

      // Validate and filter candidates
      const validatedCandidates = validateCandidates(rawCandidates)

      // Separate high-confidence candidates for storage
      const highConfidenceCandidates = validatedCandidates.filter(c => c.confidence >= 0.6)
      const lowConfidenceCandidates = validatedCandidates.filter(c => c.confidence < 0.6)

      // Store high-confidence requirements
      const requirements = this.storage.storeRequirementsFromCandidates(
        highConfidenceCandidates,
        'project',
        'generated'
      )

      const processingTime = Date.now() - startTime

      return {
        requirements,
        candidates: lowConfidenceCandidates,
        errors: [],
        metadata: {
          sourceTextLength: description.length,
          patternsMatched: rawCandidates.length,
          duplicatesRemoved: rawCandidates.length - validatedCandidates.length,
          processingTimeMs: processingTime,
        },
      }
    } catch (error) {
      const processingTime = Date.now() - startTime
      return {
        requirements: [],
        candidates: [],
        errors: [error instanceof Error ? error.message : String(error)],
        metadata: {
          sourceTextLength: description.length,
          patternsMatched: 0,
          duplicatesRemoved: 0,
          processingTimeMs: processingTime,
        },
      }
    }
  }

  /**
   * Get all existing project requirements
   */
  getProjectRequirements(): Requirement[] {
    return this.storage.getProjectRequirements()
  }

  /**
   * Update a requirement's status via storage layer
   */
  updateRequirementStatus(hash: string, status: 'pending' | 'implemented' | 'tested'): void {
    this.storage.updateRequirementStatus(hash, status)
  }

}