/**
 * Architecture MCP Tool Schemas
 *
 * Zod schemas for architecture-related MCP tools that enable LLM-driven
 * diagram selection and generation.
 */

import { z } from 'zod'

/**
 * Diagram catalogue entry from LLM perspective
 */
export const CatalogueEntrySchema = z.object({
  type: z.string().describe('Diagram type identifier'),
  category: z.enum(['core', 'conditional']).describe('Diagram category'),
  name: z.string().describe('Human-readable diagram name'),
  description: z.string().describe('Purpose and use of this diagram type'),
  whenUseful: z.string().describe('Guidance for when the LLM should select this diagram'),
  templatePath: z.string().describe('Path to the diagram template'),
  alwaysGenerated: z.boolean().describe('True if this is a core diagram, false if conditional'),
})

export type CatalogueEntry = z.infer<typeof CatalogueEntrySchema>

/**
 * Output of arch_catalogue tool
 * Returns all available diagram types with metadata
 */
export const ArchDiagramCatalogueOutputSchema = z.object({
  diagrams: z.array(CatalogueEntrySchema).describe('All available diagram types'),
  totalDiagrams: z.number().int().min(0).describe('Total number of diagram types'),
  coreCount: z.number().int().describe('Count of core (always-generated) diagrams'),
  conditionalCount: z.number().int().describe('Count of conditional (LLM-selected) diagrams'),
})

export type ArchDiagramCatalogueOutput = z.infer<typeof ArchDiagramCatalogueOutputSchema>

/**
 * Input to arch_select tool
 * LLM specifies which conditional diagrams to generate for a gate
 */
export const ArchDiagramSelectInputSchema = z.object({
  gateHash: z.string().min(1).describe('Gate hash for per-gate filename scoping'),
  diagramTypes: z
    .array(z.string())
    .describe('Array of diagram type strings to generate (e.g., ["sequence", "component"])'),
  descriptors: z
    .record(z.string(), z.string())
    .optional()
    .describe('Optional map of diagram type -> descriptor for filename customization'),
})

export type ArchDiagramSelectInput = z.infer<typeof ArchDiagramSelectInputSchema>

/**
 * Output of arch_select tool
 * Confirms which diagrams were selected and are ready to generate
 */
export const ArchDiagramSelectOutputSchema = z.object({
  gateHash: z.string().describe('Gate hash this selection applies to'),
  selected: z.array(z.string()).describe('Confirmed selected diagram types'),
  totalSelected: z.number().int().describe('Count of selected diagrams (core + conditional)'),
  coreCount: z.number().int().describe('Count of core diagrams included'),
  conditionalCount: z.number().int().describe('Count of conditional diagrams selected'),
  ready: z.boolean().describe('Whether generators are ready to generate'),
  timestamp: z.string().describe('Timestamp of selection'),
})

export type ArchDiagramSelectOutput = z.infer<typeof ArchDiagramSelectOutputSchema>

/**
 * Input to arch_generate tool
 * Request diagram generation for all selected types or a single type
 */
export const ArchDiagramGenerateInputSchema = z.object({
  gateHash: z
    .string()
    .optional()
    .describe('Gate hash for per-gate generation; if omitted, regenerates all'),
  diagramType: z
    .string()
    .optional()
    .describe('Single diagram type to regenerate; if omitted, generates all selected types'),
})

export type ArchDiagramGenerateInput = z.infer<typeof ArchDiagramGenerateInputSchema>

/**
 * Diagram output metadata from generation
 */
export const DiagramOutputMetadataSchema = z.object({
  type: z.string().describe('Diagram type'),
  category: z.string().describe('Diagram category (core or conditional)'),
  filePath: z.string().optional().describe('Path where diagram was written (zeno/architecture/<type>.md)'),
  format: z.enum(['mermaid', 'graphviz']).describe('Rendering backend used'),
  generated: z.boolean().describe('Whether diagram was newly generated'),
  content: z.string().optional().describe('Full rendered markdown content (SVG-embedded for graphviz diagrams)'),
})

export type DiagramOutputMetadata = z.infer<typeof DiagramOutputMetadataSchema>

/**
 * Output of arch_generate tool
 * Reports generated diagrams and their locations
 */
export const ArchDiagramGenerateOutputSchema = z.object({
  diagrams: z.array(DiagramOutputMetadataSchema).describe('Details of generated diagrams'),
  totalGenerated: z.number().int().min(0).describe('Count of diagrams generated'),
  timestamp: z.string().describe('Generation timestamp'),
  success: z.boolean().describe('Whether generation succeeded'),
})

export type ArchDiagramGenerateOutput = z.infer<typeof ArchDiagramGenerateOutputSchema>

/**
 * Input to arch_show tool
 * Request to retrieve and display a specific diagram
 */
export const ArchDiagramShowInputSchema = z.object({
  diagramType: z.string().min(1).describe('Diagram type to retrieve'),
  gateHash: z.string().optional().describe('Optional gate hash for gate-specific diagram'),
})

export type ArchDiagramShowInput = z.infer<typeof ArchDiagramShowInputSchema>

/**
 * Output of arch_show tool
 * Returns diagram content and metadata
 */
export const ArchDiagramShowOutputSchema = z.object({
  type: z.string().describe('Diagram type'),
  title: z.string().describe('Diagram title'),
  content: z.string().describe('Diagram markup content'),
  format: z.enum(['mermaid', 'graphviz']).describe('Diagram format'),
  filePath: z.string().optional().describe('File path where diagram is stored'),
  found: z.boolean().describe('Whether the diagram was found'),
})

export type ArchDiagramShowOutput = z.infer<typeof ArchDiagramShowOutputSchema>

/**
 * Unified input schema for the diagram_action tool.
 *
 * action required for all calls:
 *   catalogue      — list all available diagram types with metadata
 *   select         — record diagram selections for a gate; required: gateHash, diagramTypes; optional: descriptors
 *   generate       — generate diagrams; optional: gateHash, diagramType
 *   show           — retrieve a specific diagram; required: diagramType; optional: gateHash
 *   render         — render raw DOT syntax to SVG via local Graphviz CLI; required: dotSyntax; optional: format
 *   list_template  — list all available architecture templates
 *   get_template   — retrieve a template by name; required: name; optional: includeContext
 */
export const DiagramActionInputSchema = z.object({
  action: z
    .enum(['catalogue', 'select', 'generate', 'show', 'render', 'list_template', 'get_template'])
    .optional()
    .describe(
      'Action to perform. ' +
        'catalogue=list all diagram types. ' +
        'select=record selections for a gate (needs: gateHash, diagramTypes). ' +
        'generate=generate diagrams (optional: gateHash, diagramType). ' +
        'show=retrieve a diagram (needs: diagramType; optional: gateHash). ' +
        'render=render raw DOT syntax to SVG using local Graphviz CLI (needs: dotSyntax). ' +
        'list_template=list all available templates. ' +
        'get_template=retrieve a template by name (needs: name; optional: includeContext).'
    ),

  // --- select fields ---
  gateHash: z.string().optional().describe('Gate hash for scoping (select/generate/show)'),
  diagramTypes: z
    .array(z.string())
    .optional()
    .describe('Array of diagram type strings to select (select)'),
  descriptors: z
    .record(z.string(), z.string())
    .optional()
    .describe('Optional map of diagram type -> descriptor for filename customization (select)'),

  // --- generate/show fields ---
  diagramType: z.string().optional().describe('Single diagram type to generate or show (generate/show)'),

  // --- render fields ---
  dotSyntax: z.string().optional().describe('Raw Graphviz DOT syntax to render to SVG (render)'),

  // --- template get fields ---
  name: z.string().optional().describe('Template name to retrieve (get)'),
  includeContext: z
    .union([z.boolean(), z.string()])
    .optional()
    .describe('When true, wraps artifact with name context metadata (get)'),
})

export type DiagramActionInput = z.infer<typeof DiagramActionInputSchema>

/**
 * Output of render action (DOT → SVG rendering)
 */
export const ArchDiagramRenderOutputSchema = z.object({
  svg: z.string().describe('Full SVG string rendered from the DOT source'),
  bytes: z.number().int().describe('Byte length of the SVG output'),
})

export type ArchDiagramRenderOutput = z.infer<typeof ArchDiagramRenderOutputSchema>

/**
 * Template metadata from discovery
 */
export const TemplateMetadataSchema = z.object({
  name: z.string().describe('Full template name'),
  shortName: z.string().describe('Short template identifier'),
  path: z.string().describe('Relative file path'),
  description: z.string().describe('Template description'),
  category: z.enum(['markdown', 'architecture']).describe('Template category'),
})

export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>

/**
 * Output of list_template action
 * Returns all available templates with metadata
 */
export const TemplateListOutputSchema = z.object({
  templates: z.array(TemplateMetadataSchema).describe('All available templates'),
})

export type TemplateListOutput = z.infer<typeof TemplateListOutputSchema>

/**
 * Output of get_template action
 * Returns a specific template with optional content and context
 */
export const TemplateGetOutputSchema = z
  .object({
    name: z.string().describe('Template name'),
    shortName: z.string().describe('Short name'),
    path: z.string().describe('Relative file path'),
    description: z.string().describe('Template description'),
    category: z.enum(['markdown', 'architecture']).describe('Category'),
    content: z.string().optional().describe('Full template content (if available)'),
    fillDirective: z
      .string()
      .optional()
      .describe(
        'Always-present fill instruction: replace every [bracketed placeholder] before using the template'
      ),
    _context: z
      .object({
        retrievedAt: z.string().describe('ISO timestamp when template was retrieved'),
        templateName: z.string().describe('Name of the template retrieved'),
      })
      .optional()
      .describe('Optional retrieval context metadata'),
  })
  .describe('Retrieved template artifact with metadata and optional content')

export type TemplateGetOutput = z.infer<typeof TemplateGetOutputSchema>

export const DiagramActionOutputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('catalogue'), result: ArchDiagramCatalogueOutputSchema }),
  z.object({ action: z.literal('select'), result: ArchDiagramSelectOutputSchema }),
  z.object({ action: z.literal('generate'), result: ArchDiagramGenerateOutputSchema }),
  z.object({ action: z.literal('show'), result: ArchDiagramShowOutputSchema }),
  z.object({ action: z.literal('render'), result: ArchDiagramRenderOutputSchema }),
  z.object({ action: z.literal('list_template'), result: TemplateListOutputSchema }),
  z.object({ action: z.literal('get_template'), result: TemplateGetOutputSchema }),
])

export type DiagramActionOutput = z.infer<typeof DiagramActionOutputSchema>

export function getDiagramActionOutputSchema(action: string): z.ZodType {
  switch (action) {
    case 'catalogue':
      return ArchDiagramCatalogueOutputSchema
    case 'select':
      return ArchDiagramSelectOutputSchema
    case 'generate':
      return ArchDiagramGenerateOutputSchema
    case 'show':
      return ArchDiagramShowOutputSchema
    case 'render':
      return ArchDiagramRenderOutputSchema
    case 'list_template':
      return TemplateListOutputSchema
    case 'get_template':
      return TemplateGetOutputSchema
    default:
      // z.unknown() has def.type='unknown' → normalizeObjectSchema returns undefined → _zod TypeError.
      // Use passthrough object: accepts any shape and normalizes correctly.
      return z.looseObject({})
  }
}
