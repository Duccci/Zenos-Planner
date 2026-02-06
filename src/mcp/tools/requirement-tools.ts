import { ReqListInputSchema, ReqShowInputSchema, ReqDepsInputSchema, ReqTransferInputSchema } from '../schemas/requirement-schemas.js'

export const requirementToolDefinitions = [
  {
    name: 'req_list',
    title: 'Requirement List',
    description: 'List requirements optionally filtered by gate or type',
    inputSchema: ReqListInputSchema
  },
  {
    name: 'req_show',
    title: 'Requirement Show',
    description: 'Show requirement details by hash or id',
    inputSchema: ReqShowInputSchema
  },
  {
    name: 'req_deps',
    title: 'Requirement Dependencies',
    description: 'Get dependency graph for a requirement',
    inputSchema: ReqDepsInputSchema
  },
  {
    name: 'req_transfer',
    title: 'Requirement Transfer',
    description: 'Transfer requirement to different gate',
    inputSchema: ReqTransferInputSchema
  }
]

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ReqListOutputSchema, RequirementDetailSchema, DependencyGraphSchema, ReqTransferOutputSchema } from '../schemas/requirement-schemas.js'
import { createSchemaValidatingHandler } from './handler-factory.js'

export function requirementHandlers(registry: FunctionRegistry) {
  const reqListHandler = createSchemaValidatingHandler(registry, 'req_list', ReqListOutputSchema)
  const reqShowHandler = createSchemaValidatingHandler(registry, 'req_show', RequirementDetailSchema)
  const reqDepsHandler = createSchemaValidatingHandler(registry, 'req_deps', DependencyGraphSchema)
  const reqTransferHandler = createSchemaValidatingHandler(registry, 'req_transfer', ReqTransferOutputSchema)

  return {
    req_list: reqListHandler,
    req_show: reqShowHandler,
    req_deps: reqDepsHandler,
    req_transfer: reqTransferHandler
  }
}
