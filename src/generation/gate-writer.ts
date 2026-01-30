/**
 * Gate PRD Writer
 *
 * Writes rendered gate PRDs to the zeno/gates/ directory.
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function writeGatePRD(
  gatePRD: string,
  gateNumber: number,
  gateName: string
): Promise<string> {
  const fileName = `gate-${gateNumber.toString().padStart(2, '0')}-${gateName.replace(/\s+/g, '-').toLowerCase()}.md`;
  const filePath = join('zeno', 'gates', fileName);

  await writeFile(filePath, gatePRD, 'utf-8');

  return filePath;
}