/**
 * Zeno Normalization Utilities
 *
 * Provides canonical normalization of gate IDs and hashes.
 * These are centralized implementations used across CLI, core, and integration modules.
 */

/**
 * Normalize a gate ID to the canonical format "gate-XX".
 * Handles various input formats: numeric (1 → gate-01), gate-1 → gate-01, gate-01 → gate-01.
 * @param input - Gate ID in any format
 * @returns Normalized gate ID in format "gate-XX"
 */
export function normalizeGateId(input: string): string {
  const regex = /(\d+)/
  const match = regex.exec(input)
  if (match?.[1]) {
    const num = parseInt(match[1], 10)
    return `gate-${num.toString().padStart(2, '0')}`
  }
  return input
}

/**
 * Normalize a hash reference by removing leading '#' if present.
 * @param input - Hash with or without '#' prefix
 * @returns Hash without '#' prefix
 */
export function normalizeHash(input: string): string {
  const trimmed = input.trim()
  return trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
}
