/**
 * TERMINOLOGY.md Writer
 *
 * Seeds <basePath>/TERMINOLOGY.md from terminology-template.md, substituting
 * the project name placeholder.
 *
 * Behaviour:
 *   - File missing → create from template.
 *   - File exists  → skip (user-owned, never overwritten without force).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFile, fileExists } from '../utils/file.js'

const __installDir = fileURLToPath(new URL('../..', import.meta.url))

/**
 * Write a seed TERMINOLOGY.md to <basePath>/TERMINOLOGY.md.
 *
 * @param projectName - Project name substituted for `[Project Name]` in the template.
 * @param basePath    - Directory to write TERMINOLOGY.md into.
 * @param force       - Overwrite even if the file already exists.
 * @returns           - Absolute path to the written file, or null if skipped.
 */
export async function writeTerminologyMD(
  projectName: string,
  basePath: string,
  force = false
): Promise<string | null> {
  const filePath = join(basePath, 'TERMINOLOGY.md')

  if (fileExists(filePath) && !force) {
    return null
  }

  const templatePath = join(__installDir, 'templates', 'md-templates', 'terminology-template.md')
  let content: string

  try {
    content = readFileSync(templatePath, 'utf-8')
  } catch (err) {
    throw new Error(
      `terminology-writer: failed to read template at "${templatePath}": ${String(err)}`,
      { cause: err }
    )
  }

  content = content.replace(/\[Project Name\]/g, projectName)

  await writeFile(filePath, content, 'utf-8')
  return filePath
}
