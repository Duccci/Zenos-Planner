import type { FunctionRegistry } from '../../integration/function-registry.js'
import { z } from 'zod'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  ReposListOutputSchema,
  RepositoryDependencyGraphSchema,
  ReposDetectOutputSchema,
  ReposAdjustOutputSchema,
} from '../schemas/repository-schemas.js'
import {
  createSchemaValidatingHandler,
  handleMockResult,
  createNotImplementedHandler,
} from './handler-factory.js'

export const repositoryToolDefinitions = [
  {
    name: 'repos_list',
    description: 'List detected repositories and boundaries',
    inputSchema: z.any(),
  },
  {
    name: 'repos_deps',
    description: 'Show repository dependency graph',
    inputSchema: z.any(),
  },
  {
    name: 'repos_detect',
    description: 'Detect repository boundaries by analyzing code',
    inputSchema: z.any(),
  },
  {
    name: 'repos_adjust',
    description: 'Adjust detected repository boundaries manually',
    inputSchema: z.any(),
  },
]

export function repositoryHandlers(
  _registry?: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const listHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'repos_list', ReposListOutputSchema)
    : undefined
  const depsHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'repos_deps', RepositoryDependencyGraphSchema)
    : undefined
  const detectHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'repos_detect', ReposDetectOutputSchema)
    : undefined
  const adjustHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'repos_adjust', ReposAdjustOutputSchema)
    : undefined

  return {
    async repos_list(args: Record<string, unknown>): Promise<CallToolResult> {
      const mock = handleMockResult(args, ReposListOutputSchema)
      if (mock) return mock

      if (!listHandler)
        return createNotImplementedHandler(
          'Repository analysis not implemented yet (Gate 05 required).'
        )
      return listHandler(args)
    },

    async repos_deps(args: Record<string, unknown>): Promise<CallToolResult> {
      const mock = handleMockResult(args, RepositoryDependencyGraphSchema)
      if (mock) return mock

      if (!depsHandler)
        return createNotImplementedHandler(
          'Repository dependency analysis not implemented yet (Gate 05 required).'
        )
      return depsHandler(args)
    },

    async repos_detect(args: Record<string, unknown>): Promise<CallToolResult> {
      const mock = handleMockResult(args, ReposDetectOutputSchema)
      if (mock) return mock

      if (!detectHandler)
        return createNotImplementedHandler(
          'Repository detection not implemented yet (Gate 05 required).'
        )
      return detectHandler(args)
    },

    async repos_adjust(args: Record<string, unknown>): Promise<CallToolResult> {
      const mock = handleMockResult(args, ReposAdjustOutputSchema)
      if (mock) return mock

      if (!adjustHandler)
        return createNotImplementedHandler('Repository adjust not implemented yet.')
      return adjustHandler(args)
    },
  }
}
