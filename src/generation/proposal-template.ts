/**
 * Proposal Template Rendering
 *
 * Loads and renders proposal templates with proposal-specific data.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

export interface Task {
  title: string
  files: string
  action: string
  description: string
  acceptance: string[]
}

export interface FileAffected {
  file: string
  action: string
  description: string
}

export interface ProposalData {
  title: string
  hash: string
  gateId: string
  gateName: string
  requirement?: string
  status: string
  created: string
  summary: string
  context: {
    whyChange: string
    dependencies: {
      hash: string
      type: string
      description: string
    }[]
  }
  tasks: Task[]
  filesAffected: FileAffected[]
  implementationNotes: string
  rollback: string
}

/**
 * Load template from file
 */
export function loadProposalTemplate(): string {
  const templatePath = join(__dirname, '../../templates/md-templates/proposal-template.md')
  return readFileSync(templatePath, 'utf-8')
}

/**
 * Render template with data
 */
export function renderProposalTemplate(template: string, data: ProposalData): string {
  let rendered = template

  rendered = rendered.replace(/\[Proposal Title\]/g, data.title)
  rendered = rendered.replace(/#\[Generated SHA-256 first 16 chars\]/g, `#${data.hash}`)
  rendered = rendered.replace(/\[Gate ID\] - \[Gate Name\]/g, `${data.gateId} - ${data.gateName}`)
  rendered = rendered.replace(
    /#\[Requirement Hash\]/g,
    data.requirement ? `#${data.requirement}` : '#[Requirement Hash]'
  )
  rendered = rendered.replace(/pending \| validated \| in_progress \| completed \| rejected/g, data.status)
  rendered = rendered.replace(/\[DATE\]/g, data.created)
  rendered = rendered.replace(/\[2-3 sentence description...\]/g, data.summary)
  rendered = rendered.replace(/\[1-2 sentences explaining...\]/g, data.context.whyChange)

  // Dependencies table
  const depRows = data.context.dependencies
    .map((dep) => `| #${dep.hash} | ${dep.type} | ${dep.description} |`)
    .join('\n')
  rendered = rendered.replace(/\| #\[hash\] \| requires \| \[What this proposal...\] \|/g, depRows)

  // Tasks
  let tasksSection = ''
  data.tasks.forEach((task, index) => {
    tasksSection += `### Task ${String(index + 1)}: ${task.title}\n\n**File(s)**: \`${task.files}\`  \n**Action**: ${task.action}\n\n${task.description}\n\n**Acceptance**:\n${task.acceptance.map((acc) => `- [ ] ${acc}`).join('\n')}\n\n---\n\n`
  })
  rendered = rendered.replace(
    /### Task 1: \[Task Title\]\n\n\*\*File\(s\)\*\*: `\[path\/to\/file\.ts\]` {2}\n\*\*Action\*\*: create \| modify \| delete \| refactor\n\n\[2-4 line description...\]\n\n\*\*Acceptance\*\*:\n- \[ \] \[Specific, verifiable condition\]\n- \[ \] \[Another verifiable condition\]\n\n---\n\n### Task 2: \[Task Title\]\n\n\*\*File\(s\)\*\*: `\[path\/to\/file\.ts\]` {2}\n\*\*Action\*\*: create \| modify \| delete \| refactor\n\n\[2-4 line description\.\]\n\n\*\*Acceptance\*\*:\n- \[ \] \[Condition\]\n- \[ \] \[Condition\]\n\n---\n\n### Task 3: \[Task Title\]\n\n\*\*File\(s\)\*\*: `\[path\/to\/file\.test\.ts\]` {2}\n\*\*Action\*\*: create \| modify\n\n\[Test task - every proposal...\]\n\n\*\*Acceptance\*\*:\n- \[ \] Tests cover happy path\n- \[ \] Tests cover error cases\n- \[ \] Coverage meets 90% threshold for touched files\n\n---\n\n/g,
    tasksSection
  )

  // Files Affected table - replace the example rows with actual data
  const filesRows = data.filesAffected
    .map((file) => `| \`${file.file}\` | ${file.action} | ${file.description} |`)
    .join('\n')
  // Match the two example table data rows using a simple pattern
  // Look for lines starting with | ` and replace both example rows
  rendered = rendered.replace(
    /\| `src\/\[path\]\/\[file\]\.ts`[^\n]*\n\| `tests\/\[path\]\/\[file\]\.test\.ts`[^\n]*/,
    filesRows
  )

  rendered = rendered.replace(/\[Optional: Technical approach...\]/g, data.implementationNotes)
  rendered = rendered.replace(/\[If rejected or failed\]: \[Brief description...\]/g, data.rollback)

  // Version info
  rendered = rendered.replace(/\[MAJOR\.MINOR\.PATCH\]/g, '1.0.0')
  const today = new Date().toISOString().split('T')[0] ?? ''
  rendered = rendered.replace('[YYYY-MM-DD]', today)

  return rendered
}
