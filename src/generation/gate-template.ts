/**
 * Gate Template Rendering
 *
 * Loads and renders gate PRD templates with gate-specific data.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DIAGRAM_CATALOGUE } from './diagram-catalogue.js';

// Install-relative __dirname so templates are found regardless of the user's CWD.
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export interface DiagramEntry {
  name: string;
  type: string;
  order: number;
  status: 'pending' | 'generated';
}

export interface GateData {
  gateNumber: number;
  gateName: string;
  status: string;
  type: string;
  created: string;
  sequence: string;
  hash: string;
  overview: string;
  objectives: string[];
  context: {
    completedBefore: string[];
    enables: string[];
    inScope: string[];
    outOfScope: string[];
  };
  projectRequirements: {
    hash: string;
    name: string;
    type: string;
    priority: string;
    howAddressed: string;
  }[];
  diagrams?: DiagramEntry[];
}

/**
 * Load template from file
 */
export function loadTemplate(templateName: string): string {
  const templatePath = join(__dirname, '../../templates/md-templates', `${templateName}.md`);
  return readFileSync(templatePath, 'utf-8');
}

/**
 * Generate diagram entries for a gate PRD
 *
 * Always includes the five core diagram entries with sequential order numbers.
 * Leaves conditional diagram slots for LLM selection.
 */
export function generateDiagramEntries(): DiagramEntry[] {
  const entries: DiagramEntry[] = [];
  let order = 1;

  // Add all core diagrams with sequential order numbers
  for (const catalogEntry of DIAGRAM_CATALOGUE) {
    if (catalogEntry.alwaysGenerated) {
      entries.push({
        name: catalogEntry.name,
        type: catalogEntry.type,
        order: order++,
        status: 'pending'
      });
    }
  }

  // Add placeholder rows for conditional diagrams
  // Leave these empty with a comment for LLM selection
  for (let i = 0; i < 2; i++) {
    entries.push({
      name: '[Conditional Diagram - Reserved]',
      type: '[diagram-type]',
      order: order++,
      status: 'pending'
    });
  }

  return entries;
}

/**
 * Render template with data
 */
export function renderGateTemplate(template: string, data: GateData): string {
  let rendered = template;

  // Ensure diagrams are populated if not provided
  const diagramEntries = data.diagrams ?? generateDiagramEntries();

  // Basic variable substitution
  rendered = rendered.replace(/\[XX\]/g, data.gateNumber.toString());
  rendered = rendered.replace(/\[Gate Name\]/g, data.gateName);
  rendered = rendered.replace(/\[feature \| quality \| rescope\]/g, data.type);
  rendered = rendered.replace(/\[YYYY-MM-DD\]/g, data.created);
  rendered = rendered.replace(/\[X of Y\]/g, data.sequence);
  rendered = rendered.replace(/#\[hash\]/g, `#${data.hash}`);
  rendered = rendered.replace(/\[2-3 sentences describing what this gate accomplishes and how it moves the project closer to the end state\. Focus on concrete deliverables\.\]/g, data.overview);

  // Objectives
  const objectivesStr = data.objectives.map(obj => `- [ ] ${obj}`).join('\n');
  rendered = rendered.replace(/\[List 3-5 specific...\]\n\n- \[ \] \[Objective...\]/g, objectivesStr);

  // Context sections
  const completedBefore = data.context.completedBefore.map(item => `- ${item}`).join('\n');
  rendered = rendered.replace(/\[Summarize previous...\]\n\n- \[Previous capability...\]/g, completedBefore);

  const enables = data.context.enables.map(item => `- ${item}`).join('\n');
  rendered = rendered.replace(/\[Describe future...\]\n\n- \[Future capability...\]/g, enables);

  const inScope = data.context.inScope.map(item => `- ${item}`).join('\n');
  rendered = rendered.replace(/\*\*In Scope\*\*:\n\[List specific...\]\n- \[Specific deliverable\]/g, `**In Scope**:\n${inScope}`);

  const outOfScope = data.context.outOfScope.map(item => `- ${item}`).join('\n');
  rendered = rendered.replace(/\*\*Out of Scope\*\*:\n\[List features...\]\n- \[Deferred feature\]/g, `**Out of Scope**:\n${outOfScope}`);

  // Project requirements table
  const reqRows = data.projectRequirements.map(req =>
    `| #${req.hash} | ${req.name} | ${req.type} | ${req.priority} | ${req.howAddressed} |`
  ).join('\n');
  rendered = rendered.replace(/\| #\[hash\] \| \[Project Requirement Name\] \| \[functional\|non_functional\|constraint\] \| \[must\|should\|could\] \| \[How this gate...\] \|/g, reqRows);

  // Architecture Diagrams table
  const diagramRows = diagramEntries.map(diagram =>
    `| ${diagram.name} | ${diagram.type} | ${String(diagram.order)} | ${diagram.status} |`
  ).join('\n');
  rendered = rendered.replace(
    /\| System Overview[\s\S]*?\| \[Conditional Diagram - Reserved\] *\| \[diagram-type\] *\| 7 *\| pending *\|/,
    diagramRows
  );

  // For now, leave other sections as is, or add more replacements

  return rendered;
}
