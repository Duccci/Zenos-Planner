/**
 * Memory Sync Utility
 *
 * Refreshes the Gate Roadmap section of .serena/memories/project_overview.md
 * by parsing project.json. This keeps agent-session context current
 * without touching PROJECT_PRD.md (design rationale, not state).
 *
 * Trigger points:
 *   - zeno init         (seed initial state)
 *   - gates complete    (record completed gate + new current)
 *   - zeno rescope      (future: rewrite scope sections)
 */

import path from 'path'
import { readProjectOverview, getCompletedGates, getUpcomingGates } from './config.js'
import { fileExists, readFile, writeFile } from './file.js'
import { logger } from './logger.js'
import type { Project } from './config.js'

const MEMORY_PATH_SEGMENTS = ['.serena', 'memories', 'project_overview.md']

/** Section header in the memory file that this utility owns */
const ROADMAP_HEADING = '## Gate Roadmap'

/**
 * Generate the Gate Roadmap markdown section from a Project.
 */
function buildRoadmapSection(overview: Project): string {
  const total = overview.project.totalGatesPlanned
  const completed = getCompletedGates(overview)
  const completedCount = completed.length
  const currentGate = overview.gates.find((g) => g.status === 'in_progress')
  const upcoming = getUpcomingGates(overview)

  const completedLines =
    completedCount > 0
      ? completed
          .map((g) => `- **${g.name}** *(completed ${g.completedAt ?? 'N/A'})*`)
          .join('\n')
      : '_None yet_'

  const currentLine = currentGate
    ? `- **${currentGate.name}** ← *${currentGate.status}*`
    : '_None_'

  const upcomingLines =
    upcoming.length > 0
      ? upcoming.map((g) => `- ${g.name}`).join('\n')
      : '_None_'

  return [
    `## Gate Roadmap (auto-updated from project.json)`,
    ``,
    `### Completed (${String(completedCount)}/${String(total)})`,
    completedLines,
    ``,
    `### Current`,
    currentLine,
    ``,
    `### Upcoming`,
    upcomingLines,
  ].join('\n')
}

/**
 * Refreshes the Gate Roadmap section of .serena/memories/project_overview.md
 * by parsing project.json.
 *
 * - If the memory file does not exist, this is a no-op (graceful skip).
 * - Only the `## Gate Roadmap` section is replaced; all other content is preserved.
 * - Called after `gates complete` and `zeno init` to keep agent context current.
 *
 * @param projectRoot - Absolute path to the project root (contains .serena/ and zeno/)
 */
export async function syncMemoryFromProjectOverview(projectRoot: string): Promise<void> {
  const memoryPath = path.join(projectRoot, ...MEMORY_PATH_SEGMENTS)

  if (!fileExists(memoryPath)) {
    logger.debug('memory-sync: project_overview.md not found, skipping')
    return
  }

  let overview: Project
  try {
    overview = await readProjectOverview(projectRoot)
  } catch (error) {
    logger.debug(`memory-sync: could not read project.json — ${String(error)}`)
    return
  }

  let content: string
  try {
    content = await readFile(memoryPath)
  } catch (error) {
    logger.debug(`memory-sync: could not read memory file — ${String(error)}`)
    return
  }

  const newSection = buildRoadmapSection(overview)

  // Replace the Gate Roadmap section (from heading to the next ## heading or EOF).
  // The (?=\n## ) lookahead preserves the following heading; \s*$ catches trailing
  // whitespace at EOF so we don't accumulate blank lines.
  const sectionPattern = new RegExp(`${ROADMAP_HEADING}[\\s\\S]*?(?=\\n## |\\s*$)`)

  if (!sectionPattern.test(content)) {
    // Section not present — append it at end of file
    const updated = content.trimEnd() + '\n\n' + newSection + '\n'
    await writeFile(memoryPath, updated)
    logger.debug('memory-sync: appended Gate Roadmap section to project_overview.md')
    return
  }

  const updated = content.replace(sectionPattern, newSection)

  if (updated === content) {
    logger.debug('memory-sync: Gate Roadmap already up to date')
    return
  }

  await writeFile(memoryPath, updated)
  logger.debug('memory-sync: refreshed Gate Roadmap in .serena/memories/project_overview.md')
}
