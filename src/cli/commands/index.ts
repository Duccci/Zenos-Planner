/**
 * CLI Command Registration
 *
 * Central registration point for all CLI commands and categories.
 */

import type { Command } from 'commander'
import { registerGatesCommands } from './gates.js'
import { registerReqCommands } from './req.js'
import { registerArchCommands } from './arch.js'
import { registerReposCommands } from './repos.js'
import { registerProposalCommands } from './proposal.js'
import { registerInitCommand } from './init.js'
import { registerStatusCommand } from './status.js'
import { registerShowCommand } from './show.js'
import { registerTemplateCommand } from './template.js'
import { registerConfigCommand } from './config.js'
import { registerMcpCommands } from './mcp.js'
import { registerTraceCommand } from './trace.js'
import { registerDbCommands } from './db.js'
import { registerRegistryCommands } from './registry.js'
import { registerWorktreeCommands } from './worktree.js'
import { registerDoctorCommand } from './doctor.js'
import { registerRefreshCommand } from './refresh.js'
import { registerSyncCommand } from './sync.js'

/**
 * Register all commands with the CLI program
 */
export function registerCommands(program: Command): void {
  // Register top-level commands
  registerInitCommand(program)
  registerStatusCommand(program)
  registerShowCommand(program)
  registerTemplateCommand(program)
  registerConfigCommand(program)
  registerTraceCommand(program)
  registerDoctorCommand(program)
  registerRefreshCommand(program)
  registerSyncCommand(program)

  // Register command categories
  registerGatesCommands(program)
  registerReqCommands(program)
  registerArchCommands(program)
  registerReposCommands(program)
  registerProposalCommands(program)
  registerMcpCommands(program)
  registerDbCommands(program)
  registerRegistryCommands(program)
  registerWorktreeCommands(program)
}
