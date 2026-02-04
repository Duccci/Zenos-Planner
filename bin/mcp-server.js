#!/usr/bin/env node

/**
 * Wrapper entry for MCP server
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'

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

async function run() {
  try {
    // Check if dist files exist
    const distServerPath = join(process.cwd(), 'dist', 'mcp', 'server.js')
    if (!existsSync(distServerPath)) {
      console.log('Building MCP server...')
      await runCommand('npm', ['run', 'build'])
      console.log('Build complete.')
    }

    // Import the compiled ES module
    const serverModule = await import('../dist/mcp/server.js')
    // The main function runs automatically when the module is loaded directly
    // but we can also call it explicitly if needed
    if (serverModule.main) {
      await serverModule.main()
    }
    // If no explicit main export, the module will run its own main when loaded
  } catch (err) {
    console.error('Failed to run MCP server:', err)
    process.exit(1)
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: process.cwd()
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
