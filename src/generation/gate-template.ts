/**
 * Gate Template Rendering
 *
 * Loads and renders gate PRD templates with gate-specific data.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

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
  // Add more fields as needed
}

/**
 * Load template from file
 */
export function loadTemplate(templateName: string): string {
  const templatePath = join(__dirname, '../../templates/md-templates', `${templateName}.md`);
  return readFileSync(templatePath, 'utf-8');
}

/**
 * Render template with data
 */
export function renderGateTemplate(template: string, data: GateData): string {
  let rendered = template;

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

  // For now, leave other sections as is, or add more replacements

  return rendered;
}