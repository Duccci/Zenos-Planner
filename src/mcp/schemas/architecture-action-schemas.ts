import { z } from 'zod'

/**
 * Zod schemas for architecture action tool input and output
 * Consolidates arch_generate and arch_show into a unified diagram_action
 */

// ============================================================================
// INPUT SCHEMA
// ============================================================================

/**
 * Architecture action input with action discriminant
 */
export const ArchitectureActionInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('generate'),
    payload: z.object({}).optional(),
  }),
  z.object({
    action: z.literal('show'),
    payload: z.object({
      type: z.string().min(1, 'Diagram type is required'),
    }),
  }),
])

export type ArchitectureActionInput = z.infer<typeof ArchitectureActionInputSchema>

// ============================================================================
// OUTPUT SCHEMAS (per-action)
// ============================================================================

/**
 * Architecture diagram metadata
 */
export const DiagramMetadataSchema = z.object({
  type: z.string().describe('Diagram type (system, lifecycle, flow, gate-roadmap, etc.)'),
  title: z.string().describe('Diagram title'),
  description: z.string().describe('Diagram description'),
  path: z.string().optional().describe('Path to generated diagram file'),
  format: z.enum(['mermaid', 'svg', 'dot']).optional().describe('Diagram format'),
  generated: z.boolean().optional().describe('Whether diagram was newly generated'),
})

/**
 * Result of arch_generate action
 */
export const ArchGenerateOutputSchema = z.object({
  diagrams: z.array(DiagramMetadataSchema),
  totalDiagrams: z.number().int().min(0),
  timestamp: z.string().describe('Generation timestamp'),
  success: z.boolean(),
})

/**
 * Result of arch_show action
 */
export const ArchShowOutputSchema = z.object({
  diagram: DiagramMetadataSchema,
  content: z.string().optional().describe('Diagram content if available'),
  success: z.boolean(),
})

/**
 * Union output schema for architecture action
 */
export const ArchitectureActionOutputSchema = z.union([
  ArchGenerateOutputSchema,
  ArchShowOutputSchema,
])

export type ArchitectureActionOutput = z.infer<typeof ArchitectureActionOutputSchema>
