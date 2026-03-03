/**
 * AGENTS.md Writer
 *
 * Writes the Zeno-managed block into the project root AGENTS.md using
 * ZENO:START / ZENO:END markers for surgical replacement.
 *
 * Ownership model:
 *   - Content OUTSIDE the markers is user-owned and never touched.
 *   - Content INSIDE the markers is Zeno-managed and replaced on every write.
 *
 * Behaviour:
 *   - Markers found   → replace only the inner block, preserve surrounding content.
 *   - No markers      → append the full fenced block to the end of the file.
 *   - File missing    → create with a minimal user shell + fenced block.
 */

import { readFile as fsReadFile } from 'fs/promises';
import { writeFile } from '../utils/file.js';
import { join } from 'path';
import { ZENO_BLOCK_START, ZENO_BLOCK_END } from './agents-generator.js';

const NEW_PROJECT_SHELL = (projectName: string): string =>
  `# ${projectName}: AI Agent Instructions\n\n> **Project-specific instructions**: Add team conventions, architecture notes, or coding standards below the Zeno block.\n\n`;

/**
 * Write the Zeno-managed block to <basePath>/AGENTS.md.
 *
 * @param innerContent - The block inner content from generateAgentsMD() (no markers).
 * @param basePath     - The project root directory.
 * @returns            - Absolute path to the written file.
 */
export async function writeAgentsMD(innerContent: string, basePath: string): Promise<string> {
  const filePath = join(basePath, 'AGENTS.md');
  const block = `${ZENO_BLOCK_START}\n\n${innerContent.trimEnd()}\n\n${ZENO_BLOCK_END}`;

  let existing: string | null = null;
  try {
    existing = await fsReadFile(filePath, 'utf-8');
  } catch {
    // File doesn't exist — create with shell + block
  }

  if (existing === null) {
    // Infer project name from the inner content "**Project**: ..." line, fall back to dir name.
    const projectMatch = /\*\*Project\*\*: (.+)/.exec(innerContent)
    const projectName = projectMatch?.[1]?.trim() ?? 'Project'
    const content = NEW_PROJECT_SHELL(projectName) + block + '\n';
    await writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  const startIdx = existing.indexOf(ZENO_BLOCK_START);
  const endIdx = existing.indexOf(ZENO_BLOCK_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace existing block (including markers)
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + ZENO_BLOCK_END.length);
    const updated = before + block + after;
    await writeFile(filePath, updated, 'utf-8');
  } else {
    // No markers — append block with a separator
    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    await writeFile(filePath, existing + separator + block + '\n', 'utf-8');
  }

  return filePath;
}