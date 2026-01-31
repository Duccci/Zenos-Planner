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

## Project Overview

- **Name**: ${projectConfig.projectName}
- **Version**: ${projectConfig.version}
- **Description**: [Add project description here]

## Technology Stack

[List the main technologies, frameworks, and languages used in this project.]

## Gate Roadmap

${gates.map(gate => `- **${gate.id}**: ${gate.name} - ${gate.description}`).join('\n')}

## Requirements

### Project-Level Requirements
${requirements.filter(r => r.level === 'project').map(r => `- #${r.hash}: ${r.description}`).join('\n')}

### Gate-Specific Requirements
${requirements.filter(r => r.level === 'gate').map(r => `- #${r.hash}: ${r.description} (Gate: ${r.gateId ?? 'unknown'})`).join('\n')}

## Quality Thresholds

- Code Coverage: ${String(projectConfig.qualityThresholds.codeCoverage)}% minimum
- Security Vulnerabilities: ${String(projectConfig.qualityThresholds.securityVulnerabilities)} allowed
- Linting Error Rate: <${String(projectConfig.qualityThresholds.lintingErrorRate)}%
- Type Checking: ${String(projectConfig.qualityThresholds.typeCheckingErrors)} TypeScript errors

## Implementation Patterns

[Document common patterns, conventions, and best practices for this project.]

## Command Reference

[List key commands and their purposes.]

---

**Document Version**: ${projectConfig.version}  
**Last Updated**: ${String(new Date().toISOString().split('T')[0])}  
**Status**: Active

**${projectConfig.projectName}** | [Project tagline]
`;

  return content;
}