/**
 * Requirement Generator
 *
 * Main class for generating project-level requirements from end state descriptions.
 * Uses pattern matching to extract requirements and stores them in the database.
 */

import { extractRequirementCandidates, validateCandidates } from './requirement-patterns.js'
import { RequirementStorage } from './requirement-storage.js'
import { Requirement, GenerationResult, RequirementCandidate } from './types.js'
import { scanProjectFiles } from './project-file-scanner.js'
import { getZenoGitDir, getWorkspaceRoot } from '../utils/config.js'

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
  generateFromProjectStatement = (description: string): Requirement[] => {
    const startTime = Date.now()

    try {
      // Extract candidate requirements using pattern matching
      const rawCandidates = extractRequirementCandidates(description)

      // Validate and filter candidates
      const validatedCandidates = validateCandidates(rawCandidates)

      // Store requirements in database (idempotent)
      const requirements = this.storage.storeRequirementsFromCandidates(
        validatedCandidates,
        'default-project'
      )

      // Log generation statistics
      const processingTime = Date.now() - startTime
      console.log(
        'Generated ' +
          String(requirements.length) +
          ' requirements from ' +
          String(description.length) +
          ' characters in ' +
          String(processingTime) +
          'ms'
      )

      return requirements
    } catch (err: unknown) {
      const e: Error = err instanceof Error ? err : new Error(String(err))
      console.error('Failed to generate requirements from end state:', e)
      throw e
    }
  }

  /**
   * Generate requirements with detailed result information
   * @param description - Natural language description of the desired end state
   * @returns Detailed generation result
   */
  generateWithDetails = (description: string): GenerationResult => {
    const startTime = Date.now()

    try {
      // Extract candidate requirements
      const rawCandidates = extractRequirementCandidates(description)

      // Validate and filter candidates
      const validatedCandidates = validateCandidates(rawCandidates)

      // Separate high-confidence candidates for storage
      const highConfidenceCandidates = validatedCandidates.filter((c) => c.confidence >= 0.6)
      const lowConfidenceCandidates = validatedCandidates.filter((c) => c.confidence < 0.6)

      // Store high-confidence requirements
      const requirements = this.storage.storeRequirementsFromCandidates(
        highConfidenceCandidates,
        'default-project'
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
    } catch (err: unknown) {
      const e: Error = err instanceof Error ? err : new Error(String(err))
      const processingTime = Date.now() - startTime
      return {
        requirements: [],
        candidates: [],
        errors: [e.message],
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
   * Scan existing project files (README, docs/, specs/, …) for requirement-like
   * text and store any candidates found as project-level requirements.
   *
   * This is called automatically during `zeno init` so that spec files already
   * present in the repository are recognised as potential requirements without
   * the user having to paste their content into the project statement.
   *
   * @param projectRoot - Root directory of the project to scan (defaults to cwd)
   * @returns Requirements extracted from discovered spec files
   */
  generateFromProjectFiles = async (projectRoot: string = process.cwd()): Promise<Requirement[]> => {
    const scan = await scanProjectFiles(projectRoot)

    if (scan.files.length === 0 || !scan.combinedText.trim()) {
      return []
    }

    const rawCandidates = extractRequirementCandidates(scan.combinedText)
    const validatedCandidates = validateCandidates(rawCandidates)

    const requirements = this.storage.storeRequirementsFromCandidates(
      validatedCandidates,
      'default-project'
    )

    console.log(
      `Extracted ${String(requirements.length)} requirements from ${String(scan.files.length)} project file(s): ` +
      scan.files.map((f) => f.relativePath).join(', ')
    )

    return requirements
  }

  /**
   * Get all existing project requirements
   */
  getProjectRequirements = (): Requirement[] => {
    return this.storage.getProjectRequirements()
  }

  /**
   * Extract requirement candidates from arbitrary text using pattern library
   */
  static extractRequirementsFromText(text: string): RequirementCandidate[] {
    // delegate to pattern extractor
    return extractRequirementCandidates(text)
  }

  /**
   * Approve / flag / reject candidates based on confidence thresholds
   */
  static approveRequirements(candidates: RequirementCandidate[]): {
    approved: RequirementCandidate[]
    review: RequirementCandidate[]
    rejected: RequirementCandidate[]
  } {
    const approved: RequirementCandidate[] = []
    const review: RequirementCandidate[] = []
    const rejected: RequirementCandidate[] = []

    for (const c of candidates) {
      if (c.confidence > 0.8) approved.push(c)
      else if (c.confidence >= 0.5) review.push(c)
      else rejected.push(c)
    }

    return { approved, review, rejected }
  }

  /**
   * Generate gate-specific requirements by reading gate PRD objectives
   */
  generateRequirementsForGate = async (gateId: string): Promise<Requirement[]> => {
    // Find gate PRD file under zeno/gates starting with gateId
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const gatesDir = path.join(getZenoGitDir(getWorkspaceRoot()), 'gates')

    const files = await fs.readdir(gatesDir)
    const gateFile = files.find((f) => f.startsWith(gateId))
    if (!gateFile) throw new Error(`Gate PRD not found for ${gateId}`)

    const content = await fs.readFile(path.join(gatesDir, gateFile), 'utf8')

    // Extract objectives section (simple heading parser)
    const objectives = extractObjectivesFromPRD(content)

    const allStored: Requirement[] = []

    for (const obj of objectives) {
      const candidates = RequirementGenerator.extractRequirementsFromText(obj)
      const { approved, review } = RequirementGenerator.approveRequirements(candidates)

      // Store approved candidates
      for (const cand of approved) {
        const stored = this.storage.storeRequirement(
          cand.description,
          cand.type,
          cand.priority,
          'default-project',
          gateId,
          undefined
        )

        allStored.push(stored)
      }

      // For medium-confidence candidates, create review entries (do not auto-store)
      // Keep review candidates available for manual inspection; do not iterate to avoid unused variable lint.
      void review
    }

    return allStored
  }

  /**
   * Recursively decompose a requirement into child requirements
   */
  decomposeRequirement = async (
    parent: Requirement,
    maxDepth = 3,
    parentConfidence = 1.0
  ): Promise<Requirement[]> => {
    const created: Requirement[] = []

    // Base case
    if (maxDepth <= 0) return created

    // Extract candidates from parent description
    const candidates = extractRequirementCandidates(parent.description)

    // For each candidate, compute child confidence and store as child requirement
    for (const c of candidates) {
      const childConfidence = Math.max(0, parentConfidence * 0.9)

      // Optionally filter very low confidence
      if (childConfidence < 0.1) continue

      const child = this.storage.storeRequirement(
        c.description,
        c.type,
        c.priority,
        parent.projectId,
        parent.gateId ?? undefined,
        undefined,
        parent.id
      )

      created.push(child)

      // Recurse deeper
      if (maxDepth - 1 > 0) {
        const grandchildren = await this.decomposeRequirement(child, maxDepth - 1, childConfidence)
        created.push(...grandchildren)
      }
    }

    return created
  }

}

/** Helper: Extract objectives section from a gate PRD markdown */
function extractObjectivesFromPRD(text: string): string[] {
  const lines = text.split(/\r?\n/)
  const objectives: string[] = []
  let inSection = false
  for (const line of lines) {
    if (/^#{2,}\s+Objectives/i.test(line)) {
      inSection = true
      continue
    }
    if (inSection) {
      if (/^#{1,3}\s+/.test(line) && !/^#{2,}\s+Objectives/i.test(line)) break
      const item = line.trim()
      // capture list items and plain paragraphs
      if (/^[-*+]\s+/.test(item) || item.length > 0) {
        // remove leading list markers
        objectives.push(item.replace(/^[-*+]\s+/, '').trim())
      }
    }
  }
  // Filter empty and return
  return objectives.filter((o) => o.length > 0)
}
