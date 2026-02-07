import { logger } from '../../utils/logger.js'

/** Audit log entry for a git operation detection event */
export interface GitAuditEntry {
  timestamp: string
  command: string
  args: string[]
  operations: string[]
  allowed: boolean
  phase: string
}

/** In-memory audit log — can be retrieved for compliance checks */
const auditLog: GitAuditEntry[] = []

/**
 * Track and optionally block git operations in a given command invocation.
 *
 * @param command - The executable or first token of the command string
 * @param args - Arguments passed to the command
 * @param allowed - Whether git operations are permitted in the current phase.
 *   When `false`, throws an error with code `GIT_VIOLATION` if git ops detected.
 * @returns `{ hasGitOps, operations }` summarising detected git subcommands
 */
export function trackGitOperations(
  command: string,
  args: string[] = [],
  allowed = true
): { hasGitOps: boolean; operations: string[] } {
  const joined = [command, ...args].join(' ')
  const operations: string[] = []

  // Detect common git invocations
  if (/\bgit\b/.test(command) || args.some(a => /\bgit\b/.test(a))) {
    const sub = args[0] || ''
    if (/^(add|commit|tag|push|pull|fetch|merge)$/.test(sub)) {
      operations.push(`git ${sub}`)
    } else {
      operations.push('git')
    }
  }

  // Also detect concatenated strings that include git subcommand patterns
  if (/\b(git\s+add|git\s+commit|git\s+tag|git\s+push|git\s+pull)\b/.test(joined)) {
    const m = joined.match(/\b(git\s+add|git\s+commit|git\s+tag|git\s+push|git\s+pull)\b/g)
    if (m) {
      for (const op of m) {
        if (!operations.includes(op)) operations.push(op)
      }
    }
  }

  const hasGitOps = operations.length > 0
  const phase = (globalThis as any).__ZENOPROPOSAL_APPLY_PHASE ? 'apply' : 'normal'

  // Record audit entry regardless of whether ops were found
  if (hasGitOps) {
    const entry: GitAuditEntry = {
      timestamp: new Date().toISOString(),
      command,
      args,
      operations,
      allowed,
      phase
    }
    auditLog.push(entry)

    logger.warn(`[git-audit] Detected git operations: ${operations.join(', ')} — allowed=${allowed}, phase=${phase}`)

    if (!allowed) {
      const err = new Error('GIT_VIOLATION: Git operations are not allowed in this phase')
      ;(err as any).code = 'GIT_VIOLATION'
      ;(err as any).operations = operations
      throw err
    }
  }

  return { hasGitOps, operations }
}

/** Retrieve the full audit log (read-only snapshot) */
export function getGitAuditLog(): readonly GitAuditEntry[] {
  return [...auditLog]
}

/** Clear the audit log (useful in tests) */
export function clearGitAuditLog(): void {
  auditLog.length = 0
}

export default trackGitOperations
