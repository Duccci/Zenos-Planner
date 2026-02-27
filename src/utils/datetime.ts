/**
 * Datetime Normalization Utilities
 *
 * Converts SQLite and human-entered date strings to ISO 8601 format
 * expected by TimestampSchema (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?$/).
 */

/**
 * Normalize a datetime string (from SQLite storage or markdown front-matter) to ISO 8601.
 *
 * Handles:
 *   "2026-02-10 07:41:05"  → "2026-02-10T07:41:05Z"   (SQLite CURRENT_TIMESTAMP)
 *   "2026-02-13"           → "2026-02-13T00:00:00Z"   (date-only from templates)
 *   "2026-02-10T07:41:05Z" → "2026-02-10T07:41:05Z"   (already valid, passthrough)
 *
 * @param value   - Raw datetime string, or null/undefined
 * @param fallback - ISO 8601 fallback; defaults to current time
 */
export function normalizeDateTime(value: string | null | undefined, fallback?: string): string {
  const v = value ?? fallback ?? new Date().toISOString()
  // Already valid ISO 8601 with T separator
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) return v
  // SQLite space-separated datetime: "YYYY-MM-DD HH:MM:SS"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(v)) return v.replace(' ', 'T') + 'Z'
  // Date-only: "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v + 'T00:00:00Z'
  // Last resort: try JS Date parsing
  const d = new Date(v)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

/**
 * Return the current moment as ISO 8601 string.
 * Convenience alias to make call-sites self-documenting.
 */
export function nowISO(): string {
  return new Date().toISOString()
}
