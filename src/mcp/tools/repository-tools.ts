import { z } from 'zod'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  ReposListOutputSchema,
  RepositoryDependencyGraphSchema,
  ReposDetectOutputSchema,
  ReposAdjustOutputSchema,
  ReposAddOutputSchema,
  ReposRemoveOutputSchema,
} from '../schemas/repository-schemas.js'
import {
  AnalysisResultSchema,
  ProjectMetricsSchema,
} from '../schemas/analysis-schemas.js'
import {
  RepositoryActionInputSchema,
  RepositoryActionOutputSchema,
} from '../schemas/repository-action-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'

export const repositoryToolDefinitions = [
  {
    name: 'repos_action',
    description: `Repository management: list, detect, deps, adjust, add, remove, analyze. Use for multi-repo structure, boundaries, dependency analysis, and codebase metrics.`,
    inputSchema: RepositoryActionInputSchema,
  },
]

export function repositoryHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const reposActionHandler = createEntityActionHandler(
    {
      entity: 'repository',
      actions: ['list', 'detect', 'deps', 'adjust', 'add', 'remove', 'analyze'] as const,
      inputSchema: RepositoryActionInputSchema,
      outputSchema: RepositoryActionOutputSchema,
      actionOutputSchema(action) {
        switch (action) {
          case 'list':
            return ReposListOutputSchema
          case 'detect':
            return ReposDetectOutputSchema
          case 'deps':
            return RepositoryDependencyGraphSchema
          case 'adjust':
            return ReposAdjustOutputSchema
          case 'add':
            return ReposAddOutputSchema
          case 'remove':
            return ReposRemoveOutputSchema
          case 'analyze':
            return z.union([AnalysisResultSchema, z.array(AnalysisResultSchema), ProjectMetricsSchema])
          default:
            throw new Error(`Unknown repository action: ${String(action)}`)
        }
      },
      actionHandlers: {
        list: async (payload, r) => r.invoke('repos_list', payload),
        detect: async (payload, r) => r.invoke('repos_detect', payload),
        deps: async (payload, r) => r.invoke('repos_deps', payload),
        adjust: async (payload, r) => r.invoke('repos_adjust', payload),
        add: async (payload, r) => {
          const name = (payload as { name?: string }).name
          const path = (payload as { path?: string }).path
          const missing: string[] = []
          if (!name?.trim()) missing.push('name')
          if (!path?.trim()) missing.push('path')
          if (missing.length > 0) {
            return {
              success: false,
              error: {
                code: 'ADD_MISSING_FIELDS',
                message:
                  `repos_action:add requires name and path. Missing: ${missing.join(', ')}. ` +
                  'Supply: name (repository identifier), type (service/library/tool/app), path (root directory).',
                context: {
                  missingFields: missing,
                  receivedKeys: Object.keys(payload ?? {}),
                },
              },
            }
          }
          return r.invoke('repos_add', payload)
        },
        remove: async (payload, r) => r.invoke('repos_remove', payload),
        analyze: async (payload, r) => {
          if (payload?.['groupBy'] !== undefined) {
            return r.invoke('metrics', payload)
          }
          return r.invoke('analyze', payload)
        },
      },
    },
    registry
  )

  return {
    repos_action: reposActionHandler,
  }
}
