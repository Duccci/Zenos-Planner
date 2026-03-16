/**
 * Zeno Normalization Utilities
 *
 * Provides canonical normalization of gate IDs and hashes.
 * These are centralized implementations used across CLI, core, and integration modules.
 */

import { getDatabase } from '../storage/database.js'

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

/**
 * Resolve a gate reference (hash or textual ID) to a canonical gate ID.
 *
 * MCP tools use gate hashes as the primary identifier. This function resolves
 * them to the internal gate ID (e.g. "gate-01") that the rest of the system uses.
 *
 * Resolution order:
 *   1. If the input matches `gate-XX` or is purely numeric → normalizeGateId (fast path).
 *   2. Otherwise treat as a hash: strip leading '#', query DB `WHERE hash = ?`.
 *   3. If the DB lookup finds nothing, return the normalised input as-is (best-effort).
 *
 * @param input - Gate hash (e.g. "a3f9c2d1...") or gate ID (e.g. "gate-01")
 * @returns Canonical gate ID (e.g. "gate-01")
 */
export function resolveGateIdentifier(input: string): string {
  const trimmed = input.trim()
  // Fast path: already a textual gate ID
  if (/^gate-\d+$/i.test(trimmed) || /^\d+$/.test(trimmed)) {
    return normalizeGateId(trimmed)
  }
  // Hash path: strip '#' prefix and look up in DB
  const hash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
  try {
    const db = getDatabase()
    const row = db
      .prepare('SELECT id FROM gates WHERE hash = ?')
      .get(hash) as { id: string } | undefined
    if (row?.id) return row.id
  } catch {
    // DB unavailable — fall through to best-effort below
  }
  // Best-effort: try normalising as a gate ID (handles "01" style inputs)
  return normalizeGateId(trimmed)
}
