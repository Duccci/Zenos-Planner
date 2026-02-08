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
