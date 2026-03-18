#!/usr/bin/env node

/**
 * Wrapper entry for MCP server
 *
 * Lifecycle: The editor spawns this process via stdio. When the editor closes
 * the pipe (or crashes), stdin emits 'end'. We detect that and exit cleanly
 * so the process never lingers as an orphan — critical on Windows where
 * SIGINT/SIGTERM from a dead parent are unreliable.
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

// Resolve the Zeno installation directory (parent of bin/) so that all
// internal paths (dist/, package.json, npm build) are install-relative and
// never depend on where the user runs the command from.
const __installDir = fileURLToPath(new URL('..', import.meta.url))

// Parse command line arguments
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Zeno's Planner MCP Server

Usage:
  node bin/mcp-server.js [options]

Options:
  --help, -h    Show this help message
  --dev         Run in development mode with file watching

Description:
  Starts the Model Context Protocol (MCP) server for Zeno's Planner.
  The server provides AI-powered project management tools via MCP.

Environment Variables:
  ZENO_WORKSPACE    Path to the workspace (defaults to current directory)
  NODE_ENV          Set to 'development' to enable dev mode
  FILE_WATCH_PATTERN Pattern for files to watch in dev mode (default: src/**/*.ts)

Examples:
  node bin/mcp-server.js
  node bin/mcp-server.js --dev
`)
  process.exit(0)
}

// --- Orphan-prevention ---
// NOTE: We must NOT add 'data' listeners on stdin here. The MCP SDK's
// StdioServerTransport exclusively owns stdin for JSON-RPC message parsing.
// Adding our own 'data' listener would steal bytes from the transport,
// corrupt the protocol stream, and cause the editor to kill + respawn us
// in a tight loop — the root cause of the infinite-process bug.
//
// Instead, we rely on two safe mechanisms:
// 1. stdin 'end' event (fired when the pipe closes, safe to listen on
//    even when another consumer is reading 'data')
// 2. A parent-PID polling watchdog as a fallback for Windows edge cases
//    where 'end' never fires

process.stdin.on('end', () => {
  console.error('[mcp-server] stdin closed — parent disconnected, exiting')
  process.exit(0)
})

process.stdin.on('error', () => {
  console.error('[mcp-server] stdin error — parent disconnected, exiting')
  process.exit(0)
})

// Parent-PID watchdog: periodically check if the parent process is still alive.
// On Windows, when an editor crashes or closes, stdin 'end' may not fire for
// detached/orphaned stdio pipes. Polling the parent PID catches these cases.
const parentPid = process.ppid
if (parentPid && parentPid !== 0) {
  const parentCheckInterval = setInterval(() => {
    try {
      // signal 0 tests existence without killing
      process.kill(parentPid, 0)
    } catch {
      console.error(`[mcp-server] parent PID ${parentPid} gone — exiting`)
      clearInterval(parentCheckInterval)
      process.exit(0)
    }
  }, 30_000) // check every 30 seconds
  // Allow process to exit naturally even with the interval active
  if (parentCheckInterval.unref) parentCheckInterval.unref()
}

async function run() {
  try {
    console.error(`[mcp-server] Install dir: ${__installDir}, workspace: ${process.cwd()}`)

    // Check if dist files exist
    const distServerPath = join(__installDir, 'dist', 'mcp', 'server.js')
    if (!existsSync(distServerPath)) {
      console.error('[mcp-server] dist files not found, building...')
      await runCommand('npm', ['run', 'build'])
      console.error('[mcp-server] Build complete.')
    }

    console.error(`[mcp-server] Loading compiled server from ${distServerPath}`)

    // Import the compiled ES module
    const serverModule = await import('../dist/mcp/server.js')

    if (!serverModule.main) {
      throw new Error('Server module does not export a main function')
    }

    console.error('[mcp-server] Starting main() function...')

    // Call the main function and keep process alive
    await serverModule.main()
  } catch (err) {
    console.error('[mcp-server] Fatal error:', err)
    process.exit(1)
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: __installDir
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    child.on('error', reject)
  })
}

run()
