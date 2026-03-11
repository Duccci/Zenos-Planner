/**
 * TaskDistributorIntegration
 *
 * Invokes the `task-distributor` agent via the configured AI CLI (copilot, claude, or cursor)
 * as an MCP sub-agent. Receives the proposal dependency graph, returns parallel execution sets,
 * and annotates each proposal with its `parallelSetIndex`.
 *
 * Two invocation modes (config.ai.invocationMode):
 *
 * 'cli' (default) — one-shot subprocess via execSync:
 *   copilot: copilot [--model "<model>"] --agent=task-distributor --prompt "<json>"
 *   claude:  claude  [--model "<model>"] --prompt "<json>"
 *
 * 'acp' — Agent Client Protocol over stdio (copilot only):
 *   spawn: copilot [--model "<model>"] --acp --stdio
 *   Protocol: NDJSON JSON-RPC handshake via @agentclientprotocol/sdk
 *   Ref: https://docs.github.com/en/copilot/reference/acp-server
 *
 * The `--model` flag is omitted when `config.ai.model` is not set.
 * ACP mode falls back to CLI mode when cli !== 'copilot'.
 */

import { execSync, spawn } from 'child_process'
import { Readable, Writable } from 'node:stream'
import type { SessionNotification, ClientSideConnection, NewSessionResponse } from '@agentclientprotocol/sdk'
import { loadConfig } from '../utils/config.js'
import { logger } from '../utils/logger.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProposalNode {
  hash: string
  roles?: string[]
  phase?: string
}

export interface DependencyEdge {
  from: string
  to: string
  type: string
}

export interface ParallelExecutionPlan {
  /** Ordered array of parallel sets; proposals within a set may run concurrently */
  parallelSets: string[][]
}

export interface AnnotatedProposal<T extends ProposalNode = ProposalNode> {
  proposal: T
  /** 0-indexed parallel set membership */
  parallelSetIndex: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the shell command string for the configured AI CLI.
 * Shell-safe: the JSON prompt is base64-encoded to avoid quoting issues.
 */
export function buildCliCommand(
  cli: 'copilot' | 'claude' | 'cursor',
  model: string | undefined,
  prompt: string
): string {
  const modelFlag = model ? `--model "${model}" ` : ''

  switch (cli) {
    case 'copilot':
      return `copilot ${modelFlag}--agent=task-distributor --prompt "${escapeDoubleQuotes(prompt)}"`

    case 'claude':
      return `claude ${modelFlag}--prompt "${escapeDoubleQuotes(prompt)}"`

    case 'cursor':
      return `cursor ${modelFlag}--agent task-distributor --message "${escapeDoubleQuotes(prompt)}"`
  }
}

function escapeDoubleQuotes(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Parse a raw agent response string into a ParallelExecutionPlan.
 * Strips markdown code fences the CLI may wrap around the JSON.
 * Returns null when the response is not a valid plan.
 */
function parseAgentResponse(raw: string): ParallelExecutionPlan | null {
  try {
    const jsonStr = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
    const parsed = JSON.parse(jsonStr) as unknown
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'parallelSets' in parsed &&
      Array.isArray((parsed as { parallelSets: unknown }).parallelSets)
    ) {
      return parsed as ParallelExecutionPlan
    }
    return null
  } catch {
    return null
  }
}

/**
 * Fallback: topological sort producing one proposal per parallel set in dependency order.
 * Used when the agent response is malformed or the CLI call fails.
 */
export function topologicalFallback(
  proposals: ProposalNode[],
  edges: DependencyEdge[]
): ParallelExecutionPlan {
  // Kahn's algorithm — group nodes with equal depth into the same parallel set
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const p of proposals) {
    inDegree.set(p.hash, 0)
    adj.set(p.hash, [])
  }

  for (const e of edges) {
    adj.get(e.from)?.push(e.to)
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1)
  }

  const parallelSets: string[][] = []
  let frontier = proposals.map((p) => p.hash).filter((h) => (inDegree.get(h) ?? 0) === 0)

  while (frontier.length > 0) {
    parallelSets.push([...frontier])
    const next: string[] = []
    for (const h of frontier) {
      for (const dep of adj.get(h) ?? []) {
        const deg = (inDegree.get(dep) ?? 1) - 1
        inDegree.set(dep, deg)
        if (deg === 0) next.push(dep)
      }
    }
    frontier = next
  }

  return { parallelSets }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Invoke the `task-distributor` agent via the configured AI CLI and return
 * a parallel execution plan for the given proposals and dependency edges.
 *
 * Falls back to topological sort when the agent call fails or returns invalid JSON.
 */
export async function distributeProposals(
  proposals: ProposalNode[],
  edges: DependencyEdge[],
  projectRoot: string = process.cwd()
): Promise<ParallelExecutionPlan> {
  let cli: 'copilot' | 'claude' | 'cursor' = 'copilot'
  let model: string | undefined
  let invocationMode: 'cli' | 'acp' = 'cli'

  try {
    const config = await loadConfig(projectRoot)
    cli = config.ai.cli
    model = config.ai.model
    invocationMode = config.ai.invocationMode
  } catch {
    logger.debug('Could not load config for AI CLI settings; using defaults')
  }

  const payload = JSON.stringify({
    proposals: proposals.map((p) => ({ hash: p.hash, roles: p.roles, phase: p.phase })),
    edges,
  })

  if (invocationMode === 'acp') {
    if (cli !== 'copilot') {
      logger.warn(`ACP invocation mode is only supported for 'copilot' CLI; got '${cli}'. Falling back to CLI mode.`)
    } else {
      try {
        return await distributeViaAcp(model, payload)
      } catch (err) {
        logger.warn(
          `ACP invocation failed: ${err instanceof Error ? err.message : String(err)}. Falling back to CLI mode.`
        )
      }
    }
  }

  // CLI mode (default or fallback)
  const command = buildCliCommand(cli, model, payload)
  logger.debug(`Invoking task-distributor via CLI: ${command}`)

  let rawOutput: string
  try {
    rawOutput = execSync(command, { encoding: 'utf8', timeout: 30_000 }).trim()
  } catch (err) {
    logger.warn(
      `task-distributor CLI call failed: ${err instanceof Error ? err.message : String(err)}. Falling back to topological sort.`
    )
    return topologicalFallback(proposals, edges)
  }

  return parseAgentResponse(rawOutput) ?? topologicalFallback(proposals, edges)
}

/**
 * Invoke the task-distributor agent via Copilot CLI ACP stdio mode.
 *
 * Spawns: copilot [--model <model>] --acp --stdio
 * Communicates over stdin/stdout using the Agent Client Protocol (NDJSON JSON-RPC).
 * Ref: https://docs.github.com/en/copilot/reference/acp-server
 */
async function distributeViaAcp(
  model: string | undefined,
  prompt: string
): Promise<ParallelExecutionPlan> {
  // Dynamic import — @agentclientprotocol/sdk is an optional peer dependency
  const acp = await import('@agentclientprotocol/sdk').catch(() => {
    throw new Error(
      '@agentclientprotocol/sdk is required for ACP invocation mode. Install it with: npm install @agentclientprotocol/sdk'
    )
  })

  const args = [...(model ? ['--model', model] : []), '--acp', '--stdio']
  const copilotProcess = spawn('copilot', args, { stdio: ['pipe', 'pipe', 'inherit'] })

  const output = Writable.toWeb(copilotProcess.stdin) as WritableStream<Uint8Array>
  const input = Readable.toWeb(copilotProcess.stdout) as ReadableStream<Uint8Array>
  const stream = acp.ndJsonStream(output, input)

  const chunks: string[] = []

  const client: import('@agentclientprotocol/sdk').Client = {
    requestPermission() {
      return Promise.resolve({ outcome: { outcome: 'cancelled' as const } })
    },
    sessionUpdate(params: SessionNotification): Promise<void> {
      const u = params.update
      if (u.sessionUpdate === 'agent_message_chunk') {
        const content = u.content
        if (content.type === 'text') {
          chunks.push(content.text)
        }
      }
      return Promise.resolve()
    },
  }

  const connection = new acp.ClientSideConnection((_agent: unknown) => client, stream) as unknown as ClientSideConnection

  await connection.initialize({
    protocolVersion: acp.PROTOCOL_VERSION,
    clientCapabilities: {},
  })

  const sessionResult = (await connection.newSession({ cwd: process.cwd(), mcpServers: [] })) as unknown as NewSessionResponse

  logger.debug(`ACP session started: ${sessionResult.sessionId}`)

  await connection.prompt({
    sessionId: sessionResult.sessionId,
    prompt: [{ type: 'text', text: prompt }],
  })

  // Best-effort cleanup
  copilotProcess.stdin.end()
  copilotProcess.kill('SIGTERM')
  await new Promise<void>((resolve) => {
    copilotProcess.once('exit', () => { resolve() })
    setTimeout(resolve, 2000)
  })

  const rawOutput = chunks.join('')
  logger.debug(`ACP raw response length: ${String(rawOutput.length)}`)

  const plan = parseAgentResponse(rawOutput)
  if (!plan) throw new Error('ACP response did not contain a valid parallelSets payload')
  return plan
}

/**
 * Annotate proposals with their parallel set index from the execution plan.
 */
export function annotateProposals<T extends ProposalNode>(
  proposals: T[],
  plan: ParallelExecutionPlan
): AnnotatedProposal<T>[] {
  const indexMap = new Map<string, number>()
  plan.parallelSets.forEach((set, idx) => {
    for (const hash of set) {
      indexMap.set(hash, idx)
    }
  })

  return proposals.map((p) => ({
    proposal: p,
    parallelSetIndex: indexMap.get(p.hash) ?? 0,
  }))
}
