#!/usr/bin/env node

/**
 * Zeno CLI Binary Entry Point
 *
 * This is the executable entry point for the Zeno CLI.
 * It imports and executes the CLI from the compiled TypeScript.
 */

import { run } from '../dist/cli/index.js'

// Execute CLI
run().catch((error) => {
  // Handle missing dist/ directory gracefully
  if (error instanceof Error && (error.code === 'ERR_MODULE_NOT_FOUND' || error.message.includes('Cannot find module'))) {
    console.error('Error: Zeno CLI has not been built yet.')
    console.error('Please run: npm run build')
    process.exit(1)
  }
  console.error('Fatal error:', error)
  process.exit(1)
})
