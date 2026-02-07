/**
 * Proposal Operations Registry
 *
 * Registers all proposal-related operations with the function registry.
 * Handles: list, show, start, validate, approve, reject
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { invokeCommand } from './command-invoker.js'

export function registerProposalsOps(registry: FunctionRegistry): void {
  registry.register('proposal_list', async (params) => {
    const validated = z.object({
      gateId: z.string().optional(),
      status: z.string().optional()
    }).parse(params)
    const result = await invokeCommand('proposal_list', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
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
    schema: z.object({
      gateId: z.string().optional(),
      status: z.string().optional()
    })
  })

  registry.register('proposal_show', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('proposal_show', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
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
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  // Create a new proposal and register it in the proposals database
  registry.register(
    'proposal_create',
    async (params) => {
      const { ProposalCreateInputSchema } = await import('../mcp/schemas/proposal-create-schemas.js')
      const validated = ProposalCreateInputSchema.parse(params)

      const { shortHash } = await import('../utils/hash.js')
      const { readFile, writeFile } = await import('fs/promises')
      const { join } = await import('path')
      const { validateDependencies } = await import('../mcp/validators/dependency-validator.js')

      // Validation errors and warnings
      const errors: string[] = []
      const warnings: string[] = []

      // Generate 8-character hash
      const hashContent = JSON.stringify({
        title: validated.title,
        summary: validated.summary,
        timestamp: new Date().toISOString(),
      })
      const fullHashValue = shortHash(hashContent) // 16 chars
      const hash = fullHashValue.substring(0, 8) // 8 chars

      // Check if gate exists (if provided)
      if (validated.gateId) {
        const db = (await import('../storage/database.js')).getDatabase()
        const gate = db.prepare('SELECT id FROM gates WHERE id = ?').get(validated.gateId)
        if (!gate) {
          warnings.push(`Gate ${validated.gateId} not found in database`)
        }
      }

      // Validate solitary vs gate-tied
      if (validated.solitary && validated.gateId) {
        errors.push('Proposal cannot be both solitary and gate-tied')
      }
      if (!validated.solitary && !validated.gateId) {
        errors.push('Proposal must either be solitary or have a gateId')
      }

      // Run dependency validator if dependencies provided
      if (validated.dependencies && validated.dependencies.length > 0) {
        const db = (await import('../storage/database.js')).getDatabase()
        const allNodes = new Map<string, any>()

        // Build dependency graph from database
        const allProposals = db.prepare('SELECT hash, dependencies, gate_id FROM proposals').all() as any[]
        for (const p of allProposals) {
          allNodes.set(p.hash, {
            hash: p.hash,
            dependencies: p.dependencies ? JSON.parse(p.dependencies) : [],
            gateId: p.gate_id
          })
        }

        // Add current proposal node
        const currentNode = {
          hash,
          dependencies: validated.dependencies,
          gateId: validated.gateId
        }
        allNodes.set(hash, currentNode)

        const depValidation = validateDependencies({ node: currentNode, allNodes })
        if (depValidation.errors) {
          errors.push(...depValidation.errors)
        }
        if (depValidation.warnings) {
          warnings.push(...depValidation.warnings)
        }
      }

      // If validation failed, return early
      if (errors.length > 0) {
        return {
          hash,
          filePath: '',
          validation: {
            passed: false,
            errors,
            warnings,
          },
          status: 'pending' as const,
          createdAt: new Date().toISOString(),
          gateId: validated.gateId,
          solitary: validated.solitary,
        }
      }

      // Load proposal template
      const templatePath = join(process.cwd(), 'templates', 'md-templates', 'proposal-template.md')
      let proposalContent = await readFile(templatePath, 'utf-8')

      // Replace template placeholders
      const createdDate = new Date().toISOString().split('T')[0]
      proposalContent = proposalContent
        .replace(/\[Proposal Title\]/g, validated.title ?? '')
        .replace(/\[Generated SHA-256 first 16 chars\]/g, hash)
        .replace(/\[DATE\]/g, createdDate ?? '')

      // Update summary section
      proposalContent = proposalContent.replace(
        /\[2-3 sentence description of what this proposal accomplishes\. Focus on the outcome, not the process\.\]/,
        validated.summary
      )

      // Build tasks section
      const tasksSection = validated.tasks
        .map((task, index) => {
          const criteria = task.acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n')
          return `### Task ${index + 1}: ${task.description}\n\n**Acceptance**:\n${criteria || '- [ ] Implementation complete'}\n\n---`
        })
        .join('\n\n')

      proposalContent = proposalContent.replace(
        /### Task 1:[\s\S]*?---\n\n### Task 2:[\s\S]*?---\n\n### Task 3:[\s\S]*?---/,
        tasksSection
      )

      // Build files affected section
      const filesSection = validated.filesAffected
        .map((file) => `| \`${file}\` | modify | Implementation file |`)
        .join('\n')

      if (filesSection) {
        proposalContent = proposalContent.replace(
          /\| File \| Action \| Description \|[\s\S]*?\n---/,
          `| File | Action | Description |\n|------|--------|-------------|\n${filesSection}\n\n---`
        )
      }

      // Determine file path based on gate-tied vs solitary
      let filePath: string
      if (validated.solitary) {
        // Solitary: zeno/proposals/solitary/YYYY-MM-DD-NN-name.md
        const date = createdDate
        const slug = validated.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
        const fileName = `${date}-01-${slug}.md`
        filePath = join(process.cwd(), 'zeno', 'proposals', 'solitary', fileName)
      } else {
        // Gate-tied: zeno/proposals/gate-XX/NN-name.md
        const gateNum = validated.gateId!.match(/\d+/)?.[0] || '00'
        const slug = validated.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
        const fileName = `01-${slug}.md`
        filePath = join(process.cwd(), 'zeno', 'proposals', `gate-${gateNum.padStart(2, '0')}`, fileName)
      }

      // Write proposal file
      await writeFile(filePath, proposalContent, 'utf-8')

      return {
        hash,
        filePath,
        validation: {
          passed: true,
          errors: [],
          warnings,
        },
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        gateId: validated.gateId,
        solitary: validated.solitary,
      }
    },
    {
      description:
        'Create a new proposal with tasks, files affected, and validation. Supports both gate-tied and solitary proposals.',
      parameters: [
        {
          name: 'title',
          type: 'string',
          description: 'Proposal title',
          required: true,
        },
        {
          name: 'summary',
          type: 'string',
          description: '2-3 sentence summary',
          required: true,
        },
        {
          name: 'gateId',
          type: 'string',
          description: 'Gate ID for gate-tied proposals',
          required: false,
        },
        {
          name: 'solitary',
          type: 'boolean',
          description: 'True for solitary proposals (not tied to a gate)',
          required: false,
        },
        {
          name: 'tasks',
          type: 'array',
          description: 'Array of tasks with descriptions and acceptance criteria',
          required: true,
        },
        {
          name: 'filesAffected',
          type: 'array',
          description: 'Array of file paths that will be affected',
          required: false,
        },
        {
          name: 'context',
          type: 'string',
          description: 'Optional proposal context',
          required: false,
        },
        {
          name: 'dependencies',
          type: 'array',
          description: 'Optional array of dependency hashes',
          required: false,
        },
      ],
      returnType: 'ProposalCreateOutput',
      schema: z.object({
        title: z.string().min(1),
        summary: z.string().min(1),
        gateId: z.string().optional(),
        solitary: z.boolean().optional(),
        tasks: z.array(z.object({ description: z.string(), acceptanceCriteria: z.array(z.string()).optional() })),
        filesAffected: z.array(z.string()).optional(),
        context: z.string().optional(),
        dependencies: z.array(z.string()).optional(),
      }),
    }
  )

  registry.register('proposal_start', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('proposal_start', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
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
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  registry.register('proposal_validate', async (params) => {
    const validated = z.object({ hash: z.string(), strict: z.boolean().optional() }).parse(params)

    // Import validators
    const { validateDependencies } = await import('../mcp/validators/dependency-validator.js')
    const { validateQuality } = await import('../mcp/validators/quality-validator.js')
    const { loadConfig } = await import('../utils/config.js')

    const errors: string[] = []
    const warnings: string[] = []

    // Load proposal from database
    const db = (await import('../storage/database.js')).getDatabase()
    const proposal = db.prepare('SELECT * FROM proposals WHERE hash = ?').get(validated.hash) as any

    if (!proposal) {
      throw new Error(`Proposal ${validated.hash} not found`)
    }

    // Parse JSON fields
    const dependencies = proposal.dependencies ? JSON.parse(proposal.dependencies) : []

    // Dependency validation
    if (dependencies.length > 0) {
      const allNodes = new Map<string, any>()
      const allProposals = db.prepare('SELECT hash, dependencies, gate_id FROM proposals').all() as any[]

      for (const p of allProposals) {
        allNodes.set(p.hash, {
          hash: p.hash,
          dependencies: p.dependencies ? JSON.parse(p.dependencies) : [],
          gateId: p.gate_id
        })
      }

      const depValidation = validateDependencies({
        node: {
          hash: proposal.hash,
          dependencies,
          gateId: proposal.gate_id
        },
        allNodes
      })

      if (depValidation.errors) errors.push(...depValidation.errors)
      if (depValidation.warnings) warnings.push(...depValidation.warnings)
    }

    // Quality validation (if metrics available)
    const config = await loadConfig()
    const qualityMetrics = proposal.quality_metrics ? JSON.parse(proposal.quality_metrics) : null

    if (qualityMetrics) {
      const qualityValidation = validateQuality({
        metrics: qualityMetrics,
        config,
        strict: validated.strict
      })

      if (qualityValidation.errors) errors.push(...qualityValidation.errors)
      if (qualityValidation.warnings) warnings.push(...qualityValidation.warnings)
    }

    return {
      hash: validated.hash,
      passed: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  }, {
    description: 'Run automated validation checks on a proposal',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      },
      {
        name: 'strict',
        type: 'boolean',
        description: 'Treat warnings as errors and fail validation',
        required: false
      }
    ],
    returnType: 'ValidationResult',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required'),
      strict: z.boolean().optional()
    })
  })

  registry.register('proposal_approve', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)

    // Import validators
    const { validateApplyPhase } = await import('../mcp/validators/apply-phase-validator.js')
    const { validateQuality } = await import('../mcp/validators/quality-validator.js')
    const { loadConfig } = await import('../utils/config.js')

    // Load proposal from database
    const db = (await import('../storage/database.js')).getDatabase()
    const proposal = db.prepare('SELECT * FROM proposals WHERE hash = ?').get(validated.hash) as any

    if (!proposal) {
      throw new Error(`Proposal ${validated.hash} not found`)
    }

    // Parse JSON fields
    const qualityMetrics = proposal.quality_metrics ? JSON.parse(proposal.quality_metrics) : {}
    const filesAffectedParsed = proposal.files_affected ? JSON.parse(proposal.files_affected) : []

    // Load config for validation
    const config = await loadConfig()

    // Run apply-phase validation (no git operations, files in scope)
    const applyValidation = validateApplyPhase({
      proposalHash: validated.hash,
      filesAffected: filesAffectedParsed,
      filesModified: filesAffectedParsed, // Assume all declared files were modified
      gitOperations: [], // TODO: detect actual git operations during apply
      qualityMetrics,
      config
    })

    if (!applyValidation.allowed) {
      throw new Error(`Proposal approval blocked:\n${applyValidation.errors?.join('\n')}`)
    }

    // Run quality validation
    const qualityValidation = validateQuality({
      metrics: qualityMetrics,
      config,
      strict: true // Strict mode for approval
    })

    if (!qualityValidation.allowed) {
      throw new Error(`Quality thresholds not met:\n${qualityValidation.errors?.join('\n')}`)
    }

    // Proceed with approval
    const result = await invokeCommand('proposal_approve', validated)
    if (!result.success) {
      throw new Error(result.error)
    }

    return {
      hash: validated.hash,
      status: 'approved',
      validation: {
        passed: true,
        warnings: qualityValidation.warnings || []
      }
    }
  }, {
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
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  registry.register('proposal_reject', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('proposal_reject', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
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
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })
}
