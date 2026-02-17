import type { FunctionRegistry } from '../../integration/function-registry.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { handleMockResult, handleError } from './handler-factory.js'

const ValidationArgsSchema = z.object({
  artifactPath: z.string().optional(),
  artifactHash: z.string().optional(),
  artifactType: z.enum(['gate', 'proposal', 'architecture']),
  validationMode: z.enum(['format', 'quality', 'all']).optional(),
  outputFormat: z.enum(['text', 'json']).optional(),
})

export const validationToolDefinitions = [
  {
    name: 'artifact_validate',
    description: 'Unified artifact validator (format/quality/dependency)',
    inputSchema: {
      type: 'object',
      properties: {
        artifactPath: { type: 'string' },
        artifactHash: { type: 'string' },
        artifactType: { type: 'string', enum: ['gate', 'proposal', 'architecture'] },
        validationMode: { type: 'string', enum: ['format', 'quality', 'all'] },
        outputFormat: { type: 'string', enum: ['text', 'json'] },
      },
      required: ['artifactType'],
    },
  },
]

export function validationHandlers(
  _registry?: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  return {
    async artifact_validate(args: Record<string, unknown>): Promise<CallToolResult> {
      // Allow tests to provide a mock result
      const mock = handleMockResult(args, z.any())
      if (mock) return mock

      try {
        const { artifactPath, artifactHash, artifactType, validationMode, outputFormat } =
          ValidationArgsSchema.parse(args)
        const { ArtifactValidationService } =
          await import('../../analysis/artifact-validation-service.js')
        const svc = new ArtifactValidationService()
        const res = await svc.validate({
          artifactPath,
          artifactHash,
          artifactType,
          validationMode,
        })

        if (outputFormat === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
            structuredContent: res as unknown as Record<string, unknown>,
          }
        }

        let text = `Validation ${res.passed ? 'PASSED' : 'FAILED'}`
        if (res.errors?.length) text += '\nErrors:\n' + res.errors.map((e) => ` - ${e}`).join('\n')
        if (res.warnings?.length)
          text += '\nWarnings:\n' + res.warnings.map((w) => ` - ${w}`).join('\n')

        return {
          content: [{ type: 'text', text }],
          structuredContent: { passed: res.passed, errors: res.errors, warnings: res.warnings },
        }
      } catch (err) {
        return handleError(err, { tool: 'artifact_validate' })
      }
    },
  }
}
