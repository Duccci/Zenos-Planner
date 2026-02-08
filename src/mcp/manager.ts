import { join } from 'node:path'
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { getZenoDir } from '../utils/config.js'
import { logger } from '../utils/logger.js'

const PID_FILE = 'mcp.pid'

export function getPidPath(projectRoot: string = process.cwd()): string {
  return join(getZenoDir(projectRoot), PID_FILE)
}

export function writePid(projectRoot: string = process.cwd()): void {
  try {
    const path = getPidPath(projectRoot)
    writeFileSync(path, String(process.pid), { encoding: 'utf-8' })
    logger.debug(`Wrote MCP PID file to ${path}`)
  } catch (err) {
    logger.warn('Failed to write MCP PID file', err)
  }
}

export function removePid(projectRoot: string = process.cwd()): void {
  try {
    const path = getPidPath(projectRoot)
    if (existsSync(path)) unlinkSync(path)
    logger.debug(`Removed MCP PID file ${path}`)
  } catch (err) {
    logger.warn('Failed to remove MCP PID file', err)
  }
}

export function readPid(projectRoot: string = process.cwd()): number | null {
  try {
    const path = getPidPath(projectRoot)
    if (!existsSync(path)) return null
    const content = readFileSync(path, { encoding: 'utf-8' }).trim()
    const pid = parseInt(content, 10)
    return Number.isFinite(pid) ? pid : null
  } catch {
    return null
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    // signal 0 does not kill the process, just tests for its existence
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function isServerRunning(projectRoot: string = process.cwd()): boolean {
  const pid = readPid(projectRoot)
  if (!pid) return false
  return isProcessRunning(pid)
}

export function spawnServerBackground(projectRoot: string = process.cwd()): Promise<void> {
  return new Promise((resolve, reject) => {
    // Spawn `node bin/zeno.js mcp server` in the project root as a detached process
    const node = process.execPath
    const script = 'bin/zeno.js'
    const args = ['mcp', 'server']

    const child = spawn(node, [script, ...args], {
      cwd: projectRoot,
      detached: true,
      stdio: 'ignore',
    })

    child.on('error', (err) => {
      logger.error('Failed to spawn MCP server:', err)
      reject(err)
    })

    // Detach and let it run independently
    child.unref()

    // Give the process a short moment to create PID file and start
    setTimeout(() => {
      resolve()
    }, 200)
  })
}
