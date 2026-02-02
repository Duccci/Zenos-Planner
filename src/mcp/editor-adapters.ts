/**
 * Lightweight Editor Adapter Helpers
 *
 * Provides small utilities to produce activation commands and adapter helpers
 * for editors that don't natively support workspace-level `mcp.json`.
 */

import { join } from 'node:path'
import { existsSync, writeFileSync } from 'node:fs'
import { logger } from '../utils/logger.js'

export function getAdapterCommand(editor: 'vscode' | 'cursor' | 'windsurf', projectRoot = process.cwd()): string {
  const base = `node ${join(projectRoot, 'bin', 'mcp-server.js')}`
  if (editor === 'vscode') return base
  return `${base} --adapter ${editor}`
}

export function ensureWorkspaceMcp(projectRoot = process.cwd()): boolean {
  const vscodeDir = join(projectRoot, '.vscode')
  const target = join(vscodeDir, 'mcp.json')
  if (existsSync(target)) return false

  try {
    // Minimal config: point to the local wrapper
    const content = JSON.stringify({ servers: { zenoPlanner: { command: 'node', args: ['./bin/mcp-server.js'], env: { ZENO_PROJECT_ROOT: '${workspaceFolder}' } } } }, null, 2)
    // Ensure .vscode directory exists (best-effort)
    try { writeFileSync(target, content, { encoding: 'utf-8' }) } catch (err) { /* ignore, caller will handle */ }
    logger.info(`Wrote workspace mcp.json to ${target}`)
    return true
  } catch (err) {
    logger.warn('Failed to ensure workspace mcp.json', err)
    return false
  }
}
