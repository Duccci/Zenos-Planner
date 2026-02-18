import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  ReposListOutputSchema,
  RepositoryDependencyGraphSchema,
  ReposDetectOutputSchema,
  ReposAdjustOutputSchema,
} from '../schemas/repository-schemas.js'
import {
  RepositoryActionInputSchema,
  RepositoryActionOutputSchema,
} from '../schemas/repository-action-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'

export const repositoryToolDefinitions = [
  {
    name: 'repos_action',
    description: `Unified repository management and analysis.

Actions: list (see detected repositories and boundaries), detect (re-run boundary detection), deps (view dependency graph), adjust (manually adjust boundaries).

Call this tool when: you need to understand repository structure, detect boundaries, view dependencies, or adjust boundaries.`,
    inputSchema: RepositoryActionInputSchema,
  },
]

export function repositoryHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const reposActionHandler = createEntityActionHandler(
    {
      entity: 'repository',
      actions: ['list', 'detect', 'deps', 'adjust'] as const,
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
          default:
            throw new Error(`Unknown repository action: ${action as string}`)
        }
      },
      actionHandlers: {
        list: async (payload, r) => r.invoke('repos_list', payload),
        detect: async (payload, r) => r.invoke('repos_detect', payload),
        deps: async (payload, r) => r.invoke('repos_deps', payload),
        adjust: async (payload, r) => r.invoke('repos_adjust', payload),
      },
    },
    registry
  )

  return {
    repos_action: reposActionHandler,
  }
}
