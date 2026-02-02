#!/usr/bin/env node

/**
 * Wrapper entry for MCP server
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function run() {
  try {
    const server = await import('../dist/mcp/server.js')
    if (server && typeof server.main === 'function') {
      await server.main()
    } else if (server && typeof server.createMcpServer === 'function') {
      // Fallback: start via CLI command pattern
      await import('../dist/cli/index.js')
      // fallback to `zeno mcp server` behavior
      const { createMcpServer } = server
      const srv = await createMcpServer()
      const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js')
      const transport = new StdioServerTransport()
      await srv.connect(transport)
      // keep alive
      await new Promise(() => {})
    } else {
      console.error('Error: MCP server module not found in dist/')
      console.error('Please run: npm run build')
      process.exit(1)
    }
  } catch (err) {
    console.error('Failed to run MCP server:', err)
    process.exit(1)
  }
}

run()
