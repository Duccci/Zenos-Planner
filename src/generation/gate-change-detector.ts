/**
 * Gate Structure Change Detection
 *
 * Detects structural changes in gate lists and triggers architecture review
 * when gates are added, removed, reordered, or rescoped.
 */

/**
 * Metadata about a gate for change detection
 */
export interface GateMetadata {
  id: string;
  hash: string;
  name: string;
  sequence: number;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  type: 'feature' | 'quality' | 'rescope';
}

/**
 * Represents a change event detected in gate structure
 */
export interface GateChangeEvent {
  type: 'gate_added' | 'gate_removed' | 'gate_reordered' | 'gate_rescoped';
  gateHash: string;
  gateName: string;
  details: string;
}

/**
 * Detects structural changes in gate lists
 */
export class GateChangeDetector {
  /**
   * Compare previous and current gate lists to detect changes
   *
   * @param previousGates List of gates from the previous state
   * @param currentGates List of gates from the current state
   * @returns Array of detected change events
   */
  detectChanges(previousGates: GateMetadata[], currentGates: GateMetadata[]): GateChangeEvent[] {
    const events: GateChangeEvent[] = [];

    // Build maps for efficient lookup
    const prevMap = new Map(previousGates.map((g) => [g.hash, g]));
    const currMap = new Map(currentGates.map((g) => [g.hash, g]));

    // Detect removals and rescopes
    for (const prevGate of previousGates) {
      if (!currMap.has(prevGate.hash)) {
        // Gate was removed
        events.push({
          type: 'gate_removed',
          gateHash: prevGate.hash,
          gateName: prevGate.name,
          details: `Gate "${prevGate.name}" (${prevGate.id}) was removed from the project.`,
        });
      } else {
        // Gate still exists - check if rescoped (type changed)
        const currGate = currMap.get(prevGate.hash);
        if (!currGate) continue;
        if (prevGate.type !== currGate.type) {
          events.push({
            type: 'gate_rescoped',
            gateHash: currGate.hash,
            gateName: currGate.name,
            details: `Gate "${currGate.name}" (${currGate.id}) was rescoped: type changed from "${prevGate.type}" to "${currGate.type}".`,
          });
        }
      }
    }

    // Detect additions
    for (const currGate of currentGates) {
      if (!prevMap.has(currGate.hash)) {
        // Gate was added
        events.push({
          type: 'gate_added',
          gateHash: currGate.hash,
          gateName: currGate.name,
          details: `New gate "${currGate.name}" (${currGate.id}) was added to the project.`,
        });
      }
    }

    // Detect reorderings
    // Map previous and current gate sequences by hash to compare order
    const prevSequence = previousGates.map((g) => g.hash);
    const currSequence = currentGates.map((g) => g.hash);

    if (JSON.stringify(prevSequence) !== JSON.stringify(currSequence)) {
      // Sequence changed - report for gates that exist in both lists
      for (const currGate of currentGates) {
        if (prevMap.has(currGate.hash)) {
          const prevGate = prevMap.get(currGate.hash);
          if (!prevGate) continue;
          if (prevGate.sequence !== currGate.sequence) {
            events.push({
              type: 'gate_reordered',
              gateHash: currGate.hash,
              gateName: currGate.name,
              details: `Gate "${currGate.name}" (${currGate.id}) was moved: sequence changed from ${String(prevGate.sequence)} to ${String(currGate.sequence)}.`,
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Determine if change events warrant an architecture review
   *
   * Returns true if any structural change warrants updating architecture diagrams.
   * All change types (added, removed, reordered, rescoped) trigger reviews.
   *
   * @param events Array of change events to evaluate
   * @returns true if architecture review should be triggered
   */
  shouldTriggerArchReview(events: GateChangeEvent[]): boolean {
    // All event types warrant architecture review since they affect gate structure
    return events.length > 0;
  }
}
