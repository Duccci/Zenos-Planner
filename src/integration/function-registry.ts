/**
 * Zeno Function Signature Registry
 *
 * Registry of all Zeno functions that LLMs can invoke.
 * Provides function signatures in a format compatible with LLM function calling APIs.
 * Also provides the actual invocation infrastructure for executing registered functions.
 */

import { z } from 'zod'
import { logger } from '../utils/logger.js'

export interface FunctionParameter {
  name: string
  type: string
  description: string
  required: boolean
}

export interface FunctionDefinition {
  name: string
  description: string
  parameters: FunctionParameter[]
  returnType: string
  examples: string[]
}

export interface FunctionDefinition {
  name: string
  description: string
  parameters: FunctionParameter[]
  returnType: string
  examples: string[]
}

/**
 * Error response structure for consistent error handling
 */
export interface FunctionErrorResponse {
  code: string
  message: string
  context?: Record<string, unknown>
  timestamp?: string
  operations?: unknown
}

/**
 * Result type for function invocation
 */
export type FunctionResult<T = unknown> = 
  | { success: true; data: T }
  | { success: false; error: FunctionErrorResponse }

/**
 * Registered function with implementation
 */
export interface RegisteredFunction<T = unknown> {
  name: string
  description: string
  parameters: FunctionParameter[]
  returnType: string
  schema: z.ZodSchema
  implementation: (params: Record<string, unknown>) => T | Promise<T>
}

/**
 * Function Registry class for registration and invocation
 */
export class FunctionRegistry {
  private functions: Map<string, RegisteredFunction> = new Map()

  /**
   * Register a new function
   */
  register<T = unknown>(
    name: string,
    implementation: (params: Record<string, unknown>) => T | Promise<T>,
    options: {
      description: string
      parameters: FunctionParameter[]
      returnType: string
      schema: z.ZodSchema
    }
  ): void {
    const registered: RegisteredFunction<T> = {
      name,
      description: options.description,
      parameters: options.parameters,
      returnType: options.returnType,
      schema: options.schema,
      implementation
    }

    this.functions.set(name, registered)
    logger.debug(`Function registered: ${name}`)
  }

  /**
   * Invoke a registered function with validation
   */
  async invoke<T = unknown>(
    name: string,
    params: Record<string, unknown> = {}
  ): Promise<FunctionResult<T>> {
    try {
      const func = this.functions.get(name)

      if (!func) {
        return {
          success: false,
          error: {
            code: 'FUNCTION_NOT_FOUND',
            message: `Function '${name}' is not registered`
          }
        }
      }

      // Validate parameters against schema
      let validatedParams: Record<string, unknown>
      try {
        validatedParams = func.schema.parse(params) as Record<string, unknown>
      } catch (error) {
        const zodError = error as z.ZodError
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Parameter validation failed',
            context: {
              issues: zodError.issues.map(issue => ({
                path: issue.path.join('.'),
                message: issue.message,
                code: issue.code
              }))
            }
          }
        }
      }

      // Invoke the function
      logger.debug(`Invoking function: ${name}`)
      const result = await Promise.resolve(func.implementation(validatedParams))

      return {
        success: true,
        data: result as T
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      // Prefer any explicit error code attached to the error object
      const code = (error && typeof error === 'object' && (error as any).code) ? (error as any).code : 'INVOCATION_ERROR'
      const operations = (error && typeof error === 'object' && (error as any).operations) ? (error as any).operations : undefined

      logger.error(`Function invocation failed: ${name} - ${errorMessage}`)
      if (errorStack) {
        logger.debug(errorStack)
      }

      return {
        success: false,
        error: {
          code,
          message: `Error executing function '${name}': ${errorMessage}`,
          context: {
            functionName: name,
            errorType: error instanceof Error ? error.constructor.name : typeof error
          },
          timestamp: new Date().toISOString(),
          operations
        }
      }
    }
  }

  /**
   * Get all registered functions
   */
  list(): RegisteredFunction[] {
    return Array.from(this.functions.values())
  }

  /**
   * Get a specific registered function
   */
  get(name: string): RegisteredFunction | undefined {
    return this.functions.get(name)
  }

  /**
   * Get functions by category (based on name prefix)
   */
  getByCategory(category: string): RegisteredFunction[] {
    const categoryPrefixes: Record<string, string[]> = {
      gates: ['gates_'],
      requirements: ['req_'],
      proposals: ['proposal_'],
      architecture: ['arch_'],
      templates: ['getTemplate', 'loadAllTemplates', 'getTemplatesByCategory'],
      general: ['init', 'status', 'show', 'config_get']
    }

    const prefixes = categoryPrefixes[category] ?? []
    return this.list().filter(func =>
      prefixes.some(prefix => func.name.startsWith(prefix))
    )
  }
}

/**
 * Registry of all invokable Zeno functions
 */
export const functionRegistry: FunctionDefinition[] = [
  {
    name: 'init',
    description: 'Initialize a new Zeno project with interactive prompts for project setup',
    parameters: [],
    returnType: 'void',
    examples: [
      'init() - Start interactive project initialization'
    ]
  },
  {
    name: 'status',
    description: 'Show current project status and progress overview',
    parameters: [],
    returnType: 'ProjectStatus',
    examples: [
      'status() - Display current project state'
    ]
  },
  {
    name: 'gates_list',
    description: 'List all gates in the project with their status',
    parameters: [],
    returnType: 'Gate[]',
    examples: [
      'gates_list() - Show all project gates'
    ]
  },
  {
    name: 'gates_show',
    description: 'Show detailed information about a specific gate',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'The ID of the gate to show (e.g., "gate-01")',
        required: true
      }
    ],
    returnType: 'GateDetails',
    examples: [
      'gates_show("gate-01") - Show details for gate 1'
    ]
  },
  {
    name: 'gates_start',
    description: 'Start working on a gate (changes status from pending to in_progress)',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'The ID of the gate to start',
        required: true
      }
    ],
    returnType: 'void',
    examples: [
      'gates_start("gate-02") - Begin work on gate 2'
    ]
  },
  {
    name: 'gates_complete',
    description: 'Mark a gate as completed and create a release tag',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'The ID of the gate to complete',
        required: true
      }
    ],
    returnType: 'void',
    examples: [
      'gates_complete("gate-01") - Complete gate 1'
    ]
  },
  {
    name: 'req_list',
    description: 'List requirements, optionally filtered by gate or project-wide',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'Optional gate ID to filter requirements',
        required: false
      },
      {
        name: 'project',
        type: 'boolean',
        description: 'If true, list project-level requirements only',
        required: false
      }
    ],
    returnType: 'Requirement[]',
    examples: [
      'req_list() - List all requirements',
      'req_list("gate-02") - List requirements for gate 2',
      'req_list(null, true) - List project-level requirements'
    ]
  },
  {
    name: 'req_show',
    description: 'Show detailed information about a specific requirement',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the requirement',
        required: true
      }
    ],
    returnType: 'RequirementDetails',
    examples: [
      'req_show("#a3f9c2d1") - Show requirement details'
    ]
  },
  {
    name: 'req_deps',
    description: 'Show dependency graph for a requirement',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the requirement',
        required: true
      }
    ],
    returnType: 'DependencyGraph',
    examples: [
      'req_deps("#a3f9c2d1") - Show requirement dependencies'
    ]
  },

  {
    name: 'req_transfer',
    description: 'Transfer a requirement to another gate',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the requirement',
        required: true
      },
      {
        name: 'gateId',
        type: 'string',
        description: 'The target gate ID',
        required: true
      }
    ],
    returnType: 'void',
    examples: [
      'req_transfer("#a3f9c2d1", "gate-04") - Transfer requirement to gate-04'
    ]
  },
  {
    name: 'proposal_list',
    description: 'List proposals, optionally filtered by gate or status',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'Optional gate ID to filter proposals',
        required: false
      },
      {
        name: 'status',
        type: 'string',
        description: 'Optional status filter: pending, in_progress, completed, rejected',
        required: false
      }
    ],
    returnType: 'Proposal[]',
    examples: [
      'proposal_list() - List all proposals',
      'proposal_list("gate-02") - List proposals for gate 2',
      'proposal_list(null, "pending") - List pending proposals'
    ]
  },
  {
    name: 'proposal_show',
    description: 'Show detailed information about a specific proposal',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'ProposalDetails',
    examples: [
      'proposal_show("#g02p07llm") - Show proposal details'
    ]
  },
  {
    name: 'proposal_start',
    description: 'Start implementation of a proposal (status: pending -> in_progress)',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'void',
    examples: [
      'proposal_start("#g02p07llm") - Start proposal implementation'
    ]
  },
  {
    name: 'proposal_validate',
    description: 'Run automated validation checks on a proposal',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'ValidationResult',
    examples: [
      'proposal_validate("#g02p07llm") - Validate proposal'
    ]
  },
  {
    name: 'proposal_approve',
    description: 'Approve a completed proposal (status: in_progress -> completed)',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'void',
    examples: [
      'proposal_approve("#g02p07llm") - Approve proposal'
    ]
  },
  {
    name: 'proposal_reject',
    description: 'Reject a proposal (status: in_progress -> rejected)',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'void',
    examples: [
      'proposal_reject("#g02p07llm") - Reject proposal'
    ]
  },
  {
    name: 'arch_generate',
    description: 'Generate all architecture diagrams for the project',
    parameters: [],
    returnType: 'void',
    examples: [
      'arch_generate() - Generate architecture diagrams'
    ]
  },
  {
    name: 'arch_show',
    description: 'Show a specific type of architecture diagram',
    parameters: [
      {
        name: 'type',
        type: 'string',
        description: 'Diagram type: system, lifecycle, flow, gate-roadmap',
        required: true
      }
    ],
    returnType: 'Diagram',
    examples: [
      'arch_show("system") - Show system overview diagram'
    ]
  },
  {
    name: 'show',
    description: 'Resolve a hash to its entity details',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier to resolve',
        required: true
      }
    ],
    returnType: 'EntityDetails',
    examples: [
      'show("#a3f9c2d1") - Resolve hash to entity'
    ]
  },
  {
    name: 'getTemplate',
    description: 'Load a single template file by name',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Template name (e.g., "gate-prd-template", "proposal-template", "system-overview-template")',
        required: true
      }
    ],
    returnType: 'string',
    examples: [
      'getTemplate("gate-prd-template") - Load gate PRD template',
      'getTemplate("proposal-template") - Load proposal template',
      'getTemplate("system-overview-template") - Load system architecture diagram template'
    ]
  },
  {
    name: 'template_list',
    description: 'List all available templates',
    parameters: [],
    returnType: 'Template[]',
    examples: [
      'template_list() - List available templates'
    ]
  },
  {
    name: 'template_get',
    description: 'Get a template by name',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Template name to retrieve',
        required: true
      }
    ],
    returnType: 'string',
    examples: [
      'template_get("gate-prd-template") - Get template content'
    ]
  },
  {
    name: 'template_context',
    description: 'Get template formatted for LLM context injection',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Template name to retrieve',
        required: true
      }
    ],
    returnType: 'string',
    examples: [
      'template_context("proposal-template") - Get template context for LLMs'
    ]
  },
  {
    name: 'loadAllTemplates',
    description: 'Load all 16 templates as a key-value map',
    parameters: [],
    returnType: 'Record<string, string>',
    examples: [
      'loadAllTemplates() - Get all available templates'
    ]
  },
  {
    name: 'getTemplatesByCategory',
    description: 'Get all templates of a specific category',
    parameters: [
      {
        name: 'category',
        type: 'string',
        description: 'Template category: "markdown" or "architecture"',
        required: true
      }
    ],
    returnType: 'Template[]',
    examples: [
      'getTemplatesByCategory("markdown") - Get all markdown templates',
      'getTemplatesByCategory("architecture") - Get all architecture templates'
    ]
  },
  {
    name: 'config_get',
    description: 'Get project configuration values from zeno/.zeno/config.json',
    parameters: [],
    returnType: 'ZenoConfig',
    examples: [
      'config_get() - Get all configuration values'
    ]
  }
]