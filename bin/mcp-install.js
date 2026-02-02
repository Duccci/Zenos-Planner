#!/usr/bin/env node

/**
 * Wrapper to perform `zeno mcp install` via the CLI
 */

import { spawn } from 'node:child_process'

const node = process.execPath
const script = 'bin/zeno.js'
const args = ['mcp', 'install', ...process.argv.slice(2)]

const child = spawn(node, [script, ...args], { stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 0))
