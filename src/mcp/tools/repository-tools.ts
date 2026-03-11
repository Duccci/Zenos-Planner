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
  RepositoryActionInputSchema,
  RepositoryActionOutputSchema,
} from '../schemas/repository-action-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'

export const repositoryToolDefinitions = [
  {
    name: 'repos_action',
    description: `Repository management: list, detect, deps, adjust, add, remove. Use for multi-repo structure, boundaries, and dependency analysis.`,
    inputSchema: RepositoryActionInputSchema,
  },
]

export function repositoryHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const reposActionHandler = createEntityActionHandler(
    {
      entity: 'repository',
      actions: ['list', 'detect', 'deps', 'adjust', 'add', 'remove'] as const,
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
          default:
            throw new Error(`Unknown repository action: ${String(action)}`)
        }
      },
      actionHandlers: {
        list: async (payload, r) => r.invoke('repos_list', payload),
        detect: async (payload, r) => r.invoke('repos_detect', payload),
        deps: async (payload, r) => r.invoke('repos_deps', payload),
        adjust: async (payload, r) => r.invoke('repos_adjust', payload),
        add: async (payload, r) => r.invoke('repos_add', payload),
        remove: async (payload, r) => r.invoke('repos_remove', payload),
      },
    },
    registry
  )

  return {
    repos_action: reposActionHandler,
  }
}
