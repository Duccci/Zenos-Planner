import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this module (src/generation/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Templates are located relative to the package root
// From src/generation/ -> .. -> .. (package root) -> templates/
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATES_DIR = path.join(PACKAGE_ROOT, 'templates');

/**
 * Template metadata interface
 */
export interface Template {
  name: string;
  category: 'markdown' | 'architecture';
  path: string;
  description: string;
  shortName: string;
}

/**
 * All 14 available templates with metadata
 */
export const TEMPLATES: Template[] = [
  // Markdown templates (4)
  {
    name: 'agents-template',
    category: 'markdown',
    path: 'templates/md-templates/agents-template.md',
    description: 'AGENTS.md generation template for AI context guidance',
    shortName: 'agents'
  },
  {
    name: 'gate-prd-template',
    category: 'markdown',
    path: 'templates/md-templates/gate-prd-template.md',
    description: 'Gate PRD document template with objectives, requirements, and implementation steps',
    shortName: 'gate-prd'
  },
  {
    name: 'project-prd-template',
    category: 'markdown',
    path: 'templates/md-templates/project-prd-template.md',
    description: 'Project PRD document template for end-state definition and project scope',
    shortName: 'project-prd'
  },
  {
    name: 'proposal-template',
    category: 'markdown',
    path: 'templates/md-templates/proposal-template.md',
    description: 'Proposal document template for implementation work items',
    shortName: 'proposal'
  },

  // Architecture diagram templates (10)
  {
    name: 'system-overview-template',
    category: 'architecture',
    path: 'templates/architecture-templates/system-overview-template.md',
    description: 'Component architecture diagram showing system structure',
    shortName: 'system-overview'
  },
  {
    name: 'gate-roadmap-template',
    category: 'architecture',
    path: 'templates/architecture-templates/gate-roadmap-template.md',
    description: 'Gate progression diagram showing project roadmap and dependencies',
    shortName: 'gate-roadmap'
  },
  {
    name: 'data-flow-template',
    category: 'architecture',
    path: 'templates/architecture-templates/data-flow-template.md',
    description: 'End-to-end data flow diagram showing information movement',
    shortName: 'data-flow'
  },
  {
    name: 'lifecycle-template',
    category: 'architecture',
    path: 'templates/architecture-templates/lifecycle-template.md',
    description: 'State machine and lifecycle diagram for entities and processes',
    shortName: 'lifecycle'
  },
  {
    name: 'component-diagram-template',
    category: 'architecture',
    path: 'templates/architecture-templates/component-diagram-template.md',
    description: 'Component structure diagram showing relationships',
    shortName: 'component'
  },
  {
    name: 'context-diagram-template',
    category: 'architecture',
    path: 'templates/architecture-templates/context-diagram-template.md',
    description: 'Context and scope diagram showing system boundaries',
    shortName: 'context'
  },
  {
    name: 'deployment-diagram-template',
    category: 'architecture',
    path: 'templates/architecture-templates/deployment-diagram-template.md',
    description: 'Deployment architecture diagram for infrastructure and environments',
    shortName: 'deployment'
  },
  {
    name: 'network-diagram-template',
    category: 'architecture',
    path: 'templates/architecture-templates/network-diagram-template.md',
    description: 'Network topology diagram for communication patterns',
    shortName: 'network'
  },
  {
    name: 'package-diagram-template',
    category: 'architecture',
    path: 'templates/architecture-templates/package-diagram-template.md',
    description: 'Package and module structure diagram',
    shortName: 'package'
  },
  {
    name: 'sequence-diagram-template',
    category: 'architecture',
    path: 'templates/architecture-templates/sequence-diagram-template.md',
    description: 'Sequence and interaction diagram showing process flows',
    shortName: 'sequence'
  }
];

/**
 * Load a single template file by name
 * @param name Template name (e.g., 'gate-prd-template')
 * @returns Promise resolving to template content
 * @throws Error if template not found
 */
export async function loadTemplate(name: string): Promise<string> {
  const template = TEMPLATES.find(t => t.name === name);

  if (!template) {
    const available = TEMPLATES.map(t => t.name).join(', ');
    throw new Error(
      `Template "${name}" not found. Available templates: ${available}`
    );
  }

  try {
    // Resolve path relative to Zeno package root, not user's working directory
    const filePath = path.join(TEMPLATES_DIR, template.path.replace(/^templates\//, ''));
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        `Template file not found: ${template.path}\nResolved to: ${path.join(TEMPLATES_DIR, template.path.replace(/^templates\//, ''))}\nTemplate metadata exists but file is missing.`
      );
    }
    throw error;
  }
}

/**
 * Load all templates as a key-value map
 * @returns Promise resolving to map of template names to content
 */
export async function loadAllTemplates(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (const template of TEMPLATES) {
    try {
      const content = await loadTemplate(template.name);
      result[template.name] = content;
    } catch (error) {
      // Log error but continue loading other templates
      console.error(`Warning: Failed to load template "${template.name}":`, error);
    }
  }

  return result;
}

/**
 * Retrieve template metadata without loading content
 * @param name Template name
 * @returns Template metadata or undefined if not found
 */
export function getTemplateMetadata(name: string): Template | undefined {
  return TEMPLATES.find(t => t.name === name);
}

/**
 * Filter templates by category
 * @param category Template category ('markdown' or 'architecture')
 * @returns Array of templates in the specified category
 */
export function getTemplatesByCategory(category: 'markdown' | 'architecture'): Template[] {
  return TEMPLATES.filter(t => t.category === category);
}
