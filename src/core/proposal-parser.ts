/**
 * Proposal Parser Helpers
 *
 * Extract objectives and requirements from gate PRD content.
 */

export function extractObjectives(content: string): string[] {
  const objectivesMatch = content.match(/## Objectives\s*\n([\s\S]*?)(?=\n##|\n---|\n$)/)
  if (!objectivesMatch) return []

  return objectivesMatch[1]!
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.substring(2))
}

export function extractRequirements(content: string): Array<{ id: string; description: string }> {
  const reqMatch = content.match(/## Requirements\s*\n([\s\S]*?)(?=\n##|\n---|\n$)/)
  if (!reqMatch) return []

  return reqMatch[1]!
    .split('\n')
    .filter(line => line.includes('#'))
    .map(line => {
      const hashMatch = line.match(/#([a-z0-9]{8})/)
      return {
        id: hashMatch ? hashMatch[1]! : '',
        description: line.replace(/.*#([a-z0-9]{8})/, '').trim()
      }
    })
    .filter(req => req.id)
}
