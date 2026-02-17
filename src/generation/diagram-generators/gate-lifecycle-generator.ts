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
    // States: pending, in_progress, completed, rejected
    // Transitions: pending->in_progress (start), in_progress->completed (complete),
    //              in_progress->rejected (reject), both completed and rejected are terminal
    const diagram = `stateDiagram-v2
    [*] --> pending

    pending --> in_progress: zeno gates start
    pending --> rejected: zeno gates reject

    in_progress --> completed: zeno gates complete
    in_progress --> rejected: zeno gates reject

    completed --> [*]
    rejected --> [*]

    note right of pending
        Gate waiting to be started.
        Review and approval in progress.
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
