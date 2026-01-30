/**
 * Requirement Pattern Extraction
 *
 * Defines patterns and logic for extracting requirement candidates from natural language text.
 * Uses keyword matching and regular expressions to identify potential requirements.
 */

import { RequirementCandidate, RequirementPattern } from './types.js'

/**
 * Common requirement patterns organized by category
 */
const REQUIREMENT_PATTERNS: RequirementPattern[] = [
  // Functional requirements - what the system should do
  {
    name: 'functional-must-support',
    pattern: /\bmust support\b/i,
    type: 'functional',
    priority: 'must',
    confidence: 0.9,
    transform: (match, context) => `System ${match} ${extractObject(context, match)}`,
  },
  {
    name: 'functional-should-support',
    pattern: /\bshould support\b/i,
    type: 'functional',
    priority: 'should',
    confidence: 0.8,
    transform: (match, context) => `System ${match} ${extractObject(context, match)}`,
  },
  {
    name: 'functional-provide',
    pattern: /\bprovide\b/i,
    type: 'functional',
    priority: 'should',
    confidence: 0.7,
    transform: (match, context) => `System must ${match} ${extractObject(context, match)}`,
  },
  {
    name: 'functional-integrate',
    pattern: /\bintegrate\b/i,
    type: 'functional',
    priority: 'should',
    confidence: 0.7,
    transform: (match, context) => `System must ${match} ${extractObject(context, match)}`,
  },
  {
    name: 'functional-handle',
    pattern: /\bhandle\b/i,
    type: 'functional',
    priority: 'should',
    confidence: 0.6,
    transform: (match, context) => `System must ${match} ${extractObject(context, match)}`,
  },
  {
    name: 'functional-need',
    pattern: /\bneed\b/i,
    type: 'functional',
    priority: 'should',
    confidence: 0.7,
    transform: (match, context) => `System must provide ${extractObject(context, match)}`,
  },

  // Non-functional requirements - quality attributes
  {
    name: 'non-functional-must-be',
    pattern: /\bmust be\b/i,
    type: 'non_functional',
    priority: 'must',
    confidence: 0.8,
    transform: (match, context) => `System ${match} ${extractObject(context, match)}`,
  },
  {
    name: 'non-functional-should-be',
    pattern: /\bshould be\b/i,
    type: 'non_functional',
    priority: 'should',
    confidence: 0.7,
    transform: (match, context) => `System ${match} ${extractObject(context, match)}`,
  },
  {
    name: 'non-functional-could-be',
    pattern: /\bcould be\b/i,
    type: 'non_functional',
    priority: 'could',
    confidence: 0.6,
    transform: (match, context) => `System ${match} ${extractObject(context, match)}`,
  },
  {
    name: 'performance-response-time',
    pattern: /\bresponse time\b/i,
    type: 'non_functional',
    priority: 'must',
    confidence: 0.8,
    transform: (match, context) => `System must have response time ${extractConstraint(context, match)}`,
  },
  {
    name: 'performance-throughput',
    pattern: /\bthroughput\b/i,
    type: 'non_functional',
    priority: 'should',
    confidence: 0.7,
    transform: (match, context) => `System should achieve throughput ${extractConstraint(context, match)}`,
  },
  {
    name: 'performance-scalability',
    pattern: /\bscalab/i,
    type: 'non_functional',
    priority: 'should',
    confidence: 0.7,
    transform: (match, context) => `System should be scalable ${extractConstraint(context, match)}`,
  },
  {
    name: 'security-secure',
    pattern: /\bmust be secur/i,
    type: 'non_functional',
    priority: 'must',
    confidence: 0.8,
    transform: (match, context) => `System ${match} ${extractObject(context, match)}`,
  },
  {
    name: 'reliability-reliable',
    pattern: /\breliab/i,
    type: 'non_functional',
    priority: 'must',
    confidence: 0.8,
    transform: (match, context) => `System must be reliable ${extractConstraint(context, match)}`,
  },
  {
    name: 'usability-user-friendly',
    pattern: /\buser.?friend/i,
    type: 'non_functional',
    priority: 'should',
    confidence: 0.6,
    transform: (match, context) => `System should be user-friendly ${extractConstraint(context, match)}`,
  },
  {
    name: 'maintainability-maintainable',
    pattern: /\bmaintainab/i,
    type: 'non_functional',
    priority: 'should',
    confidence: 0.6,
    transform: (match, context) => `System should be maintainable ${extractConstraint(context, match)}`,
  },

  // Quality requirements - testing and documentation
  {
    name: 'testing-coverage',
    pattern: /\btest.*coverage\b/i,
    type: 'non_functional',
    priority: 'must',
    confidence: 0.9,
    transform: (match, context) => `System must achieve ${extractMetric(context, match)} test coverage`,
  },
  {
    name: 'testing-automated',
    pattern: /\bautomated.*test/i,
    type: 'non_functional',
    priority: 'should',
    confidence: 0.7,
    transform: (match, context) => `System should have automated tests ${extractConstraint(context, match)}`,
  },
  {
    name: 'documentation-documented',
    pattern: /\bdocument/i,
    type: 'non_functional',
    priority: 'should',
    confidence: 0.6,
    transform: (match, context) => `System should be well-documented ${extractConstraint(context, match)}`,
  },

  // Constraints - limitations and compliance
  {
    name: 'constraint-compliance',
    pattern: /\bmust comply with\b/i,
    type: 'constraint',
    priority: 'must',
    confidence: 0.9,
    transform: (match, context) => `System ${match} ${extractObject(context, match)}`,
  },
  {
    name: 'constraint-platform',
    pattern: /\bplatform/i,
    type: 'constraint',
    priority: 'must',
    confidence: 0.8,
    transform: (match, context) => `System must run on ${extractObject(context, match)}`,
  },
  {
    name: 'constraint-browser',
    pattern: /\bbrowser/i,
    type: 'constraint',
    priority: 'must',
    confidence: 0.8,
    transform: (match, context) => `System must support ${extractObject(context, match)} browsers`,
  },
  {
    name: 'constraint-offline',
    pattern: /\boffline\b/i,
    type: 'constraint',
    priority: 'should',
    confidence: 0.7,
    transform: (match, context) => `System should work offline ${extractConstraint(context, match)}`,
  },
]

/**
 * Extract requirement candidates from text using pattern matching
 */
export function extractRequirementCandidates(text: string): RequirementCandidate[] {
  const candidates: RequirementCandidate[] = []
  const sentences = splitIntoSentences(text)

  for (const sentence of sentences) {
    for (const pattern of REQUIREMENT_PATTERNS) {
      const matches = findMatches(sentence, pattern)
      for (const match of matches) {
        const description = pattern.transform
          ? pattern.transform(match, sentence)
          : generateDefaultDescription(match, pattern)

        // Avoid duplicates
        if (!candidates.some(c => c.description === description)) {
          candidates.push({
            description,
            type: pattern.type,
            priority: pattern.priority,
            confidence: pattern.confidence,
            sourceText: sentence.trim(),
            metadata: {
              pattern: pattern.name,
              match,
            },
          })
        }
      }
    }
  }

  // Sort by confidence descending
  return candidates.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Find matches for a pattern in text
 */
function findMatches(text: string, pattern: RequirementPattern): string[] {
  if (Array.isArray(pattern.pattern)) {
    // Keyword matching
    return pattern.pattern.filter(keyword =>
      new RegExp(`\\b${keyword}\\b`, 'i').test(text)
    )
  } else {
    // Regex matching
    const matches = text.match(pattern.pattern)
    return matches || []
  }
}

/**
 * Split text into sentences for better matching
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/**
 * Extract the object of a requirement (what comes after the verb)
 */
function extractObject(text: string, match: string): string {
  const afterMatch = text.substring(text.indexOf(match) + match.length).trim()
  // Take first meaningful phrase
  const words = afterMatch.split(/\s+/)
  const object = words.slice(0, 5).join(' ') // Up to 5 words
  return object || 'specified functionality'
}

/**
 * Extract constraints like "< 100ms", "> 90%", etc.
 */
function extractConstraint(text: string, _match: string): string {
  const constraintPatterns = [
    /[<>=]\s*\d+(\.\d+)?\s*(ms|%|seconds?|minutes?|hours?)/i,
    /\b(at least|at most|greater than|less than|equal to)\b.*?\d+/i,
    /\b\d+(\.\d+)?\s*(ms|%|seconds?|minutes?|hours?)\b/i,
  ]

  for (const pattern of constraintPatterns) {
    const constraint = text.match(pattern)
    if (constraint) {
      return constraint[0]
    }
  }

  return ''
}

/**
 * Extract metrics like "90% coverage", "100ms response"
 */
function extractMetric(text: string, _match: string): string {
  const metricPatterns = [
    /\d+(\.\d+)?\s*%/,
    /\d+(\.\d+)?\s*(ms|seconds?|minutes?|hours?)/i,
  ]

  for (const pattern of metricPatterns) {
    const metric = text.match(pattern)
    if (metric) {
      return metric[0]
    }
  }

  return 'specified'
}

/**
 * Generate a default description when no transform is provided
 */
function generateDefaultDescription(_match: string, _pattern: RequirementPattern): string {
  return `System must provide specified functionality`
}

/**
 * Validate and filter candidates based on confidence and uniqueness
 */
export function validateCandidates(candidates: RequirementCandidate[]): RequirementCandidate[] {
  return candidates
    .filter(c => c.confidence >= 0.5) // Minimum confidence threshold
    .filter((c, index, arr) =>
      // Remove near-duplicates (simple string similarity)
      !arr.slice(0, index).some(other =>
        similarity(c.description, other.description) > 0.8
      )
    )
}

/**
 * Simple string similarity for deduplication
 */
function similarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1.0
  if (a.length === 0 || b.length === 0) return 0.0

  // Simple similarity based on common words
  const wordsA = new Set(a.toLowerCase().split(/\s+/))
  const wordsB = new Set(b.toLowerCase().split(/\s+/))
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)))
  const union = new Set([...wordsA, ...wordsB])

  return intersection.size / union.size
}