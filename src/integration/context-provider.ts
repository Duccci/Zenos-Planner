/**
 * Project Context Provider
 *
 * Provides AI agents with current project state and workflow context
 * to enable informed decision-making during Zeno operations.
 */

import { invokeCommand } from './command-invoker.js'
import { logger } from '../utils/logger.js'

export interface ProjectStatus {
  initialized: boolean
  gates: GateSummary[]
  currentGate?: string
  pendingProposals: number
  inProgressProposals: number
  completedGates: number
  totalGates: number
}

export interface GateSummary {
  id: string
  status: 'pending' | 'in_progress' | 'completed'
  description: string
  requirements: number
  proposals: number
}

export interface WorkflowContext {
  nextActions: string[]
  blockedItems: string[]
  recommendations: string[]
  projectHealth: 'good' | 'warning' | 'critical'
}

export interface ProjectContext {
  status: ProjectStatus
  workflow: WorkflowContext
  lastUpdated: Date
}

/**
 * Get comprehensive project context for AI decision making
 */
export async function getProjectContext(): Promise<ProjectContext> {
  try {
    logger.debug('Getting project context')

    // Get project status
    const statusResult = await invokeCommand('status')
    const status = parseStatusOutput(statusResult.output)

    // Get gates list
    const gatesResult = await invokeCommand('gates_list')
    const gates = parseGatesOutput(gatesResult.output)

    // Get proposals summary
    const proposalsResult = await invokeCommand('proposal_list')
    const proposals = parseProposalsOutput(proposalsResult.output)

    // Build comprehensive status
    const projectStatus: ProjectStatus = {
      initialized: status.initialized,
      gates: gates,
      currentGate: findCurrentGate(gates),
      pendingProposals: proposals.filter(p => p.status === 'pending').length,
      inProgressProposals: proposals.filter(p => p.status === 'in_progress').length,
      completedGates: gates.filter(g => g.status === 'completed').length,
      totalGates: gates.length
    }

    // Generate workflow context
    const workflow = generateWorkflowContext(projectStatus)

    return {
      status: projectStatus,
      workflow,
      lastUpdated: new Date()
    }
  } catch (error) {
    logger.error(`Failed to get project context: ${String(error)}`)
    // Return minimal context on error
    return {
      status: {
        initialized: false,
        gates: [],
        pendingProposals: 0,
        inProgressProposals: 0,
        completedGates: 0,
        totalGates: 0
      },
      workflow: {
        nextActions: ['Initialize project with zeno init'],
        blockedItems: [],
        recommendations: ['Check Zeno installation and project setup'],
        projectHealth: 'critical'
      },
      lastUpdated: new Date()
    }
  }
}

/**
 * Parse status command output
 */
function parseStatusOutput(output: string): { initialized: boolean } {
  // Simple parsing - in real implementation, would parse structured output
  const initialized = output.includes('initialized') || output.includes('gates')
  return { initialized }
}

/**
 * Parse gates list output
 */
function parseGatesOutput(output: string): GateSummary[] {
  // Parse gate list - simplified implementation
  const lines = output.split('\n').filter(line => line.trim())
  const gates: GateSummary[] = []

  for (const line of lines) {
    const regex = /^(gate-\d+):\s*(\w+)\s*-\s*(.+)$/
    const match = regex.exec(line)
    if (match && match[1] && match[2] && match[3]) {
      gates.push({
        id: match[1],
        status: match[2] as 'pending' | 'in_progress' | 'completed',
        description: match[3],
        requirements: 0, // Would need to query per gate
        proposals: 0    // Would need to query per gate
      })
    }
  }

  return gates
}

/**
 * Parse proposals list output
 */
function parseProposalsOutput(output: string): { hash: string; status: string }[] {
  // Parse proposal list - simplified
  const lines = output.split('\n').filter(line => line.trim())
  const proposals: { hash: string; status: string }[] = []

  for (const line of lines) {
    const regex = /^(\S+):\s*(\w+)/
    const match = regex.exec(line)
    if (match && match[1] && match[2]) {
      proposals.push({
        hash: match[1],
        status: match[2]
      })
    }
  }

  return proposals
}

/**
 * Find the current active gate
 */
function findCurrentGate(gates: GateSummary[]): string | undefined {
  // Return the first in_progress gate, or first pending if none in progress
  const inProgress = gates.find(g => g.status === 'in_progress')
  if (inProgress) return inProgress.id

  const pending = gates.find(g => g.status === 'pending')
  return pending?.id
}

/**
 * Generate workflow context and recommendations
 */
function generateWorkflowContext(
  status: ProjectStatus
): WorkflowContext {
  const nextActions: string[] = []
  const blockedItems: string[] = []
  const recommendations: string[] = []

  if (!status.initialized) {
    nextActions.push('Run zeno init to initialize the project')
    recommendations.push('Start with project initialization before other operations')
    return {
      nextActions,
      blockedItems,
      recommendations,
      projectHealth: 'critical'
    }
  }

  // Check for pending proposals
  if (status.pendingProposals > 0) {
    nextActions.push(`Start implementation of ${String(status.pendingProposals)} pending proposal(s)`)
    recommendations.push('Focus on completing pending proposals to progress gates')
  }

  // Check for in-progress work
  if (status.inProgressProposals > 0) {
    nextActions.push(`Continue work on ${String(status.inProgressProposals)} in-progress proposal(s)`)
    recommendations.push('Complete in-progress proposals before starting new work')
  }

  // Check gate progress
  if (status.currentGate) {
    nextActions.push(`Focus on gate ${status.currentGate}`)
    recommendations.push(`Complete all proposals for gate ${status.currentGate} to unlock next gate`)
  }

  // Check for completed gates
  if (status.completedGates === status.totalGates && status.totalGates > 0) {
    nextActions.push('All gates completed - project ready for final review')
    recommendations.push('Consider project completion and deployment')
  }

  // Determine project health
  let health: 'good' | 'warning' | 'critical' = 'good'
  if (blockedItems.length > 0) {
    health = 'critical'
  } else if (status.pendingProposals > 5 || status.inProgressProposals > 3) {
    health = 'warning'
  }

  return {
    nextActions,
    blockedItems,
    recommendations,
    projectHealth: health
  }
}

/**
 * Get suggestions for next actions based on current context
 */
export async function getNextActionSuggestions(): Promise<string[]> {
  const context = await getProjectContext()
  return context.workflow.nextActions
}

/**
 * Check if a specific action is currently recommended
 */
export async function isActionRecommended(action: string): Promise<boolean> {
  const context = await getProjectContext()
  return context.workflow.recommendations.some(rec =>
    rec.toLowerCase().includes(action.toLowerCase())
  )
}