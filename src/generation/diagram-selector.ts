/**
 * Diagram Selector Service
 *
 * Coordinates the instantiation of diagram generators based on complexity analysis
 * and LLM-driven selection. Selects core diagrams for all gates and instantiates
 * conditional diagrams based on LLM selection.
 */

import type { ComplexityThresholds, DiagramType } from './diagram-types.js'
import type { DiagramGeneratorBase } from './diagram-generator-base.js'
import { DIAGRAM_CATALOGUE, getCoreTypes, isValidDiagramType } from './diagram-catalogue.js'
import { logger } from '../utils/logger.js'

// Import all core generators (always instantiated)
import { SystemOverviewGenerator } from './diagram-generators/system-overview-generator.js'
import { DataFlowGenerator } from './diagram-generators/data-flow-generator.js'
import { GateLifecycleGenerator } from './diagram-generators/gate-lifecycle-generator.js'
import { GateRoadmapGenerator } from './diagram-generators/gate-roadmap-generator.js'
import { ContextDiagramGenerator } from './diagram-generators/context-diagram-generator.js'

// Import all conditional generators (instantiated on demand)
import { SequenceDiagramGenerator } from './diagram-generators/conditional-generators.js'
import { ComponentDiagramGenerator } from './diagram-generators/conditional-generators.js'
import { PackageDiagramGenerator } from './diagram-generators/conditional-generators.js'
import { DeploymentDiagramGenerator } from './diagram-generators/conditional-generators.js'
import { NetworkDiagramGenerator } from './diagram-generators/conditional-generators.js'

/**
 * Service for selecting and instantiating diagram generators
 */
export class DiagramSelector {
  /**
   * Constructor
   * @param complexityThresholds Thresholds for complexity-based rendering backend selection
   */
  constructor(complexityThresholds: ComplexityThresholds) {
    // Thresholds are available if needed for future complexity analysis
    void complexityThresholds
  }

  /**
   * Select and instantiate all core diagram generators
   * Core diagrams are always generated regardless of complexity or selection
   *
   * @returns Array of 5 core generator instances
   */
  selectCoreDiagrams(): DiagramGeneratorBase[] {
    const generators: DiagramGeneratorBase[] = [
      new SystemOverviewGenerator(),
      new DataFlowGenerator(),
      new GateLifecycleGenerator(),
      new GateRoadmapGenerator(),
      new ContextDiagramGenerator(),
    ]

    logger.debug(
      `Selected ${String(generators.length)} core diagram generators: ${generators.map((g) => g.getType()).join(', ')}`
    )

    return generators
  }

  /**
   * Select and instantiate conditional diagram generators based on LLM selection
   * Only instantiates generators for the specified diagram types
   *
   * @param selectedTypes Array of conditional diagram types to instantiate (e.g., ['sequence', 'component'])
   * @param gateHash Gate hash for per-gate filename scoping
   * @param descriptors Optional map of diagram type -> descriptor for filename customization
   * @returns Array of conditional generator instances for selected types
   * @throws Error if an invalid diagram type is provided
   */
  selectConditionalDiagrams(
    selectedTypes: DiagramType[],
    gateHash: string,
    descriptors?: Record<DiagramType, string>
  ): DiagramGeneratorBase[] {
    // Validate all selected types
    for (const type of selectedTypes) {
      if (!isValidDiagramType(type)) {
        throw new Error(
          `Invalid diagram type: ${type}. Must be one of: ${getCoreTypes().concat(['sequence', 'component', 'package', 'deployment', 'network']).join(', ')}`
        )
      }

      const entry = DIAGRAM_CATALOGUE.find((e) => e.type === type)
      if (entry?.alwaysGenerated) {
        throw new Error(
          `Cannot select core diagram type "${type}" as conditional. Use selectCoreDiagrams() for core types.`
        )
      }
    }

    const generators: DiagramGeneratorBase[] = []

    for (const type of selectedTypes) {
      switch (type) {
        case 'sequence': {
          const gen = new SequenceDiagramGenerator()
          generators.push(gen)
          break
        }
        case 'component': {
          const gen = new ComponentDiagramGenerator()
          generators.push(gen)
          break
        }
        case 'package': {
          const gen = new PackageDiagramGenerator()
          generators.push(gen)
          break
        }
        case 'deployment': {
          const gen = new DeploymentDiagramGenerator()
          generators.push(gen)
          break
        }
        case 'network': {
          const gen = new NetworkDiagramGenerator()
          generators.push(gen)
          break
        }
        default: {
          throw new Error(`Unhandled diagram type: ${type}`)
        }
      }

      const descriptor = descriptors?.[type]
      logger.debug(`Selected conditional diagram type: ${type}${descriptor ? ` (${descriptor})` : ''}`)
    }

    logger.debug(
      `Selected ${String(generators.length)} conditional diagram generators for gate ${gateHash}`
    )

    return generators
  }

  /**
   * Select all diagrams (core + conditionals)
   * Combines selectCoreDiagrams() and selectConditionalDiagrams()
   *
   * @param selectedConditionalTypes Array of conditional diagram types to include
   * @param gateHash Gate hash for per-gate filename scoping
   * @param descriptors Optional map of diagram type -> descriptor for filename customization
   * @returns Array of all selected generator instances (core + conditional)
   */
  selectAll(
    selectedConditionalTypes: DiagramType[],
    gateHash: string,
    descriptors?: Record<DiagramType, string>
  ): DiagramGeneratorBase[] {
    const coreGenerators = this.selectCoreDiagrams()
    const conditionalGenerators = this.selectConditionalDiagrams(
      selectedConditionalTypes,
      gateHash,
      descriptors
    )

    return [...coreGenerators, ...conditionalGenerators]
  }
}
