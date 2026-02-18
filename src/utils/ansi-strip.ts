/**
 * Strip ANSI escape codes from strings
 * Removes color codes and other terminal formatting
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

/**
 * Strip ANSI codes from all keys and values in an object
 */
export function stripAnsiObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = stripAnsi(value)
    } else {
      result[key] = value
    }
  }
  return result
}
