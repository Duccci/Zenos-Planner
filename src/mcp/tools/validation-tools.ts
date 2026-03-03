import type { FunctionRegistry } from '../../integration/function-registry.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { handleMockResult, handleError } from './handler-factory.js'
import {
  ArtifactValidateInputSchema,
  ArtifactValidateOutputSchema,
} from '../schemas/artifact-validation-schemas.js'

export const validationToolDefinitions = [
  {
    name: 'artifact_validate',
    description:
      'Unified artifact validator (format/quality/dependency). IMPORTANT: Structure validation is always enforced as part of Zeno. ' +
      'The result includes an `agentReview` field with targeted questions you MUST evaluate using your own judgment — ' +
      'mechanical checks do not substitute for this review. A `passed: true` result is not complete until every agentReview item has been addressed.',
    inputSchema: {
      type: 'object',
      properties: {
        artifactPath: { type: 'string' },
        artifactHash: { type: 'string' },
        artifactType: { type: 'string', enum: ['gate', 'proposal', 'architecture'] },
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
      const mock = handleMockResult(args, ArtifactValidateOutputSchema)
      if (mock) return mock

      try {
        const { artifactPath, artifactHash, artifactType, outputFormat } =
          ArtifactValidateInputSchema.parse(args)
        const { ArtifactValidationService } =
          await import('../../analysis/artifact-validation-service.js')
        const svc = new ArtifactValidationService()
        const res = await svc.validate({
          artifactPath,
          artifactHash,
          artifactType,
        })

        if (outputFormat === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
            structuredContent: {
              passed: res.passed,
              errors: res.errors,
              warnings: res.warnings,
              ...(res.score !== undefined ? { score: res.score } : {}),
              details: res.details,
              ...(res.agentReview !== undefined ? { agentReview: res.agentReview } : {}),
            },
          }
        }

        let text = `Validation ${res.passed ? 'PASSED' : 'FAILED'}`
        if (res.score !== undefined) text += ` (implementation score: ${String(res.score)}/100)`
        if (res.errors?.length) text += '\nErrors:\n' + res.errors.map((e) => ` - ${e}`).join('\n')
        if (res.warnings?.length)
          text += '\nWarnings:\n' + res.warnings.map((w) => ` - ${w}`).join('\n')
        if (res.agentReview?.length) {
          text +=
            '\n\nAgent Review Required — mechanical checks cannot verify the following.\n' +
            'You MUST evaluate each item by reading the artifact content:\n' +
            res.agentReview.map((r, i) => ` ${String(i + 1)}. ${r}`).join('\n')
        }

        return {
          content: [{ type: 'text', text }],
          structuredContent: {
            passed: res.passed,
            errors: res.errors,
            warnings: res.warnings,
            ...(res.score !== undefined ? { score: res.score } : {}),
            ...(res.agentReview !== undefined ? { agentReview: res.agentReview } : {}),
          },
        }
      } catch (err) {
        return handleError(err, { tool: 'artifact_validate' })
      }
    },
  }
}
