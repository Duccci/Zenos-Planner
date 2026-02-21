/**
 * Proposal Parser Helpers
 *
 * Extract objectives and requirements from gate PRD content.
 */

export function extractObjectives(content: string): string[] {
  const objectivesMatch = /## Objectives\s*\n([\s\S]*?)(?=\n##|\n---|\n$)/.exec(content)
  if (!objectivesMatch) return []

  return (objectivesMatch[1] ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.substring(2))
}

export function extractRequirements(content: string): { id: string; description: string }[] {
  const reqMatch = /## Requirements\s*\n([\s\S]*?)(?=\n##|\n---|\n$)/.exec(content)
  if (!reqMatch) return []

  return (reqMatch[1] ?? '')
    .split('\n')
    .filter((line) => line.includes('#'))
    .map((line) => {
      const hashMatch = /#([a-z0-9]{8})/.exec(line)
      return {
        id: hashMatch?.[1] ?? '',
        description: line.replace(/.*#([a-z0-9]{8})/, '').trim(),
      }
    })
    .filter((req) => req.id)
}
/**
 * Parse proposal metadata from frontmatter
 * @param content - Proposal markdown content
 * @returns Extracted metadata (hash, title, status, gate)
 */
export function parseProposalMetadata(
  content: string
): { hash?: string; title?: string; status?: string; gate?: string } {
  const result: { hash?: string; title?: string; status?: string; gate?: string } = {}

  // Extract hash: supports both `#hash` and `hash` formats
  const hashMatch = /\*\*Hash\*\*\s*:\s*#?([a-z0-9-]+)/i.exec(content)
  if (hashMatch?.[1]) {
    result.hash = hashMatch[1]
  }

  // Extract title from first heading
  const titleMatch = /^#\s+(.+)/m.exec(content)
  if (titleMatch?.[1]) {
    result.title = titleMatch[1].trim()
  }

  // Extract status
  const statusMatch = /\*\*Status\*\*\s*:\s*([a-z_]+)/i.exec(content)
  if (statusMatch?.[1]) {
    result.status = statusMatch[1]
  }

  // Extract gate
  const gateMatch = /\*\*Gate\*\*\s*:\s*(gate-\d+|solitary)/i.exec(content)
  if (gateMatch?.[1]) {
    result.gate = gateMatch[1]
  }

  return result
}