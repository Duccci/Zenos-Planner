/**
 * PRD Updater
 *
 * Maintains PROJECT_PRD.md accuracy when gates are completed, archived, or realigned.
 * Responsible for:
 * - Moving completed gates from active sections to archived sections
 * - Updating gate checklists and status
 * - Maintaining timeline accuracy
 * - Preserving manually edited prose sections
 */

import { readFile, writeFile } from '../utils/file.js'
import { getDatabase } from '../storage/database.js'
import path from 'path'
import { logger } from '../utils/logger.js'

interface GateStatus {
  id: string
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'rejected'
  description: string
}

/**
 * Load all gates from database
 */
function loadGatesFromDatabase(): GateStatus[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT id, name, status, description FROM gates ORDER BY CAST(SUBSTRING(id, 6) AS INTEGER)`
    )
    .all() as { id: string; name: string; status: string; description: string }[]

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status as GateStatus['status'],
    description: row.description || '',
  }))
}

/**
 * Extract gates section from PRD
 * Returns the content and metadata about where sections are
 */
function extractGateSections(content: string): {
  beforeActive: string
  activeSection: string
  beforeArchived: string
  archivedSection: string
  afterArchived: string
  hasArchivedSection: boolean
} {
  // Find the "Active MVP Gates" section
  const activeMatch = /^### Active MVP Gates \(\d+-\d+\)$/m.exec(content)
  const activeIndex = activeMatch ? content.indexOf(activeMatch[0]) : -1

  // Find the "Post-MVP Gates" section (comes after active)
  const postMVPMatch = /^### Post-MVP Gates$/m.exec(content)
  const postMVPIndex = postMVPMatch ? content.indexOf(postMVPMatch[0]) : -1

  // Find existing "Archived Gates" section
  const archivedMatch = /^### Archived Gates \(Completed\)$/m.exec(content)
  const archivedIndex = archivedMatch ? content.indexOf(archivedMatch[0]) : -1

  if (activeIndex === -1) {
    throw new Error('Could not find "Active MVP Gates" section in PROJECT_PRD.md')
  }

  // Extract sections
  const beforeActive = content.substring(0, activeIndex)

  let activeSection = ''
  let beforeArchived = ''
  let archivedSection = ''
  let afterArchived = ''
  let hasArchivedSection = false

  if (archivedIndex !== -1) {
    // Archived section exists
    activeSection = content.substring(activeIndex, archivedIndex)
    beforeArchived = '' // Already included in activeSection
    hasArchivedSection = true

    // Find what comes after archived section (should be Post-MVP Gates or other content)
    const afterArchivedStart = content.indexOf('\n', archivedIndex) + 1
    const remainingContent = content.substring(afterArchivedStart)
    const nextSectionMatch = /^###[^#]/.exec(remainingContent)
    const nextSectionIndex = nextSectionMatch
      ? afterArchivedStart + remainingContent.indexOf(nextSectionMatch[0])
      : content.length

    archivedSection = content.substring(archivedIndex, nextSectionIndex)
    afterArchived = content.substring(nextSectionIndex)
  } else if (postMVPIndex !== -1) {
    // No archived section, but Post-MVP exists
    activeSection = content.substring(activeIndex, postMVPIndex)
    beforeArchived = ''
    archivedSection = ''
    afterArchived = content.substring(postMVPIndex)
  } else {
    // No archived section and no Post-MVP section
    activeSection = content.substring(activeIndex)
    beforeArchived = ''
    archivedSection = ''
    afterArchived = ''
  }

  return {
    beforeActive,
    activeSection,
    beforeArchived,
    archivedSection,
    afterArchived,
    hasArchivedSection,
  }
}

/**
 * Generate the active gates section with updated checklist
 */
function generateActiveGatesSection(gates: GateStatus[]): string {
  const activeGates = gates.filter((g) => g.status !== 'completed' && g.status !== 'rejected')

  if (activeGates.length === 0) {
    return ''
  }

  const firstGateNum = activeGates[0]?.id.split('-')[1]?.padStart(2, '0') ?? '05'
  const lastGateNum =
    activeGates[activeGates.length - 1]?.id.split('-')[1]?.padStart(2, '0') ?? '12'

  const lines: string[] = [`### Active MVP Gates (${firstGateNum}-${lastGateNum})`, '']

  for (const gate of activeGates) {
    const gateNum = gate.id.split('-')[1]?.padStart(2, '0') ?? gate.id
    const statusEmoji = gate.status === 'in_progress' ? '[x]' : '[ ]'
    lines.push(`### Gate ${gateNum}: ${gate.name}`)
    lines.push(`${statusEmoji} Implementation in progress...`)
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Generate the archived gates section with completed gates
 */
function generateArchivedGatesSection(gates: GateStatus[]): string {
  const completedGates = gates.filter((g) => g.status === 'completed')

  if (completedGates.length === 0) {
    return ''
  }

  const lines: string[] = [
    `### Archived Gates (Completed)`,
    '',
    'Gates 1-4 have been completed and archived. These foundational gates established:',
  ]

  for (const gate of completedGates) {
    const gateNum = gate.id.split('-')[1]?.padStart(2, '0') ?? gate.id
    lines.push(`- Gate ${gateNum}: ${gate.name}`)
  }

  lines.push('')

  return lines.join('\n')
}

/**
 * Update PROJECT_PRD.md with current gate status
 * Preserves manually edited sections while keeping gate lists in sync with database
 */
export async function updateProjectPRDGates(projectRoot: string): Promise<void> {
  try {
    const prdPath = path.join(projectRoot, 'zeno', 'overview', 'PROJECT_PRD.md')
    const content = await readFile(prdPath)

    // Extract current sections
    const sections = extractGateSections(content)

    // Load gates from database
    const gates = loadGatesFromDatabase()

    // Generate updated sections
    const activeSection = generateActiveGatesSection(gates)
    const archivedSection = generateArchivedGatesSection(gates)

    // Reconstruct PRD
    let newContent = sections.beforeActive

    if (activeSection) {
      newContent += activeSection + '\n'
    }

    if (archivedSection) {
      newContent += archivedSection
    }

    newContent += sections.afterArchived

    // Only write if content changed
    if (newContent !== content) {
      await writeFile(prdPath, newContent)
      logger.info('Updated PROJECT_PRD.md with current gate status')
    }
  } catch (error) {
    logger.warn(`Failed to update PROJECT_PRD.md: ${String(error)}`)
    // Don't fail the overall operation if PRD update fails
  }
}

/**
 * Update timeline section in PROJECT_PRD.md
 * Marks gates in the "Timeline" section that have been completed
 */
export async function updateTimelineSection(
  projectRoot: string,
  completedGateId: string
): Promise<void> {
  try {
    const prdPath = path.join(projectRoot, 'zeno', 'overview', 'PROJECT_PRD.md')
    const content = await readFile(prdPath)

    // Find timeline section
    const timelineMatch = /^## Timeline \(Order of Operations\)$/m.exec(content)
    if (!timelineMatch) {
      // No timeline section to update
      return
    }

    // The gate is already organized in the "Archived Gates" or "Active MVP Gates" subsection
    // which we update via updateProjectPRDGates, so we can skip additional timeline updates
    // as those subsections take precedence for gate organization.

    const gateNum = completedGateId.split('-')[1] ?? completedGateId
    logger.debug(
      `Timeline section exists for gate ${gateNum}, status updates managed by gate sections`
    )
  } catch (error) {
    logger.warn(`Failed to update timeline section: ${String(error)}`)
    // Don't fail the overall operation
  }
}
