import { ensureDir, writeFile } from '../utils/file.js'
import { shortHash } from '../utils/hash.js'
import { loadConfig } from '../utils/config.js'
import { type ProposalRole } from './types.js'
import path from 'path'

export interface ProposalMetadata {
  hash: string
  filename: string
  path: string
  type: 'gate-tied' | 'solitary'
  status: string
  summary: string
  phase?: 'RED' | 'GREEN'
  coverageTarget?: number
  roles?: string[]
  parallelSetIndex?: number
}

/**
 * Estimate lines of code that need to be tested for an objective
 * This is a heuristic: typically 50-200 lines per major feature
 */
function estimateCoverageLines(objective: string): number {
  const objectiveLower = objective.toLowerCase()

  // Heuristics for common feature sizes
  if (
    objectiveLower.includes('crud') ||
    objectiveLower.includes('validation') ||
    objectiveLower.includes('parser')
  ) {
    return 150 // Medium feature
  }
  if (
    objectiveLower.includes('integration') ||
    objectiveLower.includes('workflow') ||
    objectiveLower.includes('system')
  ) {
    return 200 // Larger systems
  }
  if (
    objectiveLower.includes('utility') ||
    objectiveLower.includes('helper') ||
    objectiveLower.includes('format')
  ) {
    return 50 // Small utility
  }

  // Default: medium feature
  return 100
}

export async function decomposeToProposals(
  gateId: string,
  objectives: string[],
  requirements: { id: string; description: string }[],
  templateContent: string,
  outputDir: string,
  gateType = 'feature'
): Promise<ProposalMetadata[]> {
  const proposals: ProposalMetadata[] = []
  let proposalIndex = 1

  // Load config to get coverage threshold
  let coverageThreshold = 90
  try {
    const config = await loadConfig(process.cwd())
    coverageThreshold = config.qualityThresholds.codeCoverage
  } catch {
    // Use default if config can't be loaded
  }

  if (gateType === 'documentation') {
    // Documentation gates: no RED/GREEN test phases — only implementation proposals
    await generateImplementationProposals(
      gateId,
      objectives,
      requirements,
      templateContent,
      outputDir,
      proposals,
      proposalIndex,
      coverageThreshold
    )
  } else {
    // Phase 1: RED — Single test-suite proposal covering ALL objectives (Proposal 1)
    proposalIndex = await generateRedTestSuiteProposal(
      gateId,
      objectives,
      requirements,
      templateContent,
      outputDir,
      proposals,
      proposalIndex,
      coverageThreshold
    )

    // Phase 2: Implementation proposals — one per objective, no RED/GREEN prefix
    proposalIndex = await generateImplementationProposals(
      gateId,
      objectives,
      requirements,
      templateContent,
      outputDir,
      proposals,
      proposalIndex,
      coverageThreshold
    )

    // Phase 3: GREEN — Single test-verification proposal (final proposal)
    await generateGreenVerificationProposal(
      gateId,
      objectives,
      requirements,
      templateContent,
      outputDir,
      proposals,
      proposalIndex,
      coverageThreshold
    )
  }

  return proposals
}

/**
 * RED phase: Single test-suite proposal covering ALL gate objectives.
 * This is always Proposal 1. Tests are expected to fail initially.
 */
async function generateRedTestSuiteProposal(
  gateId: string,
  objectives: string[],
  requirements: { id: string; description: string }[],
  templateContent: string,
  outputDir: string,
  proposals: ProposalMetadata[],
  startIndex: number,
  coverageThreshold: number
): Promise<number> {
  const totalCoverageLines = objectives.reduce((sum, obj) => sum + estimateCoverageLines(obj), 0)
  const totalCoverageTarget = Math.round((totalCoverageLines * coverageThreshold) / 100)

  let proposalContent = templateContent
    .replace(/\{\{GATE_ID\}\}/g, gateId)
    .replace(/\{\{OBJECTIVE\}\}/g, `Test Suite for Gate ${gateId}`)
    .replace(/\{\{PROPOSAL_TYPE\}\}/g, 'RED')
    .replace(/\{\{PHASE\}\}/g, 'RED')
    .replace(/\{\{COVERAGE_THRESHOLD\}\}/g, String(coverageThreshold))
    .replace(/\{\{COVERAGE_TARGET\}\}/g, String(totalCoverageTarget))
    .replace(
      /\{\{REQUIREMENTS\}\}/g,
      requirements.map((r) => `- #${r.id}: ${r.description}`).join('\n')
    )

  const tasks = generateRedSuiteTasks(objectives, totalCoverageTarget)
  proposalContent = proposalContent.replace(/\{\{TASKS\}\}/g, tasks)

  // Include objectives and generated tasks in hash input so each proposal gets a unique
  // hash even when the template doesn't contain {{OBJECTIVE}} / {{TASKS}} placeholders.
  const hash = shortHash(proposalContent + objectives.join('|') + tasks).substring(0, 8)
  const today = new Date().toISOString().split('T')[0] ?? new Date().toISOString()
  const renderedContent = proposalContent
    .replace(/\{\{HASH\}\}/g, hash)
    .replace(/\{\{DATE\}\}/g, today)
  const filename = `${startIndex.toString().padStart(2, '0')}-red--test-suite.md`
  const fullPath = path.join(outputDir, filename)

  await ensureDir(path.dirname(fullPath))
  await writeFile(fullPath, renderedContent)

  proposals.push({
    hash,
    filename,
    path: fullPath,
    type: 'gate-tied',
    status: 'pending',
    summary: `RED: Test suite for all gate objectives`,
    phase: 'RED',
    coverageTarget: totalCoverageTarget,
    roles: ['testing'] as ProposalRole[],
  })

  return startIndex + 1
}

/**
 * Implementation proposals: one per objective, no RED/GREEN prefix.
 * These are the middle proposals (Proposals 2 through N-1).
 */
async function generateImplementationProposals(
  gateId: string,
  objectives: string[],
  requirements: { id: string; description: string }[],
  templateContent: string,
  outputDir: string,
  proposals: ProposalMetadata[],
  startIndex: number,
  coverageThreshold: number
): Promise<number> {
  let index = startIndex

  for (const objective of objectives) {
    const coverageLines = estimateCoverageLines(objective)
    const coverageTarget = Math.round((coverageLines * coverageThreshold) / 100)

    let proposalContent = templateContent
      .replace(/\{\{GATE_ID\}\}/g, gateId)
      .replace(/\{\{OBJECTIVE\}\}/g, objective)
      .replace(/\{\{PROPOSAL_TYPE\}\}/g, 'implementation')
      .replace(/\{\{PHASE\}\}/g, 'implementation')
      .replace(/\{\{COVERAGE_THRESHOLD\}\}/g, String(coverageThreshold))
      .replace(/\{\{COVERAGE_TARGET\}\}/g, String(coverageTarget))
      .replace(
        /\{\{REQUIREMENTS\}\}/g,
        requirements.map((r) => `- #${r.id}: ${r.description}`).join('\n')
      )

    const tasks = generateImplementationTasks(objective)
    proposalContent = proposalContent.replace(/\{\{TASKS\}\}/g, tasks)

    // Include objective and tasks so each proposal in the same gate gets a distinct hash.
    const hash = shortHash(proposalContent + objective + tasks).substring(0, 8)
    const today = new Date().toISOString().split('T')[0] ?? new Date().toISOString()
    const renderedContent = proposalContent
      .replace(/\{\{HASH\}\}/g, hash)
      .replace(/\{\{DATE\}\}/g, today)
    const filename = `${index.toString().padStart(2, '0')}-${objective
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 30)}.md`
    const fullPath = path.join(outputDir, filename)

    await ensureDir(path.dirname(fullPath))
    await writeFile(fullPath, renderedContent)

    proposals.push({
      hash,
      filename,
      path: fullPath,
      type: 'gate-tied',
      status: 'pending',
      summary: `Implement: ${objective}`,
      phase: undefined,
      coverageTarget,
      roles: ['feature'] as ProposalRole[],
    })

    index++
  }

  return index
}

/**
 * GREEN phase: Single test-verification proposal (always the final proposal).
 * Attaches implementation to tests and verifies all tests pass.
 */
async function generateGreenVerificationProposal(
  gateId: string,
  objectives: string[],
  requirements: { id: string; description: string }[],
  templateContent: string,
  outputDir: string,
  proposals: ProposalMetadata[],
  proposalIndex: number,
  coverageThreshold: number
): Promise<void> {
  const totalCoverageLines = objectives.reduce((sum, obj) => sum + estimateCoverageLines(obj), 0)
  const totalCoverageTarget = Math.round((totalCoverageLines * coverageThreshold) / 100)

  let proposalContent = templateContent
    .replace(/\{\{GATE_ID\}\}/g, gateId)
    .replace(/\{\{OBJECTIVE\}\}/g, 'Test Verification & Green Validation')
    .replace(/\{\{PROPOSAL_TYPE\}\}/g, 'GREEN')
    .replace(/\{\{PHASE\}\}/g, 'GREEN')
    .replace(/\{\{COVERAGE_THRESHOLD\}\}/g, String(coverageThreshold))
    .replace(/\{\{COVERAGE_TARGET\}\}/g, String(totalCoverageTarget))
    .replace(
      /\{\{REQUIREMENTS\}\}/g,
      requirements.map((r) => `- #${r.id}: ${r.description}`).join('\n')
    )

  const tasks = generateGreenVerificationTasks(objectives, coverageThreshold)
  proposalContent = proposalContent.replace(/\{\{TASKS\}\}/g, tasks)

  // Include objectives and tasks in hash input for uniqueness across gates.
  const hash = shortHash(proposalContent + objectives.join('|') + tasks).substring(0, 8)
  const today = new Date().toISOString().split('T')[0] ?? new Date().toISOString()
  const renderedContent = proposalContent
    .replace(/\{\{HASH\}\}/g, hash)
    .replace(/\{\{DATE\}\}/g, today)
  const filename = `${proposalIndex.toString().padStart(2, '0')}-green--test-verification.md`
  const fullPath = path.join(outputDir, filename)

  await ensureDir(path.dirname(fullPath))
  await writeFile(fullPath, renderedContent)

  proposals.push({
    hash,
    filename,
    path: fullPath,
    type: 'gate-tied',
    status: 'pending',
    summary: 'GREEN: Attach implementation to tests and verify all pass',
    phase: 'GREEN',
    coverageTarget: totalCoverageTarget,
    roles: ['testing'] as ProposalRole[],
  })
}

/**
 * Generate tasks for the single RED test-suite proposal covering all objectives.
 */
function generateRedSuiteTasks(objectives: string[], totalCoverageTarget: number): string {
  let taskNum = 1
  let tasks = ''

  for (const objective of objectives) {
    tasks += `### Task ${String(taskNum)}: Write Unit Tests for ${objective}

**Phase**: RED
**File(s)**: \`tests/[module]/${objective.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.test.ts\`
**Action**: create

Write comprehensive test cases covering happy paths, error conditions, and edge cases for "${objective}". Use mocks and fixtures to isolate units under test.

**Acceptance**:
- [ ] All test cases execute and can fail (RED — no implementation yet)
- [ ] Fixtures and mocks properly set up test isolation
- [ ] Tests cover happy path, error cases, and boundary conditions
- [ ] Test names clearly describe what they validate

---

`
    taskNum++
  }

  tasks += `### Task ${String(taskNum)}: Set Up Shared Test Fixtures and Stubs

**Phase**: RED
**File(s)**: \`tests/[module]/fixtures.ts\`
**Action**: create

Create reusable test fixtures, mock builders, and stub implementations for all module dependencies. Target ${totalCoverageTarget.toString()} total lines of coverage across all objectives.

**Acceptance**:
- [ ] Fixtures provide realistic test data
- [ ] Stubs properly mock external dependencies
- [ ] Fixtures are reusable across multiple test files
- [ ] Clear documentation for fixture usage`

  return tasks
}

/**
 * Generate tasks for an implementation proposal (no RED/GREEN designation).
 */
function generateImplementationTasks(objective: string): string {
  return `### Task 1: Implement ${objective}

**File(s)**: \`src/[module]/[feature].ts\`
**Action**: create | modify

Implement the functions and methods required for "${objective}". Focus on making the RED tests for this objective pass. Do not add or modify test files.

**Acceptance**:
- [ ] RED tests for this objective pass
- [ ] Implementation matches test specifications
- [ ] No test files created or modified
- [ ] TypeScript strict mode compiles without errors

---`
}

/**
 * Generate tasks for the final GREEN verification proposal.
 */
function generateGreenVerificationTasks(objectives: string[], coverageThreshold: number): string {
  const objectiveList = objectives.map((o, i) => `${String(i + 1)}. ${o}`).join('\n')

  return `### Task 1: Attach Implementation to Tests & Verify All Pass

**Phase**: GREEN
**File(s)**: \`tests/[module]/*.test.ts\`
**Action**: modify

Wire all implementation modules into the test suite so that every RED test now passes with real implementations instead of stubs. Verify full integration between test suite and implementation code.

**Objectives verified**:
${objectiveList}

**Acceptance**:
- [ ] All RED tests pass with real implementations
- [ ] No tests using stubs for implemented code
- [ ] Coverage report shows ≥ ${String(coverageThreshold)}%
- [ ] All edge cases covered (boundary conditions, error handling)
- [ ] All lint rules pass for test files
- [ ] Zero type errors in test and implementation files

---

### Task 2: Coverage Gap Analysis & Edge Case Tests

**Phase**: GREEN
**File(s)**: \`tests/[module]/*.test.ts\`
**Action**: modify

Review test coverage reports and identify uncovered code paths. Add edge case tests if gaps exist. Ensure coverage meets or exceeds the quality threshold.

**Acceptance**:
- [ ] Coverage report shows ≥ ${String(coverageThreshold)}%
- [ ] No uncovered code paths with business logic
- [ ] Edge case tests added for any gaps discovered

---`
}

/**
 * Documentation/chore gate decomposition — no RED/GREEN phases.
 *
 * Generates one proposal per objective with `roles: ['documentation']`.
 * Used when the gate PRD declares `**Type**: chore` or `**Type**: documentation`.
 */
export async function decomposeDocumentationProposals(
  gateId: string,
  objectives: string[],
  requirements: { id: string; description: string }[],
  templateContent: string,
  outputDir: string
): Promise<ProposalMetadata[]> {
  const proposals: ProposalMetadata[] = []

  for (let i = 0; i < objectives.length; i++) {
    const objective = objectives[i] ?? ''
    const index = i + 1

    let proposalContent = templateContent
      .replace(/\{\{GATE_ID\}\}/g, gateId)
      .replace(/\{\{OBJECTIVE\}\}/g, objective)
      .replace(/\{\{PROPOSAL_TYPE\}\}/g, 'documentation')
      .replace(/\{\{PHASE\}\}/g, 'documentation')
      .replace(/\{\{COVERAGE_THRESHOLD\}\}/g, 'N/A')
      .replace(/\{\{COVERAGE_TARGET\}\}/g, 'N/A')
      .replace(
        /\{\{REQUIREMENTS\}\}/g,
        requirements.map((r) => `- #${r.id}: ${r.description}`).join('\n')
      )

    const tasks = generateDocumentationTasks(objective)
    proposalContent = proposalContent.replace(/\{\{TASKS\}\}/g, tasks)

    const hash = shortHash(proposalContent + objective + tasks).substring(0, 8)
    const today = new Date().toISOString().split('T')[0] ?? new Date().toISOString()
    const renderedContent = proposalContent
      .replace(/\{\{HASH\}\}/g, hash)
      .replace(/\{\{DATE\}\}/g, today)
    const slug = objective.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
    const filename = `${index.toString().padStart(2, '0')}-${slug}.md`
    const fullPath = path.join(outputDir, filename)

    await ensureDir(path.dirname(fullPath))
    await writeFile(fullPath, renderedContent)

    proposals.push({
      hash,
      filename,
      path: fullPath,
      type: 'gate-tied',
      status: 'pending',
      summary: `Docs: ${objective}`,
      phase: undefined,
      roles: ['documentation'] as ProposalRole[],
    })
  }

  return proposals
}

/**
 * Generate tasks for a documentation proposal.
 */
function generateDocumentationTasks(objective: string): string {
  return `### Task 1: ${objective}

**File(s)**: \`[path/to/file-to-update]\`
**Action**: modify

Update the target file to satisfy "${objective}". Do NOT create tests — this is a documentation-only change. Verify the content accurately reflects the current implementation.

**Acceptance**:
- [ ] Content accurately reflects the current implementation
- [ ] No references to unimplemented or removed features remain
- [ ] Markdown renders cleanly with no broken links or formatting errors

---`
}

/**
 * Calculate dependencies between proposals.
 *
 * New structure:
 *   RED (single) → all implementation proposals (parallel-eligible)
 *   All implementation proposals → GREEN (single)
 *
 * Documentation proposals (no RED/GREEN phases) are treated as fully parallel.
 */
export function calculateProposalDependencies(
  proposals: { hash: string; filename?: string; path?: string; phase?: string }[]
): { edges: { from: string; to: string; type: string }[]; parallelSets: string[][] } {
  const edges: { from: string; to: string; type: string }[] = []

  const redProposals = proposals.filter(
    (p) => p.phase === 'RED' || p.filename?.includes('-red-')
  )
  const greenProposals = proposals.filter(
    (p) => p.phase === 'GREEN' || p.filename?.includes('-green-')
  )
  // Implementation proposals have no phase set and no red/green in the filename
  const implProposals = proposals.filter(
    (p) =>
      !p.phase &&
      !p.filename?.includes('-red-') &&
      !p.filename?.includes('-green-') &&
      !p.filename?.includes('-test-refinement')
  )

  // RED → each implementation proposal
  if (redProposals.length > 0) {
    const red = redProposals[0]
    if (red) {
      for (const impl of implProposals) {
        edges.push({
          from: red.hash,
          to: impl.hash,
          type: 'red-impl',
        })
      }
      // RED → GREEN (direct) when there are no implementation proposals
      if (implProposals.length === 0 && greenProposals.length > 0) {
        const greenProposal = greenProposals[0]
        if (greenProposal) {
          edges.push({
            from: red.hash,
            to: greenProposal.hash,
            type: 'red-green',
          })
        }
      }
    }
  }

  // Each implementation proposal → GREEN
  if (greenProposals.length > 0) {
    const green = greenProposals[0]
    if (green) {
      for (const impl of implProposals) {
        edges.push({
          from: impl.hash,
          to: green.hash,
          type: 'impl-green',
        })
      }
    }
  }

  // Compute parallel execution sets using Kahn's algorithm
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const p of proposals) {
    inDegree.set(p.hash, 0)
    adj.set(p.hash, [])
  }

  for (const e of edges) {
    adj.get(e.from)?.push(e.to)
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1)
  }

  const parallelSets: string[][] = []
  let frontier = proposals.map((p) => p.hash).filter((h) => (inDegree.get(h) ?? 0) === 0)

  while (frontier.length > 0) {
    parallelSets.push([...frontier])
    const next: string[] = []
    for (const h of frontier) {
      for (const dep of adj.get(h) ?? []) {
        const deg = (inDegree.get(dep) ?? 1) - 1
        inDegree.set(dep, deg)
        if (deg === 0) next.push(dep)
      }
    }
    frontier = next
  }

  return { edges, parallelSets }
}
