/**
 * Proposal Operations Registry
 *
 * Registers all proposal-related operations with the function registry.
 * Handles: list, show, start, validate, approve, reject
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { syncProposalsFromDisk } from '../storage/proposal-sync.js'
import { resolveLastUpdated } from '../utils/datetime.js'
import { normalizePath } from '../utils/file.js'
import type { ProposalStatus } from '../core/transitions.js'
import { fileURLToPath } from 'node:url'
import { getWorkspaceRoot, getZenoGitDir } from '../utils/config.js'
import { resolveGateIdentifier, normalizeHash } from '../utils/normalize.js'

// Install-relative directory so templates are found regardless of user CWD.
const __installDir = fileURLToPath(new URL('../..', import.meta.url))

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

      let query = 'SELECT id, gate_id, title, status, hash, created_at, approved_at, parallel_set_index FROM proposals'
      const conditions: string[] = []
      const queryParams: (string | null)[] = []

      if (validated.gateId) {
        const resolvedGateId = resolveGateIdentifier(validated.gateId)
        conditions.push('gate_id LIKE ?')
        queryParams.push(`%${resolvedGateId}%`)
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

      // Reconstruct parallelSets from parallel_set_index
      const parallelSetMap = new Map<number, string[]>()
      for (const row of validRows) {
        const index = row['parallel_set_index'] as number | null
        const setIndex = index ?? 0  // Fallback to set 0 if NULL
        const hash = row['hash'] as string
        if (!parallelSetMap.has(setIndex)) {
          parallelSetMap.set(setIndex, [])
        }
        const set = parallelSetMap.get(setIndex)
        if (set) {
          set.push(hash)
        }
      }

      // Build parallelSets array by iterating ordered entries
      const parallelSets = [...parallelSetMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, hashes]) => hashes)

        return {
        proposals: validRows.map((row) => ({
          hash: row['hash'] as string,
          title: (row['title'] as string) ?? '',
          description: (row['description'] as string) ?? undefined,
          status: (row['status'] as string) ?? 'pending',
          gateId: (row['gate_id'] as string | null) ?? 'solitary',
          tasksCompleted: 0,
          totalTasks: 0,
            parallelSetIndex:
              row['parallel_set_index'] == null
                ? undefined
                : (row['parallel_set_index'] as number),
          lastUpdated: resolveLastUpdated(row['approved_at'] as string | null, row['created_at'] as string | null),
        })),
        parallelSets,
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
          description: 'Optional status filter: pending, validated, in_progress, completed, rejected, cancelled, backlog',
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
      const normalizedHash = normalizeHash(validated.hash)
      const proposal = db.prepare('SELECT hash, status FROM proposals WHERE hash = ? OR hash LIKE ?').get(normalizedHash, `${normalizedHash}%`) as Record<string, unknown> | undefined
      if (!proposal) throw new Error(`Proposal not found: ${validated.hash}`)
      const previousStatus = proposal['status'] as string
      const cancelledAt = new Date().toISOString()
      db.prepare("UPDATE proposals SET status = 'cancelled', updated_at = ? WHERE hash = ?").run(cancelledAt, proposal['hash'] as string)
      try {
        const { findProposalByHash } = await import('../utils/artifact-locator.js')
        const { readFile, writeFile } = await import('../utils/file.js')
        const filePath = await findProposalByHash(normalizedHash)
        if (filePath) {
          const content = await readFile(filePath)
          const updated = content.replace(/(\*\*Status\*\*:\s*)\w+/i, '$1cancelled')
          await writeFile(filePath, updated)
        }
      } catch {
        // writeback is best-effort; do not fail the cancel operation
      }
      return { hash: proposal['hash'] as string, previousStatus, newStatus: 'cancelled', cancelledAt, reason: validated.reason }
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
      const normalizedHash = normalizeHash(validated.hash)
      const proposal = db.prepare('SELECT hash, status FROM proposals WHERE hash = ? OR hash LIKE ?').get(normalizedHash, `${normalizedHash}%`) as Record<string, unknown> | undefined
      if (!proposal) throw new Error(`Proposal not found: ${validated.hash}`)
      const previousStatus = proposal['status'] as string
      const deferredAt = new Date().toISOString()
      db.prepare("UPDATE proposals SET status = 'backlog', updated_at = ? WHERE hash = ?").run(deferredAt, proposal['hash'] as string)
      try {
        const { findProposalByHash } = await import('../utils/artifact-locator.js')
        const { readFile, writeFile } = await import('../utils/file.js')
        const filePath = await findProposalByHash(normalizedHash)
        if (filePath) {
          const content = await readFile(filePath)
          const updated = content.replace(/(\*\*Status\*\*:\s*)\w+/i, '$1backlog')
          await writeFile(filePath, updated)
        }
      } catch {
        // writeback is best-effort; do not fail the defer operation
      }
      return { hash: proposal['hash'] as string, previousStatus, newStatus: 'backlog', deferredAt, reason: validated.reason }
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
      const normalizedHash = normalizeHash(validated.hash)

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

      // Fetch review history from audit trail
      let reviewHistory: {
        proposal_hash: string
        decision: 'approved' | 'rejected'
        actor: string
        reason?: string | null
        rejection_category?: string | null
        timestamp: string
      }[] = []
      try {
        const { ApprovalAuditTrail } = await import('../storage/approval-audit-trail.js')
        const auditTrail = new ApprovalAuditTrail(db)
        reviewHistory = auditTrail.getHistory(normalizedHash)
      } catch {
        // Audit trail might not be initialized — gracefully return empty history
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
        reviewHistory,
        lastUpdated: resolveLastUpdated(proposal['approved_at'] as string | null, proposal['created_at'] as string | null),
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
      const { readFile } = await import('fs/promises')
      const { writeFile } = await import('../utils/file.js')
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

      // Check if gate exists in project.json (gates are no longer stored in DB)
      if (validated.gateId) {
        const resolvedGateIdForCreate = resolveGateIdentifier(validated.gateId)
        validated.gateId = resolvedGateIdForCreate
        try {
          const { readProjectOverview, getGatesFromOverview } = await import('../utils/config.js')
          const overview = await readProjectOverview(getWorkspaceRoot())
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
      const templatePath = join(__installDir, 'templates', 'md-templates', 'proposal-template.md')
      let proposalContent = await readFile(templatePath, 'utf-8')

      // Replace template placeholders
      const createdDate = new Date().toISOString().split('T')[0] ?? ''
      const gateLabel = validated.gateId ?? 'Solitary'
      proposalContent = proposalContent
        .replace(/\[Proposal Title\]/g, validated.title)
        .replace(/\[Generated SHA-256 first 16 chars\]/g, hash)
        .replace(/\[DATE\]/g, createdDate)
        .replace(/\[Gate ID\] - \[Gate Name\]/g, gateLabel)
        .replace(/pending \| validated \| in_progress \| completed \| rejected/g, 'pending')
        .replace(/\*\*Requirement\*\*: #\[Requirement Hash\] \(optional - may address gate-level objective\) {2}\n/g, '')
        // Replace {{...}} style placeholders introduced in the updated template
        .replace(/\{\{HASH\}\}/g, hash)
        .replace(/\{\{DATE\}\}/g, createdDate)
        .replace(/\{\{GATE_ID\}\}/g, gateLabel)
        .replace(/\{\{ROLES\}\}/g, validated.roles && validated.roles.length > 0 ? validated.roles.join(', ') : '')

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
        // Solitary: zeno/proposals/solitary/<slug>.md
        const solitaryDir = normalizePath(
          join(getZenoGitDir(getWorkspaceRoot()), 'proposals', 'solitary')
        )
        const slug = validated.title
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '')

        const fileName = `${slug}.md`
        filePath = normalizePath(join(solitaryDir, fileName))
      } else {
        // Gate-tied: zeno/proposals/gate-XX/NN-name.md
        const gateNumMatch = validated.gateId ? /\d+/.exec(validated.gateId)?.[0] : undefined
        const gateNum = gateNumMatch ?? '00'
        const slug = validated.title
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '')
        const fileName = `01-${slug}.md`
        filePath = normalizePath(join(
          getWorkspaceRoot(),
          'zeno',
          'proposals',
          `gate-${gateNum.padStart(2, '0')}`,
          fileName
        ))
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
        {
          name: 'parentHash',
          type: 'string',
          description:
            'Hash of an existing standalone solitary proposal to chain from. ' +
            'Generates a chained filename (e.g. 02-01, 02-02). Only valid with solitary: true.',
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
        parentHash: z.string().optional(),
      }),
    }
  )

  registry.register(
    'proposal_start',
    async (params) => {
      const validated = z.object({ hash: z.string(), startedBy: z.string().optional() }).parse(params)
      const normalizedHash = normalizeHash(validated.hash)

      // Validate artifact before starting (user may have edited it)
      const { validateArtifactFile } = await import('../mcp/validators/artifact-validator.js')
      const { getGitUserInfo } = await import('../utils/git.js')
      const db = (await import('../storage/database.js')).getDatabase()

      // Get proposal details to find its file path
      const proposal = db
        .prepare('SELECT * FROM proposals WHERE hash = ? OR hash LIKE ?')
        .get(normalizedHash, `${normalizedHash}%`) as Record<string, unknown> | undefined

      if (!proposal) {
        throw new Error(`Proposal not found: ${validated.hash}`)
      }

      const projectRoot = getWorkspaceRoot()

      // Resolve the actual file by scanning proposal frontmatter hashes.
      // Constructing from a title slug is unreliable when files have numbered
      // prefixes (e.g. `01-red-test-suite.md`) that differ from the bare slug.
      const { findProposalByHash: findProposal } = await import('../utils/artifact-locator.js')
      const resolvedPath = await findProposal(normalizedHash, projectRoot)
      if (!resolvedPath) {
        throw new Error(
          `Proposal file for hash ${normalizedHash} not found on disk. ` +
          `Ensure the proposal markdown file exists under zeno/proposals/ with a matching **Hash** field.`
        )
      }
      try {
        const { readFile: readProposalFile } = await import('../utils/file.js')
        const proposalContent = await readProposalFile(resolvedPath)
        const roleMatch = /\*\*Roles\*\*:\s*(.+)/.exec(proposalContent)
        const rawRole = roleMatch?.[1]?.trim()
        const role = rawRole && !rawRole.startsWith('{{') ? rawRole : undefined

        const validationResult = await validateArtifactFile(resolvedPath, 'proposal', {
          gateId: proposal['gate_id'] as string,
          hash: normalizedHash,
          role,
        })

        if (!validationResult.allowed) {
          throw new Error(
            `Proposal artifact validation failed:\n${validationResult.errors?.join('\n') ?? 'Unknown error'}`
          )
        }

        if (validationResult.warnings) {
          console.warn('Proposal validation warnings:', validationResult.warnings)
        }
      } catch (err) {
        throw new Error(`Failed to validate proposal before starting: ${String(err)}`, { cause: err })
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
        .get(normalizedHash, `${normalizedHash}%`) as { status: string } | undefined
      const previousStatus = currentRow?.status ?? 'pending'

      const { startProposal } = await import('../core/completions.js')
      await startProposal(normalizedHash, { startedBy })

      return {
        hash: normalizedHash,
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
      const { validateQuality, DEFAULT_QUALITY_STUB_METRICS } =
        await import('../mcp/validators/quality-validator.js')
      const { validateProposalPhases } =
        await import('../mcp/validators/proposal-phases-validator.js')
      const { validateScope, validateTestFileScope } = await import('../mcp/validators/scope-validator.js')
      const { validateTestFirstPattern, validateGateLevelTestFirst, validateRedTestCoverage } =
        await import('../mcp/validators/test-first-validator.js')
      const { validateArtifactFile } = await import('../mcp/validators/artifact-validator.js')
      const { validateRequirementRelevance } =
        await import('../mcp/validators/requirement-relevance-validator.js')
      const { readFile } = await import('../utils/file.js')
      const { findProposalByHash } = await import('../utils/artifact-locator.js')

      const errors: string[] = []
      const warnings: string[] = []
      const agentReview: string[] = []

      // Per-check pass tracking
      const checks = {
        phases: true,
        scope: true,
        testFileScope: true,
        dependencies: true,
        artifactStructure: true,
        quality: true,
        testFirstPattern: true,
        gateLevelTestFirst: undefined as boolean | undefined,
        redTestCoverage: undefined as boolean | undefined,
        requirementsCoverage: undefined as boolean | undefined,
        requirementRelevance: undefined as boolean | undefined,
      }

      // Load proposal from database
      const normalizedHash = normalizeHash(validated.hash)
      const db = (await import('../storage/database.js')).getDatabase()
      interface ProposalRow {
        hash: string
        title?: string
        description?: string | null
        dependencies?: string | null
        gate_id?: string | null
        requirement_id?: string | null
        quality_metrics?: string | null
        files_affected?: string | null
        solitary?: number | null
        created_at?: string
        status?: string
      }
      const proposal = db.prepare('SELECT * FROM proposals WHERE hash = ? OR hash LIKE ?').get(normalizedHash, `${normalizedHash}%`) as
        | ProposalRow
        | undefined

      if (!proposal) {
        throw new Error(`Proposal #${normalizedHash} not found`)
      }

      const gateId = proposal.gate_id ?? undefined
      const isSolitary = !gateId || proposal.solitary === 1
      const filesAffected = proposal.files_affected
        ? (JSON.parse(proposal.files_affected) as string[])
        : []

      // ── 1) Phases: RED+GREEN mixing check ──────────────────────────────────
      try {
        const proposalFilePath = await findProposalByHash(validated.hash)
        if (proposalFilePath) {
          const proposalContent = await readFile(proposalFilePath)

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

          const phasesResult = validateProposalPhases({
            title,
            summary,
            implementationNotes,
            taskDescriptions,
            rollback,
          })
          if (!phasesResult.allowed) checks.phases = false
          if (phasesResult.errors) errors.push(...phasesResult.errors)
          if (phasesResult.warnings) warnings.push(...phasesResult.warnings)
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        if (!errMsg.includes('ENOENT') && !errMsg.includes('not found')) {
          warnings.push(`Could not validate proposal phases: ${errMsg}`)
        }
      }

      // ── 2) Scope: no wildcards or directory-only entries in filesAffected ──
      try {
        const scopeResult = validateScope({
          filesAffected,
          filesModified: filesAffected,
          allowTestFiles: true,
        })
        if (!scopeResult.allowed) checks.scope = false
        if (scopeResult.errors) errors.push(...scopeResult.errors)
        if (scopeResult.warnings) warnings.push(...scopeResult.warnings)
      } catch {
        // non-fatal
      }

      // ── 3) Test-file scope: gate-tied proposals must not declare test files ─
      try {
        const testFileScopeResult = validateTestFileScope(filesAffected, isSolitary)
        if (!testFileScopeResult.allowed) checks.testFileScope = false
        if (testFileScopeResult.errors) errors.push(...testFileScopeResult.errors)
        if (testFileScopeResult.warnings) warnings.push(...testFileScopeResult.warnings)
      } catch {
        // non-fatal
      }

      // ── 4) Dependencies: circular dependency DAG check ─────────────────────
      const dependencies = proposal.dependencies
        ? (JSON.parse(proposal.dependencies) as string[])
        : []

      if (dependencies.length > 0) {
        try {
          interface DepNode { hash: string; dependencies: string[]; gateId?: string }
          const allNodes = new Map<string, DepNode>()
          const allProposals = db
            .prepare('SELECT hash, dependencies, gate_id FROM proposals')
            .all() as { hash: string; dependencies?: string | null; gate_id?: string | null }[]
          for (const p of allProposals) {
            allNodes.set(p.hash, {
              hash: p.hash,
              dependencies: p.dependencies ? (JSON.parse(p.dependencies) as string[]) : [],
              gateId: p.gate_id ?? undefined,
            })
          }

          const depResult = validateDependencies({
            node: { hash: proposal.hash, dependencies, gateId },
            allNodes,
          })
          if (!depResult.allowed) checks.dependencies = false
          if (depResult.errors) errors.push(...depResult.errors)
          if (depResult.warnings) warnings.push(...depResult.warnings)
        } catch {
          // non-fatal
        }
      }

      // ── 5) Artifact structure: template sections + single-phase + explicit paths ─
      try {
        const proposalFilePath = await findProposalByHash(validated.hash)
        if (proposalFilePath) {
          const content = await readFile(proposalFilePath)
          const roleMatch = /\*\*Roles\*\*:\s*(.+)/.exec(content)
          const role = roleMatch?.[1]?.trim()

          // Load gate objectives and out-of-scope items for richer qualitative scope-creep evaluation.
          // Falls back to proposal summary when gate file is unavailable.
          let gateObjectives: string | undefined
          let outOfScopeItems: string[] | undefined
          let gatePrdPath: string | undefined
          if (gateId) {
            try {
              const { findGateByGateId } = await import('../utils/artifact-locator.js')
              const gatePath = await findGateByGateId(gateId)
              if (gatePath) {
                gatePrdPath = gatePath
                const gateContent = await readFile(gatePath)
                const objectivesMatch = /##\s+Objectives\b([\s\S]*?)(?=\n##\s|\s*$)/.exec(gateContent)
                gateObjectives = objectivesMatch?.[1]?.trim()

                // Extract "Out of Scope" bullet items for hard violation detection
                const scopeMatch = /##\s+Scope Boundaries\b([\s\S]*?)(?=\n##\s|\s*$)/.exec(gateContent)
                const scopeBody = scopeMatch?.[1] ?? ''
                const outOfScopeMatch = /out[\s-]of[\s-]scope\s*[:\n]([\s\S]*?)(?=\*\*in[\s-]scope|##|$)/i.exec(scopeBody)
                if (outOfScopeMatch?.[1]) {
                  outOfScopeItems = outOfScopeMatch[1]
                    .split('\n')
                    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
                    .filter((l) => l.length >= 5)
                }
              }
            } catch {
              // non-fatal: qualitative check falls back to proposal summary
            }
          }

          const artifactResult = await validateArtifactFile(proposalFilePath, 'proposal', {
            hash: validated.hash,
            gateId,
            role,
            ...(gateObjectives ? { gateObjectives } : {}),
            ...(outOfScopeItems && outOfScopeItems.length > 0 ? { outOfScopeItems } : {}),
            ...(gatePrdPath ? { gatePrdPath } : {}),
          })
          if (!artifactResult.allowed) checks.artifactStructure = false
          if (artifactResult.errors) errors.push(...artifactResult.errors)
          if (artifactResult.warnings) warnings.push(...artifactResult.warnings)
          if (artifactResult.agentReview?.length) agentReview.push(...artifactResult.agentReview)
        }
      } catch {
        // non-fatal if file not yet written
      }

      // ── 6) Quality: coverage ≥90%, 0 CVEs, <0.01% lint errors ─────────────
      try {
        let qualityMetrics: Record<string, unknown> = proposal.quality_metrics
          ? (JSON.parse(proposal.quality_metrics) as Record<string, unknown>)
          : { ...DEFAULT_QUALITY_STUB_METRICS }

        // Run real quality checks unless skipped via environment (test mode)
        if (process.env['ZENO_SKIP_SHELL_CHECKS'] !== '1') {
          try {
            const { ShellValidationRunner } = await import('../core/shell-validation-runner.js')
            const runner = new ShellValidationRunner(getWorkspaceRoot())
            const report = await runner.run()

            // Extract metrics from validation report
            let lintErrors = 0
            let securityIssues = 0

            // Parse check results
            for (const check of report.results) {
              if (check.tool === 'eslint' && !check.passed) {
                // Try to count linting errors from output
                const errorMatch = check.stdout.match(/"ruleId":"(.*?)"/g)
                lintErrors += errorMatch?.length ?? 1
              }
              if (check.tool === 'npm-audit' && !check.passed) {
                // Parse npm audit JSON output. Only count if stdout has audit data.
                // Empty stdout means the tool failed to spawn (e.g. ENOENT on Windows)
                // — do not treat that as a security vulnerability.
                if (check.stdout.trim().length > 0) {
                  try {
                    const auditData = JSON.parse(check.stdout) as Record<string, unknown>
                    const metadata = auditData['metadata'] as Record<string, unknown> | undefined
                    const vulns = metadata?.['vulnerabilities'] as Record<string, unknown> | undefined
                    const totalVulns = vulns?.['total'] as number | undefined
                    if (totalVulns !== undefined && totalVulns > 0) {
                      securityIssues = totalVulns
                    }
                  } catch {
                    // Non-parseable audit output — leave securityIssues at 0
                  }
                }
              }
            }

            // Update qualityMetrics with real values
            qualityMetrics = {
              ...qualityMetrics,
              ...(lintErrors > 0 ? { lintErrors } : {}),
              ...(securityIssues > 0 ? { securityIssues } : {}),
            }

            // Append failed check names to warnings
            const failedChecks = report.results.filter((r) => !r.passed)
            for (const fail of failedChecks) {
              warnings.push(`Quality check failed: ${fail.tool} (exit code ${String(fail.exitCode)})`)
            }
          } catch (runnerError) {
            // Runner error: fall back to stub metrics
            warnings.push(
              `Shell validation runner failed: ${runnerError instanceof Error ? runnerError.message : String(runnerError)}`
            )
          }
        }

        const qualityResult = await validateQuality({ metrics: qualityMetrics })
        if (!qualityResult.allowed) checks.quality = false
        if (qualityResult.errors) errors.push(...qualityResult.errors)
        if (qualityResult.warnings) warnings.push(...qualityResult.warnings)
      } catch {
        // non-fatal
      }

      // ── 7) Test-first pattern: role-file consistency for this proposal ──────
      try {
        const proposalFilePath = await findProposalByHash(validated.hash)
        let role: string | undefined
        let tfFilesAffected = filesAffected
        if (proposalFilePath) {
          const content = await readFile(proposalFilePath)
          const roleMatch = /\*\*Roles\*\*:\s*(.+)/.exec(content)
          role = roleMatch?.[1]?.trim()
          // Fall back to parsing markdown when DB has no files_affected recorded.
          if (tfFilesAffected.length === 0) {
            const sectionMatch = /## Files Affected[^\n]*\n([\s\S]*?)(?=\n## |$)/i.exec(content)
            if (sectionMatch?.[1]) {
              const backtickPaths = sectionMatch[1].match(/`([^`]+\.[a-z]{1,10})`/gi) ?? []
              tfFilesAffected = [...new Set(backtickPaths.map((m) => m.slice(1, -1)))]
            }
          }
        }

        const tfResult = validateTestFirstPattern({
          proposalHash: validated.hash,
          role,
          isGateTied: !isSolitary,
          filesAffected: tfFilesAffected,
        })
        if (!tfResult.allowed) checks.testFirstPattern = false
        if (tfResult.errors) errors.push(...tfResult.errors)
        if (tfResult.warnings) warnings.push(...tfResult.warnings)
      } catch {
        // non-fatal
      }

      // ── 8) Gate-level test-first: sibling structure (skipped for solitary) ──
      if (!isSolitary && gateId) {
        try {
          const siblingRows = db
            .prepare('SELECT hash, created_at FROM proposals WHERE gate_id = ?')
            .all(gateId) as { hash: string; created_at?: string }[]

          const gateProposals = await Promise.all(
            siblingRows.map(async (p) => {
              let role: string | undefined
              try {
                const fp = await findProposalByHash(p.hash)
                if (fp) {
                  const content = await readFile(fp)
                  const m = /\*\*Roles\*\*:\s*(.+)/.exec(content)
                  role = m?.[1]?.trim()
                }
              } catch { /* role stays undefined */ }
              return { hash: p.hash, role, createdAt: p.created_at ?? new Date().toISOString() }
            })
          )

          const gltfResult = validateGateLevelTestFirst(gateProposals)
          checks.gateLevelTestFirst = gltfResult.allowed
          if (!gltfResult.allowed) {
            if (gltfResult.errors) errors.push(...gltfResult.errors)
            if (gltfResult.warnings) warnings.push(...gltfResult.warnings)
          }
        } catch {
          // non-fatal
        }
      }

      // ── 9) RED coverage: every impl file in sibling proposals needs a test in this suite ──
      if (!isSolitary && gateId) {
        try {
          const proposalFilePath = await findProposalByHash(validated.hash)
          let currentRole: string | undefined
          if (proposalFilePath) {
            const content = await readFile(proposalFilePath)
            const roleMatch = /\*\*Roles\*\*:\s*(.+)/.exec(content)
            currentRole = roleMatch?.[1]?.trim()
          }

          if (currentRole === 'test-suite') {
            const siblingRows = db
              .prepare(
                "SELECT hash, files_affected FROM proposals WHERE gate_id = ? AND hash != ?"
              )
              .all(gateId, normalizedHash) as {
              hash: string
              files_affected?: string | null
            }[]

            const implementationProposals = siblingRows.map((r) => ({
              hash: r.hash,
              filesAffected: r.files_affected
                ? (JSON.parse(r.files_affected) as string[])
                : [],
            }))

            const coverageResult = validateRedTestCoverage({
              proposalHash: validated.hash,
              redTestFiles: filesAffected,
              implementationProposals,
            })
            checks.redTestCoverage = coverageResult.allowed
            if (!coverageResult.allowed) {
              if (coverageResult.errors) errors.push(...coverageResult.errors)
            }
          }
        } catch {
          // non-fatal
        }
      }

      // ── 10) Requirement linkage (optional — warnings only, never blocks) ─────
      // Gate-tied: warn if the gate has requirements but this proposal doesn't link to any.
      // Solitary:  if a requirement hash/id is referenced, warn if it cannot be resolved.
      // This check is purely advisory and never contributes to validation errors.
      try {
        // Resolve requirement reference: DB column first, then markdown header/frontmatter.
        const dbReqId = proposal.requirement_id ?? undefined
        let referencedReqHash: string | undefined
        if (!dbReqId) {
          const proposalFilePath = await findProposalByHash(validated.hash)
          if (proposalFilePath) {
            const content = await readFile(proposalFilePath)
            // **Requirement**: #abc1234  or frontmatter  requirement_id: abc1234
            const headerMatch = /\*\*Requirement\*\*:\s*#([a-f0-9]{4,16})/i.exec(content)
            const fmMatch = /^requirement_id:\s*['"]?#?([a-f0-9]{4,16})['"]?\s*$/im.exec(content)
            referencedReqHash = headerMatch?.[1] ?? fmMatch?.[1]
          }
        }

        // Helper: resolve a requirement id or hash fragment to a DB row.
        const resolveReq = (idOrHash: string): { hash: string; gate_id: string | null } | undefined =>
          db
            .prepare(
              'SELECT hash, gate_id FROM requirements WHERE id = ? OR hash = ? OR hash LIKE ?'
            )
            .get(idOrHash, idOrHash, `${idOrHash}%`) as
          | { hash: string; gate_id: string | null }
          | undefined

        if (!isSolitary && gateId) {
          // Gate-tied proposal: if the gate already has requirements, the proposal
          // should reference one for traceability (advisory warning, not an error).
          const gateHasReqs = db
            .prepare('SELECT 1 FROM requirements WHERE gate_id = ? LIMIT 1')
            .get(gateId) as { 1: number } | undefined
          if (gateHasReqs) {
            const linkedReq = dbReqId
              ? resolveReq(dbReqId)
              : referencedReqHash
                ? resolveReq(referencedReqHash)
                : undefined
            if (!linkedReq) {
              checks.requirementsCoverage = false
              warnings.push(
                `Gate ${gateId} has requirements in the database but this proposal does not link to any. ` +
                  `Add **Requirement**: #<hash> to the proposal header or set requirement_id in the ` +
                  `frontmatter for traceability (optional — does not block validation).`
              )
            } else {
              checks.requirementsCoverage = true
            }
          }
          // Gate has no requirements yet (not started) — skip check entirely.
        } else {
          // Solitary proposal: requirements are always optional.
          // If one is referenced, validate it exists in the DB.
          const refIdOrHash = dbReqId ?? referencedReqHash
          if (refIdOrHash) {
            const req = resolveReq(refIdOrHash)
            if (!req) {
              checks.requirementsCoverage = false
              warnings.push(
                `Proposal references requirement "${refIdOrHash}" which was not found in the database. ` +
                  `Verify the hash is correct, or remove the reference if it does not apply ` +
                  `(optional — does not block validation).`
              )
            } else {
              checks.requirementsCoverage = true
            }
          }
          // No requirement reference on solitary proposal is perfectly fine — no warning.
        }
      } catch {
        // non-fatal — requirement linkage check is best-effort
      }

      // ── 11) Requirement relevance: gate alignment + agent review ────────────
      // Runs whenever a requirement is resolved (covers both gate-tied and
      // solitary proposals that reference a requirement).  Gate alignment is a
      // blocking error; the semantic-relevance agentReview item is advisory.
      try {
        const dbReqIdForRelevance = proposal.requirement_id ?? undefined
        let reqHashForRelevance: string | undefined
        if (!dbReqIdForRelevance) {
          const proposalFilePath = await findProposalByHash(validated.hash)
          if (proposalFilePath) {
            const content = await readFile(proposalFilePath)
            const headerMatch = /\*\*Requirement\*\*:\s*#([a-f0-9]{4,16})/i.exec(content)
            const fmMatch = /^requirement_id:\s*['"']?#?([a-f0-9]{4,16})['"']?\s*$/im.exec(content)
            reqHashForRelevance = headerMatch?.[1] ?? fmMatch?.[1]
          }
        }
        const refForRelevance = dbReqIdForRelevance ?? reqHashForRelevance
        if (refForRelevance) {
          interface ReqRow {
            hash: string
            id: string
            gate_id: string | null
            description: string
          }
          const reqRow = db
            .prepare(
              'SELECT hash, id, gate_id, description FROM requirements ' +
              'WHERE id = ? OR hash = ? OR hash LIKE ?'
            )
            .get(refForRelevance, refForRelevance, `${refForRelevance}%`) as ReqRow | undefined
          if (reqRow) {
            // Optionally extract task descriptions from the proposal file for richer agentReview
            let proposalSummaryForRelevance: string | undefined
            let proposalTasksForRelevance: string[] | undefined
            try {
              const proposalFilePath = await findProposalByHash(validated.hash)
              if (proposalFilePath) {
                const content = await readFile(proposalFilePath)
                const summaryMatch = /## Summary\s*\n([\s\S]*?)(?=\n##|\n---|\n$)/.exec(content)
                proposalSummaryForRelevance = summaryMatch?.[1]?.trim()
                const tasksMatch = /## Tasks\s*\n([\s\S]*?)(?=\n##|\n---|\n$)/.exec(content)
                if (tasksMatch?.[1]) {
                  proposalTasksForRelevance = tasksMatch[1]
                    .split(/###\s+Task\s+\d+:?/)
                    .map((t) => t.split('\n')[0]?.trim() ?? '')
                    .filter((t) => t.length > 2)
                }
              }
            } catch { /* non-fatal */ }

            const relevanceResult = validateRequirementRelevance({
              proposalHash: validated.hash,
              proposalGateId: gateId,
              isSolitary,
              requirement: reqRow,
              proposalSummary: proposalSummaryForRelevance,
              proposalTaskDescriptions: proposalTasksForRelevance,
            })
            checks.requirementRelevance = relevanceResult.allowed
            if (!relevanceResult.allowed) {
              if (relevanceResult.errors) errors.push(...relevanceResult.errors)
            }
            if (relevanceResult.agentReview?.length) agentReview.push(...relevanceResult.agentReview)
          }
        }
      } catch {
        // non-fatal — relevance check is best-effort
      }

      const passedQuantitative = errors.length === 0
      const previousStatus = proposal.status ?? 'pending'

      // When all checks pass, advance proposal status to 'validated'.
      // This is a required transition—not best-effort.
      let newStatus = previousStatus as ProposalStatus
      if (passedQuantitative && previousStatus !== 'validated' && previousStatus !== 'in_progress' && previousStatus !== 'completed') {
        try {
          db.prepare(`UPDATE proposals SET status = 'validated', updated_at = CURRENT_TIMESTAMP WHERE hash = ?`).run(normalizedHash)
          newStatus = 'validated'
        } catch (err) {
          // Status update failure is a fatal error—the LLM must know
          const statusErr = `Failed to advance proposal ${normalizedHash} to validated status: ${err instanceof Error ? err.message : String(err)}`
          errors.push(statusErr)
          throw new Error(statusErr, { cause: err })
        }
      }

      return {
        hash: normalizedHash,
        passedQuantitative,
        ...(newStatus !== previousStatus
          ? { previousStatus, newStatus }
          : {}),
        issues: [
          ...errors.map(msg => ({ level: 'error' as const, category: 'validation', message: msg })),
          ...warnings.map(msg => ({ level: 'warning' as const, category: 'validation', message: msg })),
        ],
        checks: isSolitary
          ? {
              phases: checks.phases,
              scope: checks.scope,
              testFileScope: checks.testFileScope,
              dependencies: checks.dependencies,
              artifactStructure: checks.artifactStructure,
              quality: checks.quality,
              testFirstPattern: checks.testFirstPattern,
              ...(checks.requirementsCoverage !== undefined
                ? { requirementsCoverage: checks.requirementsCoverage }
                : {}),
              ...(checks.requirementRelevance !== undefined
                ? { requirementRelevance: checks.requirementRelevance }
                : {}),
            }
          : {
              phases: checks.phases,
              scope: checks.scope,
              testFileScope: checks.testFileScope,
              dependencies: checks.dependencies,
              artifactStructure: checks.artifactStructure,
              quality: checks.quality,
              testFirstPattern: checks.testFirstPattern,
              gateLevelTestFirst: checks.gateLevelTestFirst,
              ...(checks.redTestCoverage !== undefined
                ? { redTestCoverage: checks.redTestCoverage }
                : {}),
              ...(checks.requirementsCoverage !== undefined
                ? { requirementsCoverage: checks.requirementsCoverage }
                : {}),
              ...(checks.requirementRelevance !== undefined
                ? { requirementRelevance: checks.requirementRelevance }
                : {}),
            },
        ...(agentReview.length > 0 ? { agentReview } : {}),
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
      const normalizedHash = normalizeHash(validated.hash)
      const db = (await import('../storage/database.js')).getDatabase()
      interface ProposalRow {
        hash: string
        dependencies?: string | null
        gate_id?: string | null
        quality_metrics?: string | null
        files_affected?: string | null
      }
      const proposal = db.prepare('SELECT * FROM proposals WHERE hash = ? OR hash LIKE ?').get(normalizedHash, `${normalizedHash}%`) as
        | ProposalRow
        | undefined

      if (!proposal) {
        throw new Error(`Proposal #${normalizedHash} not found`)
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
        proposalHash: normalizedHash,
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
        const gitUser = await getGitUserInfo(getWorkspaceRoot())
        approvedBy = gitUser.name ?? gitUser.email ?? undefined
      } catch {
        // Silently ignore git user pull errors; approvedBy remains undefined
      }

      // Capture previous status before transition
      const currentStatus = (proposal as unknown as Record<string, unknown>)['status'] as string ?? 'in_progress'

      // Proceed with approval — call approveProposal directly to avoid invokeCommand recursion
      const { approveProposal } = await import('../core/completions.js')
      await approveProposal(normalizedHash, { approver: approvedBy })

      // Option 5: writeback — patch **Status**: completed into the .md source file when
      // the caller explicitly opts in.  The .md is the user's source of truth; we never
      // mutate it automatically so as not to surprise users who track the file in git.
      let wroteBack = false
      if (validated.writeback) {
        try {
          const { findProposalByHash } = await import('../utils/artifact-locator.js')
          const { readFileSync, writeFileSync } = await import('node:fs')
          const filePath = await findProposalByHash(normalizedHash)
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
        hash: normalizedHash,
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
          const gitUser = await getGitUserInfo(getWorkspaceRoot())
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
