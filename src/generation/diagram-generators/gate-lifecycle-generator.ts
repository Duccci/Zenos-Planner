/**
 * Gate Lifecycle Diagram Generator
 *
 * Generates a state machine diagram showing gate status transitions:
 * pending → in_progress → completed with rejected as alternative terminal state.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { DiagramGeneratorBase } from '../diagram-generator-base.js'
import type { DiagramType, DiagramCategory } from '../diagram-types.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export class GateLifecycleGenerator extends DiagramGeneratorBase {
  getType(): DiagramType {
    return 'gate-lifecycle'
  }

  getCategory(): DiagramCategory {
    return 'core'
  }

  /**
   * Generate a state machine diagram showing gate status transitions.
   * Template provides structure; content is populated from project metadata.
   */
  generateContent(_context: DiagramContext): string {
    // Load template for structural guidance
    const templatePath = join(
      process.cwd(),
      'templates/architecture-templates/lifecycle-template.md'
    )
    try {
      readFileSync(templatePath, 'utf-8')
    } catch {
      // Template file not found; proceed with default generation
    }

    // Generate Mermaid state diagram for gate lifecycle
    // States: backlog, pending, validated, in_progress, completed, rejected, cancelled
    // Transitions: pending→validated (validate), validated→in_progress (start),
    //              in_progress→completed (complete), in_progress/pending/validated→rejected (reject),
    //              pending→backlog, pending/backlog→cancelled
    const diagram = `stateDiagram-v2
    [*] --> backlog

    backlog --> pending: triage / prioritise
    pending --> validated: zeno gates validate
    pending --> cancelled: zeno gates cancel

    validated --> in_progress: zeno gates start
    validated --> rejected: zeno gates reject

    in_progress --> completed: zeno gates complete
    in_progress --> rejected: zeno gates reject

    completed --> [*]
    rejected --> [*]
    cancelled --> [*]

    note right of backlog
        Gate queued for future work.
        Not yet scheduled.
    end note

    note right of pending
        Gate waiting to be validated.
        Review and approval in progress.
    end note

    note right of validated
        Gate has passed validation checks.
        Ready to be started.
    end note

    note right of in_progress
        Gate work is active.
        Proposals are being implemented.
    end note

    note right of completed
        All proposals approved and merged.
        Git tag created, archived.
    end note

    note right of rejected
        Gate rejected due to failed checks
        or human decision. Preserved for rework.
    end note

    note right of cancelled
        Gate cancelled — scope removed or
        superseded. No further action required.
    end note`

    return diagram
  }

  /**
   * Lifecycle diagram always has 4 nodes (states) and 4 transitions.
   */
  protected override countNodes(_context: DiagramContext): number {
    return 4 // pending, in_progress, completed, rejected
  }

  protected override countEdges(): number {
    return 4 // Transitions between states
  }

  protected override countNestingDepth(_context: DiagramContext): number {
    return 1 // State machines are flat
  }
}

export default GateLifecycleGenerator
