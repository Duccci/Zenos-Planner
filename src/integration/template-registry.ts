/**
 * Template Operations Registry
 *
 * Registers all template-related operations with the function registry.
 * Handles: template_list, template_get
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { invokeCommand } from './command-invoker.js'

export function registerTemplateOps(registry: FunctionRegistry): void {
  registry.register(
    'template_list',
    async () => {
      const result = await invokeCommand('template_list')
      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'COMMAND_FAILED',
            message: String(result.error),
            context: {},
            timestamp: new Date().toISOString(),
          },
        }
      }
      return { success: true, data: result.output }
    },
    {
      description: 'List all available templates',
      parameters: [],
      returnType: 'Template[]',
      schema: z.object({}),
    }
  )

  registry.register(
    'template_get',
    async (params) => {
      const validated = z
        .object({ name: z.string(), includeContext: z.boolean().optional() })
        .parse(params)
      const result = await invokeCommand('template_get', validated)
      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'COMMAND_FAILED',
            message: String(result.error),
            context: {},
            timestamp: new Date().toISOString(),
          },
        }
      }
      return { success: true, data: result.output }
    },
    {
      description:
        'Get template content by name, optionally with contextual metadata for LLM usage',
      parameters: [
        {
          name: 'name',
          type: 'string',
          description: 'Template name to retrieve',
          required: true,
        },
        {
          name: 'includeContext',
          type: 'boolean',
          description: 'When true, includes formatted context metadata for LLM injection',
          required: false,
        },
      ],
      returnType: 'string',
      schema: z.object({
        name: z.string().min(1, 'Template name is required'),
        includeContext: z.boolean().optional(),
      }),
    }
  )
}
