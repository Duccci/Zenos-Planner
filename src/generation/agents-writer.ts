/**
 * AGENTS.md Writer
 *
 * Writes generated AGENTS.md to the zeno/ directory, merging with existing content.
 */

import { readFile as fsReadFile } from 'fs/promises';
import { writeFile } from '../utils/file.js';
import { join } from 'path';

export async function writeAgentsMD(content: string, basePath: string): Promise<string> {
  const filePath = join(basePath, 'zeno', 'AGENTS.md');

  // For now, just write the content. In future, merge with existing.
  // To merge: read existing, append new sections if not present.

  try {
    const existing = await fsReadFile(filePath, 'utf-8');
    // Simple merge: if existing has content, append new content at the end
    const merged = existing + '\n\n---\n\n' + content;
    await writeFile(filePath, merged, 'utf-8');
  } catch {
    // File doesn't exist, write new
    await writeFile(filePath, content, 'utf-8');
  }

  return filePath;
}