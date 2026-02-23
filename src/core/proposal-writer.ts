import { ensureDir, writeFile } from '../utils/file.js'
import { shortHash } from '../utils/hash.js'
import { loadConfig } from '../utils/config.js'
import path from 'path'

export interface ProposalMetadata {
  hash: string
  filename: string
  path: string
  type: 'gate-tied' | 'solitary'
  status: string
  summary: string
  phase?: 'RED' | 'GREEN' | 'Test Refinement'
  coverageTarget?: number
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
  outputDir: string
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

  // Phase 1: RED - Test proposals (first in sequence)
  proposalIndex = await generateRedPhaseProposals(
    gateId,
    objectives,
    requirements,
    templateContent,
    outputDir,
    proposals,
    proposalIndex,
    coverageThreshold
  )

  // Phase 2: GREEN - Implementation proposals
  proposalIndex = await generateGreenPhaseProposals(
    gateId,
    objectives,
    requirements,
    templateContent,
    outputDir,
    proposals,
    proposalIndex,
    coverageThreshold
  )

  // Phase 3: Test Refinement - Final validation (last in sequence)
  await generateTestRefinementProposal(
    gateId,
    objectives,
    requirements,
    templateContent,
    outputDir,
    proposals,
    proposalIndex,
    coverageThreshold
  )

  return proposals
}

async function generateRedPhaseProposals(
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
      .replace(/\{\{PROPOSAL_TYPE\}\}/g, 'RED')
      .replace(/\{\{PHASE\}\}/g, 'RED')
      .replace(/\{\{COVERAGE_THRESHOLD\}\}/g, String(coverageThreshold))
      .replace(/\{\{COVERAGE_TARGET\}\}/g, String(coverageTarget))
      .replace(
        /\{\{REQUIREMENTS\}\}/g,
        requirements.map((r) => `- #${r.id}: ${r.description}`).join('\n')
      )

    const tasks = generateRedPhaseTasks(objective, coverageTarget)
    proposalContent = proposalContent.replace(/\{\{TASKS\}\}/g, tasks)

    const hash = shortHash(proposalContent).substring(0, 8)
    const filename = `${index.toString().padStart(2, '0')}-red-${objective
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 25)}.md`
    const fullPath = path.join(outputDir, filename)

    await ensureDir(path.dirname(fullPath))
    await writeFile(fullPath, proposalContent)

    proposals.push({
      hash,
      filename,
      path: fullPath,
      type: 'gate-tied',
      status: 'pending',
      summary: `RED: Test suite for ${objective}`,
      phase: 'RED',
      coverageTarget,
    })

    index++
  }

  return index
}

async function generateGreenPhaseProposals(
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
      .replace(/\{\{PROPOSAL_TYPE\}\}/g, 'GREEN')
      .replace(/\{\{PHASE\}\}/g, 'GREEN')
      .replace(/\{\{COVERAGE_THRESHOLD\}\}/g, String(coverageThreshold))
      .replace(/\{\{COVERAGE_TARGET\}\}/g, String(coverageTarget))
      .replace(
        /\{\{REQUIREMENTS\}\}/g,
        requirements.map((r) => `- #${r.id}: ${r.description}`).join('\n')
      )

    const tasks = generateGreenPhaseTasks(objective)
    proposalContent = proposalContent.replace(/\{\{TASKS\}\}/g, tasks)

    const hash = shortHash(proposalContent).substring(0, 8)
    const filename = `${index.toString().padStart(2, '0')}-green-${objective
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 25)}.md`
    const fullPath = path.join(outputDir, filename)

    await ensureDir(path.dirname(fullPath))
    await writeFile(fullPath, proposalContent)

    proposals.push({
      hash,
      filename,
      path: fullPath,
      type: 'gate-tied',
      status: 'pending',
      summary: `GREEN: Implementation for ${objective}`,
      phase: 'GREEN',
      coverageTarget,
    })

    index++
  }

  return index
}

async function generateTestRefinementProposal(
  gateId: string,
  objectives: string[],
  requirements: { id: string; description: string }[],
  templateContent: string,
  outputDir: string,
  proposals: ProposalMetadata[],
  proposalIndex: number,
  coverageThreshold: number
): Promise<void> {
  // Combine all objectives' coverage into test refinement
  const totalCoverageLines = objectives.reduce((sum, obj) => sum + estimateCoverageLines(obj), 0)
  const totalCoverageTarget = Math.round((totalCoverageLines * coverageThreshold) / 100)

  let proposalContent = templateContent
    .replace(/\{\{GATE_ID\}\}/g, gateId)
    .replace(/\{\{OBJECTIVE\}\}/g, 'Test Coverage Validation & Refinement')
    .replace(/\{\{PROPOSAL_TYPE\}\}/g, 'Test Refinement')
    .replace(/\{\{PHASE\}\}/g, 'Test Refinement')
    .replace(/\{\{COVERAGE_THRESHOLD\}\}/g, String(coverageThreshold))
    .replace(/\{\{COVERAGE_TARGET\}\}/g, String(totalCoverageTarget))
    .replace(
      /\{\{REQUIREMENTS\}\}/g,
      requirements.map((r) => `- #${r.id}: ${r.description}`).join('\n')
    )

  const tasks = generateTestRefinementTasks()
  proposalContent = proposalContent.replace(/\{\{TASKS\}\}/g, tasks)

  const hash = shortHash(proposalContent).substring(0, 8)
  const filename = `${proposalIndex.toString().padStart(2, '0')}-test-refinement.md`
  const fullPath = path.join(outputDir, filename)

  await ensureDir(path.dirname(fullPath))
  await writeFile(fullPath, proposalContent)

  proposals.push({
    hash,
    filename,
    path: fullPath,
    type: 'gate-tied',
    status: 'pending',
    summary: 'Test Refinement: Validate coverage and edge cases for gate completion',
    phase: 'Test Refinement',
    coverageTarget: totalCoverageTarget,
  })
}

function generateRedPhaseTasks(objective: string, coverageTarget: number): string {
  const objectiveLower = objective.toLowerCase()
  const isService = objectiveLower.includes('service') || objectiveLower.includes('api')
  const isData =
    objectiveLower.includes('database') ||
    objectiveLower.includes('storage') ||
    objectiveLower.includes('schema')

  let tasks = `### Task 1: Write Unit Tests for ${objective}

**Phase**: RED  
**File(s)**: \`tests/[module]/[feature].test.ts\`  
**Action**: create

Write comprehensive test cases covering happy paths, error conditions, and edge cases. Target ${coverageTarget} lines of coverage. Use mocks and fixtures to isolate units under test.

**Acceptance**:
- [ ] All test cases execute and can fail
- [ ] Fixtures and mocks properly set up test isolation
- [ ] Tests cover happy path, error cases, and boundary conditions
- [ ] Test names clearly describe what they validate

---`

  if (isService || isData) {
    tasks += `

### Task 2: Set Up Test Fixtures and Stubs

**Phase**: RED  
**File(s)**: \`tests/[module]/fixtures.ts\`  
**Action**: create

Create reusable test fixtures, mock builders, and stub implementations for the module's dependencies. Document fixture usage in test files.

**Acceptance**:
- [ ] Fixtures provide realistic test data
- [ ] Stubs properly mock external dependencies
- [ ] Fixtures are reusable across multiple test files
- [ ] Clear documentation for fixture usage`
  }

  return tasks
}

function generateGreenPhaseTasks(objective: string): string {
  return `### Task 1: Implement ${objective}

**Phase**: GREEN  
**File(s)**: \`src/[module]/[feature].ts\`  
**Action**: create | modify

Implement only the functions and methods covered by RED phase tests. Make all RED tests pass. Do not add new tests beyond those defined in RED phase.

**Acceptance**:
- [ ] All RED tests pass
- [ ] Implementation matches test specifications exactly
- [ ] No new test files created
- [ ] No new test cases added to existing tests
- [ ] TypeScript strict mode compiles without errors
- [ ] Guardrails verified: only RED tests pass, coverage target met

---`
}

function generateTestRefinementTasks(): string {
  return `### Task 1: Validate Test Coverage & Edge Cases

**Phase**: Test Refinement  
**File(s)**: \`tests/[module]/[feature].test.ts\`  
**Action**: modify

Review test coverage reports and identify uncovered code paths. Add edge case tests if gaps exist. Ensure all RED tests still pass and coverage meets threshold.

**Acceptance**:
- [ ] All RED tests pass
- [ ] Coverage report shows ≥ threshold
- [ ] All edge cases covered (boundary conditions, error handling)
- [ ] No uncovered code paths with business logic
- [ ] All lint rules pass for test files
- [ ] Zero type errors in test files

---`
}

export function calculateProposalDependencies(
  proposals: { hash: string; filename?: string; path?: string; phase?: string }[]
): { from: string; to: string; type: string }[] {
  const dependencies: { from: string; to: string; type: string }[] = []

  // RED phase creates sequential dependency to GREEN (first RED → first GREEN)
  const redProposals = proposals.filter((p) => p.phase === 'RED' || p.filename?.includes('-red-'))
  const greenProposals = proposals.filter(
    (p) => p.phase === 'GREEN' || p.filename?.includes('-green-')
  )
  const testRefinementProposals = proposals.filter(
    (p) => p.phase === 'Test Refinement' || p.filename?.includes('-test-refinement')
  )

  // Map RED → GREEN for each objective pair
  for (let i = 0; i < redProposals.length && i < greenProposals.length; i++) {
    const red = redProposals[i]
    const green = greenProposals[i]
    if (red && green) {
      dependencies.push({
        from: red.hash,
        to: green.hash,
        type: 'red-green',
      })
    }
  }

  // Map GREEN → Test Refinement (all GREENs block then require test refinement)
  if (testRefinementProposals.length > 0) {
    const testRefinement = testRefinementProposals[0]
    for (const green of greenProposals) {
      if (testRefinement) {
        dependencies.push({
          from: green.hash,
          to: testRefinement.hash,
          type: 'green-test-refinement',
        })
      }
    }
  }

  return dependencies
}
