import { ensureDir, writeFile } from '../utils/file.js'
import { shortHash } from '../utils/hash.js'
import path from 'path'

export async function decomposeToProposals(
  gateId: string,
  objectives: string[],
  requirements: { id: string; description: string }[],
  templateContent: string,
  outputDir: string
): Promise<
  {
    hash: string
    filename: string
    path: string
    type: 'gate-tied' | 'solitary'
    status: string
    summary: string
  }[]
> {
  const proposals: {
    hash: string
    filename: string
    path: string
    type: 'gate-tied' | 'solitary'
    status: string
    summary: string
  }[] = []
  let proposalIndex = 1

  for (const objective of objectives) {
    // Create proposal content from template
    let proposalContent = templateContent
      .replace(/\{\{GATE_ID\}\}/g, gateId)
      .replace(/\{\{OBJECTIVE\}\}/g, objective)
      .replace(
        /\{\{REQUIREMENTS\}\}/g,
        requirements.map((r) => `- #${r.id}: ${r.description}`).join('\n')
      )

    // Generate tasks from objective
    const tasks = generateTasksFromObjective(objective)
    proposalContent = proposalContent.replace(/\{\{TASKS\}\}/g, tasks)

    // Generate hash and filename
    const hash = shortHash(proposalContent).substring(0, 8)
    const filename = `${proposalIndex.toString().padStart(2, '0')}-${objective
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 30)}.md`
    const fullPath = path.join(outputDir, filename)

    // Ensure output directory exists
    await ensureDir(path.dirname(fullPath))

    // Write proposal file
    await writeFile(fullPath, proposalContent)

    proposals.push({
      hash,
      filename,
      path: fullPath,
      type: 'gate-tied',
      status: 'pending',
      summary: objective,
    })

    proposalIndex++
  }

  return proposals
}

export function generateTasksFromObjective(objective: string): string {
  return `- [ ] Implement ${objective.toLowerCase()}\n- [ ] Add tests for ${objective.toLowerCase()}\n- [ ] Update documentation for ${objective.toLowerCase()}`
}

export function calculateProposalDependencies(
  proposals: { hash: string; filename?: string; path?: string }[]
): { from: string; to: string; type: string }[] {
  const dependencies: { from: string; to: string; type: string }[] = []
  for (let i = 1; i < proposals.length; i++) {
    dependencies.push({
      from: proposals[i - 1].hash,
      to: proposals[i].hash,
      type: 'sequential',
    })
  }
  return dependencies
}
