/**
 * AGENTS.md Generator
 *
 * Generates project-specific AI context documentation for LLMs assisting with implementation.
 */

import { ZenoConfig } from '../utils/config.js';
import { Gate } from '../core/types.js';
import { Requirement } from './types.js';

/**
 * Generate AGENTS.md content
 */
export function generateAgentsMD(
  projectConfig: ZenoConfig,
  gates: Gate[],
  requirements: Requirement[]
): string {
  const content = `# ${projectConfig.projectName}: AI Agent Instructions

Quick reference for AI coding assistants on how to work with ${projectConfig.projectName} projects.

## Project Goals

**Single Source of Truth**: Project scope, goals, and technical decisions are defined in \`#file:PROJECT_PRD.md\`. AGENTS.md is a guidance document for agents and does not replace the authoritative PRD.

## Technology Stack

[List the main technologies, frameworks, and languages used in this project.]

## Gate Roadmap

${gates.map(gate => `- **${gate.id}**: ${gate.name} - ${gate.description}`).join('\n')}

## Requirements

### Project-Level Requirements
${requirements.filter(r => !r.gateId).map(r => `- #${r.hash}: ${r.description}`).join('\n')}

### Gate-Specific Requirements
${requirements.filter(r => r.gateId).map(r => `- #${r.hash}: ${r.description} (Gate: ${r.gateId ?? 'unknown'})`).join('\n')}

## Quality Thresholds

- Code Coverage: ${String(projectConfig.qualityThresholds.codeCoverage)}% minimum
- Security Vulnerabilities: ${String(projectConfig.qualityThresholds.securityVulnerabilities)} allowed
- Linting Error Rate: <${String(projectConfig.qualityThresholds.lintingErrorRate)}%
- Type Checking: ${String(projectConfig.qualityThresholds.typeCheckingErrors)} TypeScript errors

## Template Functions

Available template functions for retrieving documentation templates during workflow execution:

### getTemplate(name: string): Promise<string>
Loads a single template file by name. Use this to retrieve specific templates for context during implementation.

**Available Templates**:

#### Markdown Templates (5)
- \`agents-template\` - AGENTS.md generation template for AI context guidance
- \`gate-prd-template\` - Gate PRD document template with objectives, requirements, and implementation steps
- \`project-prd-template\` - Project PRD document template for end-state definition and project scope
- \`proposal-template\` - Proposal document template for implementation work items

#### Architecture Diagram Templates (11)
- \`system-overview-template\` - Component architecture diagram showing system structure
- \`gate-roadmap-template\` - Gate progression diagram showing project roadmap and dependencies
- \`data-flow-template\` - End-to-end data flow diagram showing information movement
- \`lifecycle-template\` - State machine and lifecycle diagram for entities and processes
- \`component-diagram-template\` - Component structure diagram showing relationships
- \`context-diagram-template\` - Context and scope diagram showing system boundaries
- \`deployment-diagram-template\` - Deployment architecture diagram for infrastructure and environments
- \`network-diagram-template\` - Network topology diagram for communication patterns
- \`package-diagram-template\` - Package and module structure diagram
- \`sequence-diagram-template\` - Sequence and interaction diagram showing process flows

**Usage Examples**:
- During gate generation: \`getTemplate('gate-prd-template')\` to retrieve the gate PRD structure
- During proposal creation: \`getTemplate('proposal-template')\` for proposal format reference
- For architecture documentation: \`getTemplate('system-overview-template')\` to get system diagram template

### loadAllTemplates(): Promise<Record<string, string>>
Loads all 16 templates as a key-value map. Use this when you need to reference multiple templates or want all templates available in context.

**Usage Example**:
- When initializing multiple document types: \`loadAllTemplates()\` returns map with all available templates

### getTemplatesByCategory(category: 'markdown' | 'architecture'): Template[]
Filters templates by category. Use this to find all templates of a specific type.

**Usage Examples**:
- For document creation: \`getTemplatesByCategory('markdown')\` returns all 5 markdown templates
- For architecture work: \`getTemplatesByCategory('architecture')\` returns all 11 diagram templates

## Implementation Patterns

[Document common patterns, conventions, and best practices for this project.]

## Command Reference

[List key commands and their purposes.]

---

- **Version**: ${projectConfig.version}
**Last Updated**: ${String(new Date().toISOString().split('T')[0])}
**Status**: Active

**${projectConfig.projectName}** | [Project tagline]
`;

  return content;
}