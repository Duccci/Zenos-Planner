/**
 * Requirement Operations Registry
 *
 * Registers all requirement-related operations with the function registry.
 * Handles: list, show, deps, transfer
 *
 * All operations use direct in-process database access via RequirementStorage.
 * Previous implementation used invokeCommand/execSync to spawn CLI child
 * processes, which caused an infinite recursion loop (CLI -> registry ->
 * invokeCommand -> CLI -> ...) and catastrophic process accumulation.
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { RequirementStorage } from '../generation/requirement-storage.js'

export function registerRequirementsOps(registry: FunctionRegistry): void {
  // Unified requirement action handler: list | show | deps | transfer
  registry.register(
    'req_action',
    (params) => {
      const validated = z.object({ action: z.string(), payload: z.any().optional() }).parse(params)
      const storage = new RequirementStorage()

      switch (validated.action) {
        case 'list': {
          const payload = z
            .object({ gateId: z.string().optional(), project: z.boolean().optional() })
            .parse(validated.payload ?? {})

          if (payload.project) {
            const reqs = storage.getProjectRequirements()
            return {
              requirements: reqs.map((r) => ({
                hash: r.hash,
                description: r.description,
                type: r.type,
                priority: r.priority,
                gateId: r.gateId,
                parentId: r.parentId,
                projectId: r.projectId,
              })),
            }
          }

          // Use buildRequirementGraph which returns nodes as a Map<string, DependencyNode>
          const graph = storage.buildRequirementGraph(payload.gateId)
          const requirements = Array.from(graph.nodes.values()).map((n) => ({
            hash: n.hash,
            description: n.title,
            type: n.type,
            priority: n.priority,
            gateId: n.gateId ?? null,
            parentId: n.parent ?? null,
          }))

          return { requirements }
        }

        case 'show': {
          const payload = z.object({ hash: z.string() }).parse(validated.payload)
          const req = storage.getRequirementByHash(payload.hash)
          if (!req) {
            return { requirement: null }
          }
          const children = storage.getRequirementChildren(payload.hash)
          const ancestors = storage.getRequirementAncestors(payload.hash)
          return {
            requirement: {
              hash: req.hash,
              description: req.description,
              type: req.type,
              priority: req.priority,
              gateId: req.gateId,
              parentId: req.parentId,
              projectId: req.projectId,
              acceptanceCriteria: req.acceptanceCriteria ?? null,
              createdAt: req.createdAt.toISOString(),
            },
            children: children.map((c) => ({ hash: c.hash, description: c.description })),
            ancestors: ancestors.map((a) => ({ hash: a.hash, description: a.description })),
          }
        }

        case 'deps': {
          const payload = z.object({ hash: z.string() }).parse(validated.payload)
          const req = storage.getRequirementByHash(payload.hash)
          if (!req) {
            return { graph: null }
          }
          const graph = storage.buildRequirementGraph(req.gateId ?? undefined)
          return {
            graph: {
              nodes: Array.from(graph.nodes.values()).map((n) => ({
                hash: n.hash,
                description: n.title,
                type: n.type,
                priority: n.priority,
                gateId: n.gateId ?? null,
              })),
              edges: graph.edges.map((e) => ({
                from: e.from,
                to: e.to,
                type: e.type,
              })),
            },
          }
        }

        case 'transfer': {
          const payload = z
            .object({ hash: z.string(), gateId: z.string() })
            .parse(validated.payload)
          const result = storage.transferRequirement(payload.hash, payload.gateId)
          return result
        }

        default:
          throw new Error(`Unknown req_action: ${validated.action}`)
      }
    },
    {
      description: 'Unified requirement action (list|show|deps|transfer)',
      parameters: [
        { name: 'action', type: 'string', description: 'Action to perform', required: true },
        {
          name: 'payload',
          type: 'object',
          description: 'Action-specific payload',
          required: false,
        },
      ],
      returnType: 'any',
      schema: z.object({ action: z.string(), payload: z.any().optional() }),
    }
  )
}
