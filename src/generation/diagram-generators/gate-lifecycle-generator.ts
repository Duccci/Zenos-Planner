/**
 * Gate Lifecycle Diagram Generator
 *
 * Generates a state machine diagram showing gate status transitions:
 * pending → in_progress → completed with rejected as alternative terminal state.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { DiagramGeneratorBase } from '../diagram-generator-base.js'
import type { DiagramType, DiagramCategory } from '../diagram-types.js'

export class GateLifecycleGenerator extends DiagramGeneratorBase {
  getType(): DiagramType {
    return 'gate-lifecycle'
  }

  getCategory(): DiagramCategory {
    return 'core'
  }

  /**
   * Generate a state machine diagram showing gate status transitions.
   * States and transitions mirror the authoritative MCP workflow contract in mcp-workflows.md.
   */
  generateContent(_context: DiagramContext): string {
    // Generate Mermaid state diagram for gate lifecycle.
    // Must match the authoritative MCP workflow contract in mcp-workflows.md:
    // validate is required before start; cancel/defer are available at every state.
    // Terminal states: completed, cancelled.
    const diagram = `stateDiagram-v2
    [*] --> pending

    pending --> validated: zeno gates validate
    pending --> cancelled: zeno gates cancel
    pending --> backlog: zeno gates defer

    validated --> in_progress: zeno gates start
    validated --> cancelled: zeno gates cancel
    validated --> backlog: zeno gates defer

    in_progress --> completed: zeno gates complete
    in_progress --> cancelled: zeno gates cancel
    in_progress --> backlog: zeno gates defer

    completed --> [*]
    cancelled --> [*]

    note right of pending
        Gate waiting to be validated.
        Validate is required before start.
    end note

    note right of validated
        All structural/quality checks passed.
        Ready to start work.
    end note

    note right of in_progress
        Gate work is active.
        Proposals are being implemented.
    end note

    note right of completed
        All proposals approved and merged.
        Git tag created, archived.
    end note

    note right of cancelled
        Gate was cancelled or deferred to
        backlog. Preserved for reference.
    end note`

    return diagram
  }

  /**
   * Lifecycle diagram has 6 states and 9 transitions (matching mcp-workflows.md contract).
   */
  protected override countNodes(_context: DiagramContext): number {
    return 6 // pending, validated, in_progress, completed, cancelled, backlog
  }

  protected override countEdges(): number {
    return 9 // All valid transitions per MCP workflow contract
  }

  protected override countNestingDepth(_context: DiagramContext): number {
    return 1 // State machines are flat
  }
}

export default GateLifecycleGenerator
