/**
 * Proposal Operations Registry
 *
 * Registers all proposal-related operations with the function registry.
 * Handles: list, show, start, validate, approve, reject
 */

/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unnecessary-condition */
import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { syncProposalsFromDisk } from '../storage/proposal-sync.js'
import { normalizeDateTime } from '../utils/datetime.js'

export function registerProposalsOps(registry: FunctionRegistry): void {
  registry.register(
    'proposal_list',
    async (params) => {
      const validated = z
        .object({
          gateId: z.string().optional(),
          status: z.string().optional(),
        })
        .parse(params)

      const db = (await import('../storage/database.js')).getDatabase()

      // Always sync from disk first so we surface newly-written proposal files
      // without requiring a restart.  Lifecycle state (status, approved_at)
      // is authoritative in the DB; the sync only adds missing rows.
      syncProposalsFromDisk(db)

      let query = 'SELECT id, gate_id, title, status, hash, created_at, approved_at FROM proposals'
      const conditions: string[] = []
      const queryParams: (string | null)[] = []

      if (validated.gateId) {
        conditions.push('gate_id LIKE ?')
        queryParams.push(`%${validated.gateId}%`)
      }
      if (validated.status) {
        conditions.push('status = ?')
        queryParams.push(validated.status)
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ')
      }
      query += ' ORDER BY created_at DESC'

      const allRows = db.prepare(query).all(...queryParams) as Record<string, unknown>[]
      // Filter rows that have valid required fields.
      // gate_id is nullable — NULL means solitary; do NOT exclude those rows.
      const validRows = allRows.filter(
        (row) =>
          row['hash'] &&
          typeof row['hash'] === 'string' &&
          row['created_at'] &&
          typeof row['created_at'] === 'string'
      )

      return {
        proposals: validRows.map((row) => ({
          hash: row['hash'] as string,
          title: (row['title'] as string) ?? '',
          description: (row['description'] as string) ?? undefined,
          status: (row['status'] as string) ?? 'pending',
          gateId: (row['gate_id'] as string | null) ?? 'solitary',
          tasksCompleted: 0,
          totalTasks: 0,
          created: normalizeDateTime(row['created_at'] as string | null),
          completedAt: row['approved_at'] ? normalizeDateTime(row['approved_at'] as string) : null,
        })),
      }
    },
    {
      description: 'List proposals, optionally filtered by gate or status',
      parameters: [
        {
          name: 'gateId',
          type: 'string',
          description: 'Optional gate ID to filter proposals',
          required: false,
        },
        {
          name: 'status',
          type: 'string',
          description: 'Optional status filter: pending, in_progress, completed, rejected, cancelled, backlog',
          required: false,
        },
      ],
      returnType: 'ProposalListOutput',
      schema: z.object({
        gateId: z.string().optional(),
        status: z.string().optional(),
      }),
    }
  )

  registry.register(
    'proposal_cancel',
    async (params) => {
      const validated = z.object({ hash: z.string(), reason: z.string().optional() }).parse(params)
      const db = (await import('../storage/database.js')).getDatabase()
      const normalizedHash = validated.hash.startsWith('#') ? validated.hash.slice(1) : validated.hash
      const proposal = db.prepare('SELECT hash, status FROM proposals WHERE hash = ? OR hash LIKE ?').get(normalizedHash, `${normalizedHash}%`) as Record<string, unknown> | undefined
      if (!proposal) throw new Error(`Proposal not found: ${validated.hash}`)
      const previousStatus = proposal['status'] as string
      db.prepare("UPDATE proposals SET status = 'cancelled', updated_at = ? WHERE hash = ?").run(new Date().toISOString(), proposal['hash'] as string)
      return { hash: proposal['hash'] as string, previousStatus, newStatus: 'cancelled', cancelledAt: new Date().toISOString(), reason: validated.reason }
    },
    {
      description: 'Cancel a proposal (mark as cancelled/dropped)',
      parameters: [
        { name: 'hash', type: 'string', description: 'Proposal hash', required: true },
        { name: 'reason', type: 'string', description: 'Optional reason for cancellation', required: false },
      ],
      returnType: 'ProposalCancelOutput',
      schema: z.object({ hash: z.string(), reason: z.string().optional() }),
    }
  )

  registry.register(
    'proposal_defer',
    async (params) => {
      const validated = z.object({ hash: z.string(), reason: z.string().optional() }).parse(params)
      const db = (await import('../storage/database.js')).getDatabase()
      const normalizedHash = validated.hash.startsWith('#') ? validated.hash.slice(1) : validated.hash
      const proposal = db.prepare('SELECT hash, status FROM proposals WHERE hash = ? OR hash LIKE ?').get(normalizedHash, `${normalizedHash}%`) as Record<string, unknown> | undefined
      if (!proposal) throw new Error(`Proposal not found: ${validated.hash}`)
      const previousStatus = proposal['status'] as string
      db.prepare("UPDATE proposals SET status = 'backlog', updated_at = ? WHERE hash = ?").run(new Date().toISOString(), proposal['hash'] as string)
      return { hash: proposal['hash'] as string, previousStatus, newStatus: 'backlog', deferredAt: new Date().toISOString(), reason: validated.reason }
    },
    {
      description: 'Defer a proposal to backlog (off main implementation path, revisit later)',
      parameters: [
        { name: 'hash', type: 'string', description: 'Proposal hash', required: true },
        { name: 'reason', type: 'string', description: 'Optional reason for deferral', required: false },
      ],
      returnType: 'ProposalDeferOutput',
      schema: z.object({ hash: z.string(), reason: z.string().optional() }),
    }
  )

  registry.register(
    'proposal_show',
    async (params) => {
      const validated = z.object({ hash: z.string() }).parse(params)

      const db = (await import('../storage/database.js')).getDatabase()
      const normalizedHash = validated.hash.startsWith('#')
        ? validated.hash.slice(1)
        : validated.hash

      const proposal = db
        .prepare('SELECT * FROM proposals WHERE hash = ? OR hash LIKE ?')
        .get(normalizedHash, `${normalizedHash}%`) as Record<string, unknown> | undefined

      if (!proposal) {
        throw new Error(`Proposal not found: ${validated.hash}`)
      }

      // Parse JSON fields safely
      let filesAffected: string[] = []
      try {
        if (proposal['files_affected']) {
          filesAffected = JSON.parse(proposal['files_affected'] as string) as string[]
        }
      } catch {
        /* ignore parse errors */
      }

      let deps: string[] = []
      try {
        if (proposal['dependencies']) {
          deps = JSON.parse(proposal['dependencies'] as string) as string[]
        }
      } catch {
        /* ignore parse errors */
      }

      // Attempt to read task count from proposal file for bounds checking
      let parsedTasks: { title: string; completed: boolean }[] = []
      try {
        const { findProposalByHash } = await import('../utils/artifact-locator.js')
        const { readFile } = await import('../utils/file.js')
        const proposalFilePath = await findProposalByHash(normalizedHash)
        if (proposalFilePath) {
          const proposalContent = await readFile(proposalFilePath)
          const taskHeaderMatches = proposalContent.match(/###\s+Task\s+\d+:[^\n]*/g)
          if (taskHeaderMatches) {
            parsedTasks = taskHeaderMatches.map((h) => ({
              title: h.replace(/###\s+Task\s+\d+:\s*/, '').trim(),
              completed: false,
            }))
          }
        }
      } catch {
        // File read failure is non-critical; tasks defaults to []
      }

      return {
        hash: (proposal['hash'] as string) || 'unknown00',
        title: (proposal['title'] as string) ?? '',
        description: (proposal['summary'] as string) ?? (proposal['title'] as string) ?? '',
        status: (proposal['status'] as string) ?? 'pending',
        gateId: (proposal['gate_id'] as string | null) ?? 'solitary',
        solitary: !(proposal['gate_id'] as string | null) || (proposal['gate_id'] as string) === 'solitary',
        summary: (proposal['summary'] as string) ?? undefined,
        context: undefined,
        tasks: parsedTasks,
        dependencies:
          deps.length > 0 ? deps.map((d) => ({ hash: d, type: 'depends_on' as const })) : undefined,
        files:
          filesAffected.length > 0
            ? filesAffected.map((f) => ({ path: f, action: 'modify' as const }))
            : undefined,
        created: normalizeDateTime(proposal['created_at'] as string | null),
        completedAt: proposal['approved_at'] ? normalizeDateTime(proposal['approved_at'] as string) : null,
      }
    },
    {
      description: 'Show detailed information about a specific proposal',
      parameters: [
        {
          name: 'hash',
          type: 'string',
          description: 'The hash identifier of the proposal',
          required: true,
        },
      ],
      returnType: 'ProposalDetail',
      schema: z.object({
        hash: z.string().min(1, 'Hash is required'),
      }),
    }
  )

  // Create a new proposal and register it in the proposals database

  registry.register(
    'proposal_create',
    async (params) => {
      const { ProposalCreateInputSchema } =
        await import('../mcp/schemas/proposal-create-schemas.js')
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

      // Check if gate exists in project-overview.json (gates are no longer stored in DB)
      if (validated.gateId) {
        try {
          const { readProjectOverview, getGatesFromOverview } = await import('../utils/config.js')
          const overview = await readProjectOverview()
          const gateExists = getGatesFromOverview(overview).some((g) => g.id === validated.gateId)
          if (!gateExists) {
            warnings.push(`Gate ${validated.gateId} not found in project overview`)
          }
        } catch {
          // overview unavailable — skip gate validation
        }
      }

      /* eslint-disable @typescript-eslint/no-unnecessary-type-conversion */
      // Validate solitary vs gate-tied
      if (validated.solitary && validated.gateId) {
        errors.push('Proposal cannot be both solitary and gate-tied')
      }
      const hasGateId = Boolean(validated.gateId)
      const isSolitary = Boolean(validated.solitary)
      // Ensure either solitary or gateId is provided
      if (!hasGateId && !isSolitary) {
        errors.push('Proposal must either be solitary or have a gateId')
      }
      /* eslint-enable @typescript-eslint/no-unnecessary-type-conversion */

      // Run dependency validator if dependencies provided
      if (validated.dependencies && validated.dependencies.length > 0) {
        const db = (await import('../storage/database.js')).getDatabase()
        const allNodes = new Map<
          string,
          { hash: string; dependencies: string[]; gateId?: string }
        >()

        // Build dependency graph from database
        const allProposals = db
          .prepare('SELECT hash, dependencies, gate_id FROM proposals')
          .all() as { hash: string; dependencies?: string; gate_id?: string }[]
        for (const p of allProposals) {
          allNodes.set(p.hash, {
            hash: p.hash,
            dependencies: p.dependencies ? (JSON.parse(p.dependencies) as string[]) : [],
            gateId: p.gate_id ?? undefined,
          })
        }

        // Add current proposal node
        const currentNode = {
          hash,
          dependencies: validated.dependencies,
          gateId: validated.gateId ?? undefined,
        }
        allNodes.set(hash, currentNode)

        const depValidation = validateDependencies({
          node: currentNode as Parameters<typeof validateDependencies>[0]['node'],
          allNodes: allNodes as Parameters<typeof validateDependencies>[0]['allNodes'],
        })
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
      const createdDate = new Date().toISOString().split('T')[0] ?? ''
      const gateLabel = validated.gateId ?? 'Solitary'
      proposalContent = proposalContent
        .replace(/\[Proposal Title\]/g, validated.title)
        .replace(/\[Generated SHA-256 first 16 chars\]/g, hash)
        .replace(/\[DATE\]/g, createdDate)
        .replace(/\[Gate ID\] - \[Gate Name\]/g, gateLabel)
        .replace(/pending \| in_progress \| completed \| rejected/g, 'pending')
        .replace(/\*\*Requirement\*\*: #\[Requirement Hash\] \(optional - may address gate-level objective\) {2}\n/g, '')

      // Update summary section
      proposalContent = proposalContent.replace(
        /\[2-3 sentence description of what this proposal accomplishes\. Focus on the outcome, not the process\.\]/,
        validated.summary
      )

      // Build tasks section
      const tasksSection = validated.tasks
        .map((task, index) => {
          const ac = Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : []
          const criteria = ac.map((c) => `- [ ] ${c}`).join('\n')
          const phase = task.phase ?? 'GREEN'
          const filesStr = task.files?.length
            ? task.files.map((f) => `\`${f}\``).join(' | ')
            : '`src/[module]/[file].ts`'
          const action = task.action ?? 'modify'
          return [
            `### Task ${String(index + 1)}: ${task.description}`,
            '',
            `**Phase**: ${phase}  `,
            `**File(s)**: ${filesStr}  `,
            `**Action**: ${action}`,
            '',
            task.description,
            '',
            '**Acceptance**:',
            criteria.length ? criteria : '- [ ] Implementation complete',
            '',
            '---',
          ].join('\n')
        })
        .join('\n\n')

      proposalContent = proposalContent.replace(
        /### Task 1:[\s\S]*?---\n\n### Task 2:[\s\S]*?---\n\n### Task 3:[\s\S]*?---/,
        tasksSection
      )

      // Build files affected section
      const filesSection = validated.filesAffected
        .map((file) => `| \`${file}\` | - | modify | Implementation file |`)
        .join('\n')

      if (filesSection) {
        const filesSectionContent = filesSection
        proposalContent = proposalContent.replace(
          /\| File\s*\| Phase\s*\| Action\s*\| Description\s*\|[\s\S]*?\n---/,
          `| File | Phase | Action | Description |\n| ---- | ----- | ------ | ----------- |\n${filesSectionContent}\n\n---`
        )
      }

      // Replace context placeholder when context is provided
      if (validated.context) {
        proposalContent = proposalContent.replace(
          '[1-2 sentences explaining the problem or need this addresses. Reference the gate objective or requirement.]',
          validated.context
        )
      }

      // Determine file path based on gate-tied vs solitary
      let filePath: string
      if (validated.solitary) {
        // Solitary: zeno/proposals/solitary/YYYY-MM-DD-NN-name.md
        const date = createdDate
        const slug = validated.title
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '')
        const fileName = `${date}-01-${slug}.md`
        filePath = join(process.cwd(), 'zeno', 'proposals', 'solitary', fileName)
      } else {
        // Gate-tied: zeno/proposals/gate-XX/NN-name.md
        const gateNumMatch = validated.gateId ? /\d+/.exec(validated.gateId)?.[0] : undefined
        const gateNum = gateNumMatch ?? '00'
        const slug = validated.title
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '')
        const fileName = `01-${slug}.md`
        filePath = join(
          process.cwd(),
          'zeno',
          'proposals',
          `gate-${gateNum.padStart(2, '0')}`,
          fileName
        )
      }

      // Write proposal file
      await writeFile(filePath, proposalContent, 'utf-8')

      // Sync the new file into the DB so proposal_show resolves it immediately.
      try {
        const db = (await import('../storage/database.js')).getDatabase()
        syncProposalsFromDisk(db)
      } catch {
        // Non-fatal — file was written; DB will be synced on next startup
      }

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
        tasks: z.array(
          z.object({ description: z.string(), acceptanceCriteria: z.array(z.string()).optional() })
        ),
        filesAffected: z.array(z.string()).optional(),
        context: z.string().optional(),
        dependencies: z.array(z.string()).optional(),
      }),
    }
  )

  registry.register(
    'proposal_start',
    async (params) => {
      const validated = z.object({ hash: z.string(), startedBy: z.string().optional() }).parse(params)

      // Validate artifact before starting (user may have edited it)
      const { validateArtifactFile } = await import('../mcp/validators/artifact-validator.js')
      const { getGitUserInfo } = await import('../utils/git.js')
      const db = (await import('../storage/database.js')).getDatabase()

      // Get proposal details to find its file path
      const proposal = db
        .prepare('SELECT * FROM proposals WHERE hash = ? OR hash LIKE ?')
        .get(validated.hash, `${validated.hash}%`) as Record<string, unknown> | undefined

      if (!proposal) {
        throw new Error(`Proposal not found: ${validated.hash}`)
      }

      const projectRoot = process.cwd()
      const gateFolder = (proposal['gate_id'] as string | null) ?? 'solitary'
      const defaultPath = `zeno/proposals/${gateFolder}/${((proposal['title'] as string) ?? 'proposal').replace(/\s+/g, '-').toLowerCase()}.md`
      const proposalPath: string = (proposal['file_path'] as string | undefined) ?? defaultPath

      try {
        const validationResult = await validateArtifactFile(
          projectRoot + '/' + proposalPath,
          'proposal',
          'all',
          {
            gateId: proposal['gate_id'] as string,
            hash: validated.hash,
          }
        )

        if (!validationResult.allowed) {
          throw new Error(
            `Proposal artifact validation failed:\n${validationResult.errors?.join('\n') ?? 'Unknown error'}`
          )
        }

        if (validationResult.warnings) {
          console.warn('Proposal validation warnings:', validationResult.warnings)
        }
      } catch (err) {
        throw new Error(`Failed to validate proposal before starting: ${String(err)}`)
      }

      // Pull git user info if not provided
      let startedBy = validated.startedBy
      if (!startedBy) {
        try {
          const gitUser = await getGitUserInfo(projectRoot)
          startedBy = gitUser.name ?? gitUser.email ?? undefined
        } catch {
          // Silently ignore git user pull errors; startedBy remains optional
        }
      }

      // Capture previous status before transition
      const currentRow = db
        .prepare('SELECT status FROM proposals WHERE hash = ? OR hash LIKE ?')
        .get(validated.hash, `${validated.hash}%`) as { status: string } | undefined
      const previousStatus = currentRow?.status ?? 'pending'

      const { startProposal } = await import('../core/completions.js')
      await startProposal(validated.hash, { startedBy })

      return {
        hash: validated.hash,
        previousStatus,
        newStatus: 'in_progress' as const,
        startedAt: new Date().toISOString(),
      }
    },
    {
      description: 'Start implementation of a proposal (status: pending -> in_progress)',
      parameters: [
        {
          name: 'hash',
          type: 'string',
          description: 'The hash identifier of the proposal',
          required: true,
        },
      ],
      returnType: 'void',
      schema: z.object({
        hash: z.string().min(1, 'Hash is required'),
      }),
    }
  )

  registry.register(
    'proposal_validate',
    async (params) => {
      const validated = z.object({ hash: z.string() }).parse(params)

      // Import validators
      const { validateDependencies } = await import('../mcp/validators/dependency-validator.js')
      const { validateQuality } = await import('../mcp/validators/quality-validator.js')
      const { validateProposalPhases } =
        await import('../mcp/validators/proposal-phases-validator.js')
      const { readFile } = await import('../utils/file.js')

      const errors: string[] = []
      const warnings: string[] = []

      // Load proposal from database
      const db = (await import('../storage/database.js')).getDatabase()
      interface ProposalRow {
        hash: string
        title?: string
        dependencies?: string | null
        gate_id?: string | null
        quality_metrics?: string | null
        files_affected?: string | null
        created_at?: string
      }
      const proposal = db.prepare('SELECT * FROM proposals WHERE hash = ?').get(validated.hash) as
        | ProposalRow
        | undefined

      if (!proposal) {
        throw new Error(`Proposal ${validated.hash} not found`)
      }

      // Proposal phases validation - check for multi-phased proposals
      try {
        // Try to find and read the proposal file to check for multi-phase language
        const { findProposalByHash } = await import('../utils/artifact-locator.js')
        const proposalFilePath = await findProposalByHash(validated.hash)

        if (proposalFilePath) {
          const proposalContent = await readFile(proposalFilePath)

          // Extract proposal sections
          const titleMatch = /^#\s+Proposal:\s+(.+)$/m.exec(proposalContent)
          const summaryMatch = /## Summary\s*\n([\s\S]*?)(?=\n##|\n---|\n$)/.exec(proposalContent)
          const implNotesMatch = /## Implementation Notes\s*\n([\s\S]*?)(?=\n##|\n---|\n$)/.exec(
            proposalContent
          )
          const tasksMatch = /## Tasks\s*\n([\s\S]*?)(?=\n##|\n---|\n$)/.exec(proposalContent)
          const rollbackMatch = /## Rollback\s*\n([\s\S]*?)(?=\n##|\n---|\n$)/.exec(proposalContent)

          const title = titleMatch?.[1] ?? proposal.title ?? ''
          const summary = summaryMatch?.[1]?.trim() ?? ''
          const implementationNotes = implNotesMatch?.[1]?.trim()
          const taskDescriptions = tasksMatch?.[1]
            ? tasksMatch[1].split(/###\s+Task\s+\d+:/).filter((t) => t.trim())
            : []
          const rollback = rollbackMatch?.[1]?.trim()

          const phasesValidation = validateProposalPhases({
            title,
            summary,
            implementationNotes,
            taskDescriptions,
            rollback,
          })

          if (phasesValidation.errors) errors.push(...phasesValidation.errors)
          if (phasesValidation.warnings) warnings.push(...phasesValidation.warnings)
        }
      } catch (err) {
        // If we can't read the file or proposal locator doesn't exist, skip phase validation
        // This is non-critical and shouldn't block the entire validation
        const errMsg = err instanceof Error ? err.message : String(err)
        if (!errMsg.includes('ENOENT') && !errMsg.includes('not found')) {
          warnings.push(`Could not validate proposal phases: ${errMsg}`)
        }
      }

      // Parse JSON fields
      const dependencies = proposal.dependencies
        ? (JSON.parse(proposal.dependencies) as string[])
        : []

      // Dependency validation
      if (dependencies.length > 0) {
        interface DepNode {
          hash: string
          dependencies: string[]
          gateId?: string
        }
        const allNodes = new Map<string, DepNode>()
        const allProposals = db
          .prepare('SELECT hash, dependencies, gate_id FROM proposals')
          .all() as { hash: string; dependencies?: string | null; gate_id?: string | null }[]

        for (const p of allProposals) {
          allNodes.set(p.hash, {
            hash: p.hash,
            dependencies: p.dependencies ? (JSON.parse(p.dependencies) as string[]) : [],
            gateId: p.gate_id ?? undefined,
          } as DepNode)
        }

        const depValidation = validateDependencies({
          node: {
            hash: proposal.hash,
            dependencies,
            gateId: proposal.gate_id ?? undefined,
          },
          allNodes,
        })

        if (depValidation.errors) errors.push(...depValidation.errors)
        if (depValidation.warnings) warnings.push(...depValidation.warnings)
      }

      // Quality validation (if metrics available)
      const qualityMetrics: Record<string, unknown> | null = proposal.quality_metrics
        ? (JSON.parse(proposal.quality_metrics) as Record<string, unknown>)
        : null

      if (qualityMetrics) {
        const qualityValidation = await validateQuality({
          metrics: qualityMetrics,
        })

        if (qualityValidation.errors) errors.push(...qualityValidation.errors)
        if (qualityValidation.warnings) warnings.push(...qualityValidation.warnings)
      }

      return {
        hash: validated.hash,
        passed: errors.length === 0,
        issues: [
          ...errors.map(msg => ({ level: 'error' as const, category: 'validation', message: msg })),
          ...warnings.map(msg => ({ level: 'warning' as const, category: 'validation', message: msg })),
        ],
      }
    },
    {
      description: 'Run automated validation checks on a proposal',
      parameters: [
        {
          name: 'hash',
          type: 'string',
          description: 'The hash identifier of the proposal',
          required: true,
        },
      ],
      returnType: 'ValidationResult',
      schema: z.object({
        hash: z.string().min(1, 'Hash is required'),
      }),
    }
  )

  registry.register(
    'proposal_approve',
    async (params) => {
      const validated = z
        .object({ hash: z.string(), writeback: z.boolean().optional() })
        .parse(params)

      // Import validators
      const { validateApplyPhase } = await import('../mcp/validators/apply-phase-validator.js')
      const { validateQuality } = await import('../mcp/validators/quality-validator.js')
      const { loadConfig } = await import('../utils/config.js')
      const { getGitUserInfo } = await import('../utils/git.js')

      // Load proposal from database
      const db = (await import('../storage/database.js')).getDatabase()
      interface ProposalRow {
        hash: string
        dependencies?: string | null
        gate_id?: string | null
        quality_metrics?: string | null
        files_affected?: string | null
      }
      const proposal = db.prepare('SELECT * FROM proposals WHERE hash = ?').get(validated.hash) as
        | ProposalRow
        | undefined

      if (!proposal) {
        throw new Error(`Proposal ${validated.hash} not found`)
      }

      // Parse JSON fields
      const qualityMetrics = proposal.quality_metrics
        ? (JSON.parse(proposal.quality_metrics) as Record<string, unknown>)
        : {}
      const filesAffectedParsed: string[] = proposal.files_affected
        ? (JSON.parse(proposal.files_affected) as string[])
        : []

      // Load config for validation
      const config = await loadConfig()

      // Run apply-phase validation (no git operations, files in scope)
      const applyValidation = validateApplyPhase({
        proposalHash: validated.hash,
        filesAffected: filesAffectedParsed,
        filesModified: filesAffectedParsed, // Assume all declared files were modified
        gitOperations: [], // TODO: detect actual git operations during apply
        qualityMetrics,
        config,
      })

      if (!applyValidation.allowed) {
        throw new Error(`Proposal approval blocked:\n${applyValidation.errors?.join('\n') ?? ''}`)
      }

      // Run quality validation before approval
      // Quality metrics must come from the target project's own quality checks
      const qualityValidation = await validateQuality({
        metrics: qualityMetrics as Record<string, number>,
      })

      if (!qualityValidation.allowed) {
        throw new Error(
          `Quality thresholds not met. Target project must meet quality requirements:\n${qualityValidation.errors?.join('\n') ?? ''}`
        )
      }

      // Pull git user info to get approver name
      let approvedBy: string | undefined
      try {
        const gitUser = await getGitUserInfo(process.cwd())
        approvedBy = gitUser.name ?? gitUser.email ?? undefined
      } catch {
        // Silently ignore git user pull errors; approvedBy remains undefined
      }

      // Capture previous status before transition
      const currentStatus = (proposal as unknown as Record<string, unknown>)['status'] as string ?? 'in_progress'

      // Proceed with approval — call approveProposal directly to avoid invokeCommand recursion
      const { approveProposal } = await import('../core/completions.js')
      await approveProposal(validated.hash, { approver: approvedBy })

      // Option 5: writeback — patch **Status**: completed into the .md source file when
      // the caller explicitly opts in.  The .md is the user's source of truth; we never
      // mutate it automatically so as not to surprise users who track the file in git.
      let wroteBack = false
      if (validated.writeback) {
        try {
          const { findProposalByHash } = await import('../utils/artifact-locator.js')
          const { readFileSync, writeFileSync } = await import('node:fs')
          const filePath = await findProposalByHash(validated.hash)
          if (filePath) {
            const content = readFileSync(filePath, 'utf-8')
            const updated = content.replace(/(\*\*Status\*\*:\s*)[a-z_]+/, '$1completed')
            writeFileSync(filePath, updated, 'utf-8')
            wroteBack = true
          }
        } catch {
          // Non-fatal: writeback failure should not abort the approval result
        }
      }

      return {
        hash: validated.hash,
        previousStatus: currentStatus,
        newStatus: 'completed' as const,
        approvedAt: new Date().toISOString(),
        wroteBack,
      }
    },
    {
      description: 'Approve a completed proposal (status: in_progress -> completed)',
      parameters: [
        {
          name: 'hash',
          type: 'string',
          description: 'The hash identifier of the proposal',
          required: true,
        },
        {
          name: 'writeback',
          type: 'boolean',
          description:
            'When true, patch **Status**: completed back into the proposal .md file. ' +
            'Only pass when user explicitly requests file\u2194DB reconciliation. Default false.',
          required: false,
        },
      ],
      returnType: 'void',
      schema: z.object({
        hash: z.string().min(1, 'Hash is required'),
        writeback: z.boolean().optional(),
      }),
    }
  )

  registry.register(
    'proposal_reject',
    async (params) => {
      const validated = z
        .object({ hash: z.string(), rejectionReason: z.string().optional(), rejectedBy: z.string().optional() })
        .parse(params)

      const { getGitUserInfo } = await import('../utils/git.js')

      // Pull git user info if not provided
      let rejectedBy = validated.rejectedBy
      if (!rejectedBy) {
        try {
          const gitUser = await getGitUserInfo(process.cwd())
          rejectedBy = gitUser.name ?? gitUser.email ?? undefined
        } catch {
          // Silently ignore git user pull errors; rejectedBy remains optional
        }
      }

      // Capture previous status before transition
      const db = (await import('../storage/database.js')).getDatabase()
      const currentRow = db
        .prepare('SELECT status FROM proposals WHERE hash = ? OR hash LIKE ?')
        .get(validated.hash, `${validated.hash}%`) as { status: string } | undefined
      const previousStatus = currentRow?.status ?? 'in_progress'

      const { rejectProposal } = await import('../core/completions.js')
      await rejectProposal(validated.hash, { rejectedBy, rejectionReason: validated.rejectionReason })

      return {
        hash: validated.hash,
        previousStatus,
        newStatus: 'rejected' as const,
        rejectedAt: new Date().toISOString(),
        reason: validated.rejectionReason ?? 'No reason provided',
      }
    },
    {
      description: 'Reject a proposal (status: in_progress -> rejected)',
      parameters: [
        {
          name: 'hash',
          type: 'string',
          description: 'The hash identifier of the proposal',
          required: true,
        },
      ],
      returnType: 'void',
      schema: z.object({
        hash: z.string().min(1, 'Hash is required'),
      }),
    }
  )
}
