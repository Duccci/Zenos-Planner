/**
 * Diagram Type Catalogue
 *
 * Provides a runtime-discoverable catalogue of all available diagram types
 * with metadata for LLM-driven selection and generation.
 */

import type { DiagramType, DiagramCategory } from './diagram-types.js'

/**
 * Catalogue entry for a diagram type with metadata and selection guidance
 */
export interface CatalogueEntry {
  type: DiagramType
  category: DiagramCategory
  name: string
  description: string
  whenUseful: string
  templatePath: string
  alwaysGenerated: boolean
}

/**
 * Complete catalogue of all 10 diagram types
 * Core diagrams (5) are always generated; conditional diagrams (5) are LLM-selected
 */
export const DIAGRAM_CATALOGUE: CatalogueEntry[] = [
  // ============================================================================
  // CORE DIAGRAMS (Always Generated)
  // ============================================================================

  {
    type: 'system-overview',
    category: 'core',
    name: 'System Overview',
    description:
      'High-level component architecture showing how major system parts relate and communicate.',
    whenUseful:
      'Always generated. Shows the overall system structure and primary architectural boundaries.',
    templatePath: 'templates/architecture-templates/system-overview-template.md',
    alwaysGenerated: true,
  },

  {
    type: 'data-flow',
    category: 'core',
    name: 'Data Flow Diagram',
    description: 'End-to-end data processing paths showing how information moves through the system.',
    whenUseful:
      'Always generated. Essential for understanding data transformation and movement across components.',
    templatePath: 'templates/architecture-templates/data-flow-template.md',
    alwaysGenerated: true,
  },

  {
    type: 'gate-lifecycle',
    category: 'core',
    name: 'Gate Lifecycle State Machine',
    description: 'State machine diagram showing gate transitions (pending, in_progress, completed).',
    whenUseful:
      'Always generated. Defines the workflow for managing gate progression through the project.',
    templatePath: 'templates/architecture-templates/gate-lifecycle-template.md',
    alwaysGenerated: true,
  },

  {
    type: 'gate-roadmap',
    category: 'core',
    name: 'Gate Roadmap',
    description:
      'Hierarchical roadmap showing gate sequence and parallel dependencies across the project.',
    whenUseful:
      'Always generated. Shows the decomposition and sequencing of gates throughout the project.',
    templatePath: 'templates/architecture-templates/gate-roadmap-template.md',
    alwaysGenerated: true,
  },

  {
    type: 'context',
    category: 'core',
    name: 'System Context Diagram',
    description:
      'System boundary diagram showing the system under design and its relationships with external entities.',
    whenUseful:
      'Always generated. Defines what is in scope and external dependencies and actors.',
    templatePath: 'templates/architecture-templates/context-template.md',
    alwaysGenerated: true,
  },

  // ============================================================================
  // CONDITIONAL DIAGRAMS (LLM-Selected)
  // ============================================================================

  {
    type: 'sequence',
    category: 'conditional',
    name: 'Sequence Diagram',
    description: 'Temporal interactions and message flows between components for specific use cases.',
    whenUseful:
      'Select when the API design, user workflows, or complex interactions need detailed temporal sequencing.',
    templatePath: 'templates/architecture-templates/sequence-template.md',
    alwaysGenerated: false,
  },

  {
    type: 'component',
    category: 'conditional',
    name: 'Component Diagram',
    description:
      'Detailed module structure breaking down major components into internal structure and dependencies.',
    whenUseful:
      'Select when you need to show internal component decomposition or complex module relationships.',
    templatePath: 'templates/architecture-templates/component-template.md',
    alwaysGenerated: false,
  },

  {
    type: 'package',
    category: 'conditional',
    name: 'Package Diagram',
    description: 'Code organization showing packages, namespaces, and module dependencies.',
    whenUseful:
      'Select when codebases have complex package structures or when module organization is critical.',
    templatePath: 'templates/architecture-templates/package-template.md',
    alwaysGenerated: false,
  },

  {
    type: 'deployment',
    category: 'conditional',
    name: 'Deployment Diagram',
    description: 'Runtime infrastructure showing servers, containers, and how components are deployed.',
    whenUseful:
      'Select when infrastructure, containerization, or deployment topology is a significant architectural concern.',
    templatePath: 'templates/architecture-templates/deployment-template.md',
    alwaysGenerated: false,
  },

  {
    type: 'network',
    category: 'conditional',
    name: 'Network Diagram',
    description: 'Network topology showing communication patterns, protocols, and network topology.',
    whenUseful:
      'Select when network communication, protocols, or distributed system topology needs detailed documentation.',
    templatePath: 'templates/architecture-templates/network-template.md',
    alwaysGenerated: false,
  },
]

/**
 * Get the complete diagram catalogue
 */
export function getCatalogue(): CatalogueEntry[] {
  return DIAGRAM_CATALOGUE
}

/**
 * Get catalogue entries filtered by category
 */
export function getCatalogueByCategory(category: DiagramCategory): CatalogueEntry[] {
  return DIAGRAM_CATALOGUE.filter((entry) => entry.category === category)
}

/**
 * Get a single catalogue entry by type
 */
export function getCatalogueEntry(type: DiagramType): CatalogueEntry | undefined {
  return DIAGRAM_CATALOGUE.find((entry) => entry.type === type)
}

/**
 * Get all core diagram types
 */
export function getCoreTypes(): DiagramType[] {
  return getCatalogueByCategory('core').map((entry) => entry.type)
}

/**
 * Get all conditional diagram types
 */
export function getConditionalTypes(): DiagramType[] {
  return getCatalogueByCategory('conditional').map((entry) => entry.type)
}

/**
 * Validate that a diagram type exists in the catalogue
 */
export function isValidDiagramType(type: DiagramType): boolean {
  return DIAGRAM_CATALOGUE.some((entry) => entry.type === type)
}
