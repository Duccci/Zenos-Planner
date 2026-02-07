import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * Find proposal file by hash under zeno/proposals (gate dirs or solitary)
 */
export async function findProposalByHash(hash: string, projectRoot = process.cwd()): Promise<string | null> {
  const proposalsDir = join(projectRoot, 'zeno', 'proposals')

  // Check gate-based directories and solitary
  try {
    const entries = await readdir(proposalsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const candidate = join(proposalsDir, entry.name, `${hash}.md`)
        if (existsSync(candidate)) return candidate
      }
    }

    const solitary = join(proposalsDir, 'solitary', `${hash}.md`)
    if (existsSync(solitary)) return solitary
  } catch {
    // Directory may not exist
  }

  return null
}
