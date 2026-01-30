import { Gate, SequencedGates } from './types.js';

/**
 * Sequences gates based on their dependencies, providing topological ordering
 * and identifying parallel work opportunities.
 */
export function sequenceGates(gates: Gate[]): SequencedGates {
  // Build dependency graph
  const dependencyGraph = new Map<string, string[]>();
  const incomingEdges = new Map<string, number>();

  // Initialize
  for (const gate of gates) {
    dependencyGraph.set(gate.id, gate.dependencies);
    incomingEdges.set(gate.id, gate.dependencies.length);
  }

  // Topological sort using Kahn's algorithm
  const queue: string[] = [];
  const sequencedIds: string[] = [];

  // Start with gates that have no dependencies
  for (const [id, count] of incomingEdges) {
    if (count === 0) {
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    sequencedIds.push(currentId);

    // For each gate that depends on current
    for (const gate of gates) {
      if (gate.dependencies.includes(currentId)) {
        const currentIncoming = (incomingEdges.get(gate.id) ?? 0) - 1;
        incomingEdges.set(gate.id, currentIncoming);
        if (currentIncoming === 0) {
          queue.push(gate.id);
        }
      }
    }
  }

  // Check for cycles
  if (sequencedIds.length !== gates.length) {
    throw new Error('Circular dependency detected in gates');
  }

  // Group into parallel groups
  const parallelGroups: Gate[][] = [];
  const processed = new Set<string>();

  for (const id of sequencedIds) {
    if (processed.has(id)) continue;

    const group: Gate[] = [];
    const toProcess = [id];

    while (toProcess.length > 0) {
      const currentId = toProcess.shift()!;
      if (processed.has(currentId)) continue;

      const gate = gates.find(g => g.id === currentId);
      if (!gate) continue;
      group.push(gate);
      processed.add(currentId);

      // Add gates that can be parallel (no dependencies between them)
      for (const otherId of sequencedIds) {
        if (!processed.has(otherId)) {
          const otherGate = gates.find(g => g.id === otherId);
          if (!otherGate) continue;
          const hasDependency = otherGate.dependencies.some(dep => group.some(g => g.id === dep));
          const isDependedOn = group.some(g => g.dependencies.includes(otherId));
          if (!hasDependency && !isDependedOn) {
            toProcess.push(otherId);
          }
        }
      }
    }

    parallelGroups.push(group);
  }

  return {
    gates: sequencedIds.map(id => gates.find(g => g.id === id)).filter((g): g is Gate => g !== undefined),
    dependencyGraph,
    parallelGroups
  };
}