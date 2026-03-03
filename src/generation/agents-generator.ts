/**
 * AGENTS.md Generator
 *
 * Generates the Zeno-managed block content for the project root AGENTS.md.
 * The block is delimited by ZENO:START / ZENO:END markers so the writer can
 * do a surgical replacement without touching user-owned content above or below.
 *
 * Context loading is intentionally minimal — gates, requirements, quality
 * thresholds, and diagrams are fetched on-demand via MCP tools.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ZenoConfig } from '../utils/config.js';

export const ZENO_BLOCK_START = '<!-- ZENO:START — Managed by Zeno\'s Planner. Do not edit this block manually. -->';
export const ZENO_BLOCK_END = '<!-- ZENO:END -->';

/**
 * Generate the inner content of the ZENO-managed block in AGENTS.md.
 *
 * Returns only the content between the markers (markers are added by the writer).
 * Parsed from `templates/md-templates/agents-template.md` — do not duplicate inline.
 */
export function generateAgentsMD(projectConfig: ZenoConfig): string {
  const today = new Date().toISOString().split('T')[0];

  const templatePath = join(process.cwd(), 'templates', 'md-templates', 'agents-template.md');
  let innerBlock: string;

  try {
    const raw = readFileSync(templatePath, 'utf-8');
    // Extract content between ZENO:START and ZENO:END markers (exclusive)
    const startMarker = ZENO_BLOCK_START;
    const endMarker = ZENO_BLOCK_END;
    const startIdx = raw.indexOf(startMarker);
    const endIdx = raw.indexOf(endMarker);
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      innerBlock = raw.slice(startIdx + startMarker.length, endIdx).replace(/^\n/, '').replace(/\n$/, '');
    } else {
      throw new Error('ZENO block markers not found in agents-template.md');
    }
  } catch (err) {
    throw new Error(
      `agents-generator: failed to read template at "${templatePath}": ${String(err)}`
    );
  }

  return `${innerBlock}\n\n**Project**: ${projectConfig.projectName}\n**Last Updated**: ${String(today)}\n`;
}