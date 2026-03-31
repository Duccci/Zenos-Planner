/**
 * Gate PRD Writer
 *
 * Writes rendered gate PRDs to the zeno/gates/ directory.
 */

import path from 'path'
import { writeFile } from '../utils/file.js'
import { getZenoGitDir } from '../utils/config.js'

export async function writeGatePRD(
  gatePRD: string,
  gateNumber: number,
  gateName: string,
  projectRoot: string = process.cwd()
): Promise<string> {
  const fileName = `gate-${gateNumber.toString().padStart(2, '0')}-${gateName.replace(/\s+/g, '-').toLowerCase()}.md`
  const filePath = path.join(getZenoGitDir(projectRoot), 'gates', fileName)

  await writeFile(filePath, gatePRD, 'utf-8');

  return filePath;
}
