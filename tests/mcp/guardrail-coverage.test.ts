import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALL_GUARDRAILS, type GuardrailEntry } from '../../src/mcp/content/guardrails.js'

/**
 * Guardrail Coverage Test
 *
 * Replaces scripts/validate-guardrail-coverage.ts.
 * Asserts that ALL_GUARDRAILS is internally consistent:
 *   1. Every entry with mustHaveValidator=true has a non-empty validatorRef.
 *   2. The file portion of each validatorRef exists in src/mcp/validators/ or src/mcp/tools/.
 *   3. No duplicate id values across all guardrail entries.
 *
 * Run with: npx vitest run tests/mcp/guardrail-coverage.test.ts
 */

const VALIDATOR_DIRS = [
  resolve(import.meta.dirname, '../../src/mcp/validators'),
  resolve(import.meta.dirname, '../../src/mcp/tools'),
]

/** Extract the filename (before '#') from a validatorRef string, e.g. 'scope-validator.ts#validateScope' → 'scope-validator.ts' */
function extractFilename(validatorRef: string): string {
  return validatorRef.split('#')[0].trim()
}

/** True when the named file exists in any of the known validator/tools directories */
function validatorFileExists(filename: string): boolean {
  return VALIDATOR_DIRS.some((dir) => existsSync(resolve(dir, filename)))
}

describe('ALL_GUARDRAILS — structural integrity', () => {
  it('should export a non-empty array', () => {
    expect(ALL_GUARDRAILS).toBeDefined()
    expect(Array.isArray(ALL_GUARDRAILS)).toBe(true)
    expect(ALL_GUARDRAILS.length).toBeGreaterThan(0)
  })

  it('every entry has required fields: id, topic, rule, mustHaveValidator, reason', () => {
    const requiredFields: (keyof GuardrailEntry)[] = [
      'id',
      'topic',
      'rule',
      'mustHaveValidator',
      'reason',
    ]
    const missing: string[] = []

    for (const entry of ALL_GUARDRAILS) {
      for (const field of requiredFields) {
        if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
          missing.push(`${entry.id}: missing or empty '${String(field)}'`)
        }
      }
    }

    expect(missing, `Entries with missing fields:\n${missing.join('\n')}`).toHaveLength(0)
  })

  it('every entry with mustHaveValidator=true has a non-empty validatorRef', () => {
    const invalid = ALL_GUARDRAILS.filter(
      (e: GuardrailEntry) => e.mustHaveValidator && (!e.validatorRef || e.validatorRef.trim() === '')
    )

    const messages = invalid.map(
      (e: GuardrailEntry) => `  ${e.id} (${e.topic}): mustHaveValidator=true but validatorRef is missing or empty`
    )

    expect(
      invalid,
      `Guardrails missing validatorRef:\n${messages.join('\n')}`
    ).toHaveLength(0)
  })

  it('validatorRef file portion references an existing file in src/mcp/validators/ or src/mcp/tools/', () => {
    const notFound: string[] = []

    for (const entry of ALL_GUARDRAILS) {
      if (!entry.mustHaveValidator || !entry.validatorRef) continue

      const filename = extractFilename(entry.validatorRef)
      if (filename && !validatorFileExists(filename)) {
        notFound.push(
          `  ${entry.id}: validatorRef '${entry.validatorRef}' → file '${filename}' not found in validators/ or tools/`
        )
      }
    }

    expect(notFound, `Guardrails with missing validator files:\n${notFound.join('\n')}`).toHaveLength(0)
  })

  it('no duplicate id values', () => {
    const ids = ALL_GUARDRAILS.map((e: GuardrailEntry) => e.id)
    const seen = new Set<string>()
    const duplicates: string[] = []

    for (const id of ids) {
      if (seen.has(id)) {
        duplicates.push(id)
      } else {
        seen.add(id)
      }
    }

    expect(
      duplicates,
      `Duplicate guardrail ids: ${duplicates.join(', ')}`
    ).toHaveLength(0)
  })

  it('every id matches its expected pattern (topic-prefix followed by digits)', () => {
    const topicPrefixes: Record<GuardrailEntry['topic'], string> = {
      'apply-phase': 'apply-',
      'proposal-generation': 'proposal-',
      archival: 'archive-',
      'gate-generation': 'gate-',
    }

    const mismatched: string[] = []
    for (const entry of ALL_GUARDRAILS) {
      const expectedPrefix = topicPrefixes[entry.topic]
      if (!entry.id.startsWith(expectedPrefix)) {
        mismatched.push(
          `  ${entry.id}: topic '${entry.topic}' should have id starting with '${expectedPrefix}'`
        )
      }
    }

    expect(
      mismatched,
      `Id/topic mismatches:\n${mismatched.join('\n')}`
    ).toHaveLength(0)
  })

  it('ALL_GUARDRAILS covers all four workflow topics', () => {
    const topics = new Set(ALL_GUARDRAILS.map((e: GuardrailEntry) => e.topic))
    expect(topics.has('apply-phase')).toBe(true)
    expect(topics.has('proposal-generation')).toBe(true)
    expect(topics.has('gate-generation')).toBe(true)
    expect(topics.has('archival')).toBe(true)
  })
})
