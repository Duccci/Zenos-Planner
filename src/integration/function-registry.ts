/**
 * Zeno Function Signature Registry
 *
 * Registry of all Zeno functions that LLMs can invoke.
 * Provides function signatures in a format compatible with LLM function calling APIs.
 */

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
    name: 'req_status',
    description: 'Update the status of a requirement',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the requirement',
        required: true
      },
      {
        name: 'status',
        type: 'string',
        description: 'New status: pending, implemented, tested',
        required: true
      }
    ],
    returnType: 'void',
    examples: [
      'req_status("#a3f9c2d1", "implemented") - Mark requirement as implemented'
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
  }
]