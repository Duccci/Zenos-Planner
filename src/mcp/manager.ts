import { join } from 'node:path'
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs'
import { spawn, execSync } from 'node:child_process'
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

/**
 * Stop a running MCP server by PID.
 * Reads the PID file, sends SIGTERM (or taskkill on Windows), and removes the PID file.
 * @returns true if a server was stopped, false if none was running
 */
export function stopServer(projectRoot: string = process.cwd()): boolean {
  const pid = readPid(projectRoot)
  if (!pid) {
    logger.info('No MCP server PID file found')
    return false
  }

  if (!isProcessRunning(pid)) {
    logger.info(`MCP server PID ${String(pid)} is not running; removing stale PID file`)
    removePid(projectRoot)
    return false
  }

  try {
    if (process.platform === 'win32') {
      // On Windows, use taskkill for reliable process termination
      execSync(`taskkill /F /PID ${String(pid)}`, { stdio: 'pipe' })
    } else {
      // process.kill() is cross-platform in Node.js >=10 for non-Windows
      process.kill(pid, 'SIGTERM')
    }
    logger.info(`Sent SIGTERM to MCP server (PID ${String(pid)})`)
  } catch (err) {
    logger.warn(`Failed to stop PID ${String(pid)}`, err)
  }

  // Clean up PID file regardless
  removePid(projectRoot)
  return true
}

/**
 * Spawn the MCP server as a detached background process.
 * Resolves after a short stabilisation delay if no startup error occurs,
 * or rejects immediately if the child process emits an 'error' event.
 */
export function spawnServerBackground(projectRoot: string = process.cwd()): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [join(import.meta.dirname, '../../bin/mcp-server.js')], {
      cwd: projectRoot,
      detached: true,
      stdio: 'ignore',
    })

    child.on('error', (err) => {
      reject(err)
    })
    child.unref()

    // Give the process a moment to fail at startup before we resolve
    setTimeout(() => {
      resolve()
    }, 200)
  })
}
