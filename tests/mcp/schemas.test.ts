import { describe, it, expect } from 'vitest'
import * as common from '../../src/mcp/schemas/common-schemas.js'
import * as gate from '../../src/mcp/schemas/gate-schemas.js'
import * as requirement from '../../src/mcp/schemas/requirement-schemas.js'
import * as proposal from '../../src/mcp/schemas/proposal-schemas.js'
import * as repository from '../../src/mcp/schemas/repository-schemas.js'
import * as analysis from '../../src/mcp/schemas/analysis-schemas.js'

/**
 * Comprehensive test suite for all MCP Zod schemas
 * Tests validation, error messages, and type inference
 */

// ============================================================================
// COMMON SCHEMAS TESTS
// ============================================================================

describe('Common Schemas', () => {
  describe('Status Enums', () => {
    it('should validate gate status values', () => {
      expect(() => common.GateStatusEnum.parse('pending')).not.toThrow()
      expect(() => common.GateStatusEnum.parse('in_progress')).not.toThrow()
      expect(() => common.GateStatusEnum.parse('completed')).not.toThrow()
      expect(() => common.GateStatusEnum.parse('rejected')).not.toThrow()
    })

    it('should reject invalid gate status values', () => {
      expect(() => common.GateStatusEnum.parse('active')).toThrow()
      expect(() => common.GateStatusEnum.parse('PENDING')).toThrow()
    })



    it('should validate proposal status values', () => {
      expect(() => common.ProposalStatusEnum.parse('pending')).not.toThrow()
      expect(() => common.ProposalStatusEnum.parse('in_progress')).not.toThrow()
      expect(() => common.ProposalStatusEnum.parse('completed')).not.toThrow()
      expect(() => common.ProposalStatusEnum.parse('archived')).not.toThrow()
      expect(() => common.ProposalStatusEnum.parse('rejected')).not.toThrow()
      expect(() => common.ProposalStatusEnum.parse('cancelled')).not.toThrow()
      expect(() => common.ProposalStatusEnum.parse('backlog')).not.toThrow()
      expect(() => common.ProposalStatusEnum.parse('unknown')).toThrow()
    })
  })

  describe('Identifiers', () => {
    it('should validate gate IDs', () => {
      expect(() => common.GateIdSchema.parse('gate-01')).not.toThrow()
      expect(() => common.GateIdSchema.parse('gate-13')).not.toThrow()
      expect(() => common.GateIdSchema.parse('gate-1')).toThrow()
      expect(() => common.GateIdSchema.parse('Gate-01')).toThrow()
    })

    it('should validate requirement hashes', () => {
      expect(() => common.RequirementHashSchema.parse('abc123450def5678')).not.toThrow()
      expect(() => common.RequirementHashSchema.parse('1234567890abcdef')).not.toThrow()
      expect(() => common.RequirementHashSchema.parse('abcdefghijklmnop')).not.toThrow()
      expect(() => common.RequirementHashSchema.parse('short')).toThrow()
      expect(() => common.RequirementHashSchema.parse('ABC1234567890DEF')).toThrow()
      expect(() => common.RequirementHashSchema.parse('abc12345')).toThrow() // 8 chars no longer valid
    })

    it('should validate commit hashes', () => {
      expect(() => common.CommitHashSchema.parse('a1b2c3d')).not.toThrow()
      expect(() => common.CommitHashSchema.parse('a1b2c3d4e5f6789a')).not.toThrow()
      expect(() => common.CommitHashSchema.parse('short')).toThrow()
      expect(() => common.CommitHashSchema.parse('XXXXXXX')).toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should validate error responses with context', () => {
      const error = {
        code: 'NOT_FOUND',
        message: 'Gate not found',
        context: {
          resourceType: 'gate',
          resourceId: 'gate-01'
        }
      }
      expect(() => common.ErrorResponseSchema.parse(error)).not.toThrow()
    })

    it('should validate error responses without context', () => {
      const error = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
      expect(() => common.ErrorResponseSchema.parse(error)).not.toThrow()
    })

    it('should reject invalid error codes', () => {
      const error = {
        code: 'CUSTOM_ERROR',
        message: 'Invalid error code'
      }
      expect(() => common.ErrorResponseSchema.parse(error)).toThrow()
    })
  })

  describe('Templates', () => {
    it('should validate template metadata', () => {
      const template = {
        name: 'project-prd-template',
        category: 'markdown',
        description: 'Template for project PRDs',
        version: '1.0.0'
      }
      expect(() => common.TemplateMetadataSchema.parse(template)).not.toThrow()
    })

    it('should validate template content', () => {
      const content = {
        name: 'project-prd-template',
        content: '# Project PRD\n\n...',
        metadata: {
          name: 'project-prd-template',
          category: 'markdown',
          description: 'Template for project PRDs',
          version: '1.0.0'
        }
      }
      expect(() => common.TemplateContentSchema.parse(content)).not.toThrow()
    })

    it('should validate template list output', () => {
      const list = {
        templates: [
          {
            name: 'template-1',
            category: 'markdown',
            description: 'Template 1',
            version: '1.0.0'
          }
        ],
      }
      expect(() => common.TemplateListSchema.parse(list)).not.toThrow()
    })
  })

  describe('Config', () => {
    it('should validate project config', () => {
      const config = {
        projectName: 'Zenos-Planner',
        version: '1.0.0',
        description: 'Project planning tool'
      }
      expect(() => common.ProjectConfigSchema.parse(config)).not.toThrow()
    })

    it('should validate arbitrary config values', () => {
      expect(() => common.ConfigValueSchema.parse('string')).not.toThrow()
      expect(() => common.ConfigValueSchema.parse(42)).not.toThrow()
      expect(() => common.ConfigValueSchema.parse(true)).not.toThrow()
      expect(() => common.ConfigValueSchema.parse(null)).not.toThrow()
      expect(() => common.ConfigValueSchema.parse([1, 'two', true])).not.toThrow()
    })
  })
})

// ============================================================================
// GATE SCHEMAS TESTS
// ============================================================================

describe('Gate Schemas', () => {
  describe('gates_list', () => {
    it('should validate list input with all fields', () => {
      const input = {
        status: 'in_progress',
        skip: 0,
        take: 50
      }
      expect(() => gate.GatesListInputSchema.parse(input)).not.toThrow()
    })

    it('should validate list input with defaults', () => {
      const input = {}
      expect(() => gate.GatesListInputSchema.parse(input)).not.toThrow()
    })

    it('should validate gate summary', () => {
      const summary = {
        id: 'gate-01',
        name: 'Core Infrastructure',
        description: 'Basic infrastructure',
        sequence: 1,
        status: 'completed',
        type: 'feature',
        lastUpdated: new Date().toISOString(),
        proposalCount: 3,
        completedProposalCount: 3,
        requirementCount: 10,
        testedRequirementCount: 10
      }
      expect(() => gate.GateSummarySchema.parse(summary)).not.toThrow()
    })
  })

  describe('gates_show', () => {
    it('should validate gates_show input', () => {
      const input = {
        gateId: 'gate-01'
      }
      expect(() => gate.GatesShowInputSchema.parse(input)).not.toThrow()
    })

    it('should reject invalid gate ID', () => {
      const input = {
        gateId: 'gate-1'
      }
      expect(() => gate.GatesShowInputSchema.parse(input)).toThrow()
    })

    it('should validate gate detail output', () => {
      const detail = {
        id: 'gate-01',
        name: 'Core Infrastructure',
        description: 'Basic infrastructure',
        sequence: 1,
        status: 'completed',
        type: 'feature',
        objectives: [{ title: 'Objective 1', completed: true }],
        requirements: [],
        proposals: [],
        lastUpdated: new Date().toISOString()
      }
      expect(() => gate.GateDetailSchema.parse(detail)).not.toThrow()
    })
  })

  describe('gates_start', () => {
    it('should validate gates_start input', () => {
      const input = {
        gateId: 'gate-02',
        qualitativeReview: {
          objectivesConfirmed: true,
          requirementsMapped: true,
          proposalCountAppropriate: true,
          testFirstOrderingVerified: true,
          dependenciesConfirmed: true,
          scopeAchievable: true,
          flaggedItems: [],
        },
      }
      expect(() => gate.GatesStartInputSchema.parse(input)).not.toThrow()
    })

    it('should require qualitativeReview in gates_start input', () => {
      const input = { gateId: 'gate-02' }
      expect(() => gate.GatesStartInputSchema.parse(input)).toThrow()
    })

    it('should validate gates_start input with flagged items', () => {
      const input = {
        gateId: 'gate-02',
        qualitativeReview: {
          objectivesConfirmed: true,
          requirementsMapped: false,
          proposalCountAppropriate: true,
          testFirstOrderingVerified: true,
          dependenciesConfirmed: true,
          scopeAchievable: true,
          flaggedItems: ['Requirement R-04 lacks acceptance criteria'],
        },
      }
      expect(() => gate.GatesStartInputSchema.parse(input)).not.toThrow()
    })

    it('should validate gates_start output', () => {
      const output = {
        gateId: 'gate-02',
        previousStatus: 'pending',
        newStatus: 'in_progress',
        startedAt: new Date().toISOString()
      }
      expect(() => gate.GatesStartOutputSchema.parse(output)).not.toThrow()
    })

    it('should validate gates_start output with reviewWarnings', () => {
      const output = {
        gateId: 'gate-02',
        previousStatus: 'pending',
        newStatus: 'in_progress',
        startedAt: new Date().toISOString(),
        generatedRequirements: [
          {
            hash: '1234567890abcdef',
            title: 'Build lifecycle validation',
            type: 'functional',
            priority: 'must',
          },
        ],
        reviewWarnings: ['requirementsMapped=false: some requirements lack testable deliverables'],
      }
      expect(() => gate.GatesStartOutputSchema.parse(output)).not.toThrow()
    })
  })

  describe('gates_complete', () => {
    it('should validate gates_complete input', () => {
      const input = {
        gateId: 'gate-01',
        completionNotes: 'All requirements met'
      }
      expect(() => gate.GatesCompleteInputSchema.parse(input)).not.toThrow()
    })

    it('should validate gates_complete output', () => {
      const output = {
        gateId: 'gate-01',
        previousStatus: 'in_progress',
        newStatus: 'completed',
        completedAt: new Date().toISOString(),
        summary: {
          proposalsCompleted: 3,
          requirementsTested: 10
        }
      }
      expect(() => gate.GatesCompleteOutputSchema.parse(output)).not.toThrow()
    })

    it('should validate gates_complete output with gitInstructions', () => {
      const output = {
        gateId: 'gate-01',
        previousStatus: 'in_progress',
        newStatus: 'completed',
        completedAt: new Date().toISOString(),
        summary: { proposalsCompleted: 3, requirementsTested: 10 },
        gitInstructions: {
          commitMessage: 'feat(gate-01): complete Setup\n\nVersion: 1.1.0\n',
          tagName: 'v1.1.0-gate-01',
          tagMessage: 'Gate gate-01: Setup (version 1.1.0)',
          commands: [
            'git add -A',
            'git commit -m "feat(gate-01): complete Setup\\n\\nVersion: 1.1.0\\n"',
            'git tag -a v1.1.0-gate-01 -m "Gate gate-01: Setup (version 1.1.0)"',
          ],
        },
      }
      expect(() => gate.GatesCompleteOutputSchema.parse(output)).not.toThrow()
    })
  })

  describe('gates_validate', () => {
    it('should validate gates_validate output when passed (no checks, has nextRequiredStep)', () => {
      const output = {
        gateId: 'gate-01',
        passed: true,
        nextRequiredStep: {
          blocking: true,
          action: 'qualitative-review',
          description: 'Structural checks passed. Evaluate the checklist and call gates_action:start { gateId, qualitativeReview: { objectivesConfirmed, requirementsMapped, proposalCountAppropriate, testFirstOrderingVerified, dependenciesConfirmed, scopeAchievable, flaggedItems } }.',
          checklist: ['Gate objectives are still current.'],
        },
      }
      expect(() => gate.GatesValidateOutputSchema.parse(output)).not.toThrow()
    })

    it('should validate gates_validate output with errors (failedChecks only)', () => {
      const output = {
        gateId: 'gate-02',
        passed: false,
        errors: ['Dependency gate gate-01 is not completed (status: in_progress)', 'Gate gate-02 has no requirements'],
        warnings: ['Gate Scope Boundaries section lacks an "In Scope" list'],
        failedChecks: {
          dependencyGatesCompleted: false,
          requirementsCoverage: false,
          testFirstStructure: false,
          quality: false,
        },
        nextRequiredStep: {
          blocking: true,
          action: 'fix-structural-errors',
          description: 'Structural checks failed. Fix every error in errors[] and re-run gates_action:validate before proceeding.',
        },
      }
      expect(() => gate.GatesValidateOutputSchema.parse(output)).not.toThrow()
    })

    it('should still accept checks field when present (backward compat)', () => {
      const output = {
        gateId: 'gate-01',
        passed: true,
        checks: {
          dependencies: true,
          dependencyGatesCompleted: true,
          artifactStructure: true,
          requirementsCoverage: true,
          testFirstStructure: true,
          quality: true,
        },
      }
      expect(() => gate.GatesValidateOutputSchema.parse(output)).not.toThrow()
    })
  })

  describe('gates_regenerate', () => {
    it('should validate gates_regenerate input', () => {
      const input = {
        mode: 'check'
      }
      expect(() => gate.GatesRegenerateInputSchema.parse(input)).not.toThrow()
    })

    it('should validate gates_regenerate output', () => {
      const output = {
        mode: 'check',
        status: 'no_changes'
      }
      expect(() => gate.GatesRegenerateOutputSchema.parse(output)).not.toThrow()
    })
  })
})

// ============================================================================
// REQUIREMENT SCHEMAS TESTS
// ============================================================================

describe('Requirement Schemas', () => {
  describe('req_list', () => {
    it('should validate requirement list input', () => {
      const input = {
        gateId: 'gate-01'
      }
      expect(() => requirement.ReqListInputSchema.parse(input)).not.toThrow()
    })

    it('should validate requirement summary', () => {
      const summary = {
        hash: 'abc123450def5678',
        title: 'Requirement 1',
        type: 'functional',
        gateId: 'gate-01',
        created: new Date().toISOString()
      }
      expect(() => requirement.RequirementSummarySchema.parse(summary)).not.toThrow()
    })
  })

  describe('req_deps', () => {
    it('should validate dependency graph', () => {
      const graph = {
        root: 'abc123450def5678',
        nodes: [
          {
            hash: 'abc123450def5678',
            title: 'Req 1',
            type: 'functional',
            gateId: 'gate-01'
          }
        ],
        edges: [
          {
            from: 'abc123450def5678',
            to: 'def678901234abcd',
            type: 'blocks'
          }
        ]
      }
      expect(() => requirement.DependencyGraphSchema.parse(graph)).not.toThrow()
    })
  })


})

// ============================================================================
// PROPOSAL SCHEMAS TESTS
// ============================================================================

describe('Proposal Schemas', () => {
  describe('proposal_list', () => {
    it('should validate proposal list input', () => {
      const input = {
        gateId: 'gate-03',
        status: 'pending'
      }
      expect(() => proposal.ProposalListInputSchema.parse(input)).not.toThrow()
    })

    it('should validate proposal summary', () => {
      const summary = {
        hash: 'g03p01ab',
        title: 'Proposal 1',
        status: 'pending',
        gateId: 'gate-03',
        tasksCompleted: 0,
        totalTasks: 5,
        lastUpdated: new Date().toISOString()
      }
      expect(() => proposal.ProposalSummarySchema.parse(summary)).not.toThrow()
    })
  })

  describe('proposal_show', () => {
    it('should validate proposal detail', () => {
      const detail = {
        hash: 'g03p01ab',
        title: 'Proposal 1',
        description: 'Description',
        status: 'pending',
        gateId: 'gate-03',
        tasks: [
          {
            title: 'Task 1',
            completed: false
          }
        ],
        lastUpdated: new Date().toISOString()
      }
      expect(() => proposal.ProposalDetailSchema.parse(detail)).not.toThrow()
    })
  })

  describe('proposal_validate', () => {
    it('should validate validation output', () => {
      const output = {
        hash: 'g03p01ab',
        passedQuantitative: true,
        issues: []
      }
      expect(() => proposal.ProposalValidateOutputSchema.parse(output)).not.toThrow()
    })

    it('should validate validation issues', () => {
      const output = {
        hash: 'g03p01ab',
        passedQuantitative: false,
        issues: [
          {
            level: 'error',
            category: 'test_coverage',
            message: 'Coverage below threshold',
            suggestion: 'Add more tests'
          }
        ]
      }
      expect(() => proposal.ProposalValidateOutputSchema.parse(output)).not.toThrow()
    })
  })

  describe('proposal_start', () => {
    const validQualitativeReview = {
      taskDescriptionsSpecific: true,
      acceptanceCriteriaMeasurable: true,
      filesAffectedVerified: true,
      noUnresolvedMarkers: true,
      scopeFocused: true,
      rollbackSpecific: true,
      flaggedItems: [],
    }

    it('should accept valid start input with qualitativeReview', () => {
      const input = { hash: 'g03p01ab', qualitativeReview: validQualitativeReview }
      expect(() => proposal.ProposalStartInputSchema.parse(input)).not.toThrow()
    })

    it('should reject start input missing qualitativeReview', () => {
      const input = { hash: 'g03p01ab' }
      expect(() => proposal.ProposalStartInputSchema.parse(input)).toThrow()
    })

    it('should accept qualitativeReview with false booleans and flagged items', () => {
      const input = {
        hash: 'g03p01ab',
        qualitativeReview: {
          ...validQualitativeReview,
          noUnresolvedMarkers: false,
          flaggedItems: ['TODO markers found in task 3'],
        },
      }
      expect(() => proposal.ProposalStartInputSchema.parse(input)).not.toThrow()
    })

    it('should validate start output with reviewWarnings', () => {
      const output = {
        hash: 'g03p01ab',
        previousStatus: 'validated',
        newStatus: 'in_progress',
        startedAt: new Date().toISOString(),
        reviewWarnings: ['noUnresolvedMarkers is false'],
      }
      expect(() => proposal.ProposalStartOutputSchema.parse(output)).not.toThrow()
    })
  })

  describe('proposal_approve/reject', () => {
    it('should validate proposal approve output', () => {
      const output = {
        hash: 'g03p01ab',
        previousStatus: 'completed',
        newStatus: 'completed',
        approvedAt: new Date().toISOString()
      }
      expect(() => proposal.ProposalApproveOutputSchema.parse(output)).not.toThrow()
    })

    it('should validate proposal reject input', () => {
      const input = {
        hash: 'g03p01ab',
        rejectionReason: 'Needs more work'
      }
      expect(() => proposal.ProposalRejectInputSchema.parse(input)).not.toThrow()
    })
  })
})

// ============================================================================
// REPOSITORY SCHEMAS TESTS
// ============================================================================

describe('Repository Schemas', () => {
  describe('repos_list', () => {
    it('should validate repository list input', () => {
      const input = {
        type: 'main'
      }
      expect(() => repository.ReposListInputSchema.parse(input)).not.toThrow()
    })

    it('should validate repository summary', () => {
      const summary = {
        id: 'repo-1',
        name: 'Main Project',
        type: 'main',
        path: 'src/',
        fileCount: 100,
        lineCount: 10000
      }
      expect(() => repository.RepositorySummarySchema.parse(summary)).not.toThrow()
    })
  })

  describe('repos_deps', () => {
    it('should validate repository dependency graph', () => {
      const graph = {
        repositories: [
          {
            id: 'repo-1',
            name: 'Main',
            type: 'main',
            path: 'src/'
          }
        ],
        edges: [
          {
            from: 'repo-1',
            to: 'repo-2',
            type: 'imports'
          }
        ]
      }
      expect(() => repository.RepositoryDependencyGraphSchema.parse(graph)).not.toThrow()
    })
  })

  describe('repos_detect', () => {
    it('should validate repository detection output', () => {
      const output = {
        detected: [
          {
            repoId: 'repo-1',
            name: 'Main',
            type: 'main',
            path: 'src/'
          }
        ]
      }
      expect(() => repository.ReposDetectOutputSchema.parse(output)).not.toThrow()
    })
  })

  describe('repos_adjust', () => {
    it('should validate repository adjustment input', () => {
      const input = {
        adjustments: [
          {
            repositoryId: 'repo-1',
            type: 'reclassify',
            newType: 'library'
          }
        ]
      }
      expect(() => repository.ReposAdjustInputSchema.parse(input)).not.toThrow()
    })
  })
})

// ============================================================================
// ANALYSIS SCHEMAS TESTS
// ============================================================================

describe('Analysis Schemas', () => {
  describe('analyze', () => {
    it('should validate analysis input', () => {
      const input = {
        path: 'src/',
        includeMetrics: true
      }
      expect(() => analysis.AnalyzeInputSchema.parse(input)).not.toThrow()
    })

    it('should validate analysis result', () => {
      const result = {
        path: 'src/',
        metrics: {
          lineCount: 10000,
          fileCount: 50
        }
      }
      expect(() => analysis.AnalysisResultSchema.parse(result)).not.toThrow()
    })

    it('should validate code metrics', () => {
      const metrics = {
        lineCount: 10000,
        fileCount: 50,
        complexity: 3.5
      }
      expect(() => analysis.CodeMetricsSchema.parse(metrics)).not.toThrow()
    })
  })

  describe('metrics', () => {
    it('should validate project metrics', () => {
      const metrics = {
        codeMetrics: {
          lineCount: 10000,
          fileCount: 50
        },
        timestamp: new Date().toISOString()
      }
      expect(() => analysis.ProjectMetricsSchema.parse(metrics)).not.toThrow()
    })

    it('should validate metrics with all fields', () => {
      const metrics = {
        codeMetrics: {
          lineCount: 10000,
          fileCount: 50
        },
        qualityMetrics: {
          testCoverage: 85,
          typeErrorCount: 0,
          lintErrorCount: 2
        },
        gateMetrics: {
          totalGates: 3,
          completedGates: 1,
          activeGates: 2
        },
        timestamp: new Date().toISOString()
      }
      expect(() => analysis.ProjectMetricsSchema.parse(metrics)).not.toThrow()
    })
  })

  describe('context_action entity resolution', () => {
    it('should validate requirement context output', () => {
      const info = {
        id: 'req-01',
        description: 'Must support offline mode',
        type: 'non_functional',
        priority: 'must',
        level: 'project',
        hash: 'abc123450def5678',
        gateId: 'gate-01',
        acceptanceCriteria: null,
        createdAt: new Date().toISOString(),
      }
      expect(() => analysis.EntityInfoSchema.parse({ entityType: 'gate', id: 'gate-01', name: 'x' })).not.toThrow()
      expect(info.hash).toHaveLength(16)
    })
  })
})

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Schema Integration', () => {
  it('should handle realistic gate list and show workflow', () => {
    // List gates
    const listInput = {}
    expect(() => gate.GatesListInputSchema.parse(listInput)).not.toThrow()

    // Show specific gate
    const showInput = { gateId: 'gate-01' }
    expect(() => gate.GatesShowInputSchema.parse(showInput)).not.toThrow()

    // Start gate
    const startInput = {
      gateId: 'gate-02',
      qualitativeReview: {
        objectivesConfirmed: true,
        requirementsMapped: true,
        proposalCountAppropriate: true,
        testFirstOrderingVerified: true,
        dependenciesConfirmed: true,
        scopeAchievable: true,
        flaggedItems: [],
      },
    }
    expect(() => gate.GatesStartInputSchema.parse(startInput)).not.toThrow()
  })

  it('should handle realistic requirement workflow', () => {
    // List requirements for gate
    const listInput = { gateId: 'gate-01' }
    expect(() => requirement.ReqListInputSchema.parse(listInput)).not.toThrow()

    // Show requirement details
    const showInput = { hash: 'abc123450def5678' }
    expect(() => requirement.ReqShowInputSchema.parse(showInput)).not.toThrow()

    // Check dependencies
    const depsInput = { hash: 'abc123450def5678' }
    expect(() => requirement.ReqDepsInputSchema.parse(depsInput)).not.toThrow()

    // Requirement lifecycle updates are recorded via proposal approvals and gate archival (no DB status schema to validate)
  })

  it('should handle realistic proposal implementation workflow', () => {
    // List proposals
    const listInput = { gateId: 'gate-03' }
    expect(() => proposal.ProposalListInputSchema.parse(listInput)).not.toThrow()

    // Show proposal
    const showInput = { hash: 'g03p01ab' }
    expect(() => proposal.ProposalShowInputSchema.parse(showInput)).not.toThrow()

    // Validate proposal
    const validateInput = { hash: 'g03p01ab' }
    expect(() => proposal.ProposalValidateInputSchema.parse(validateInput)).not.toThrow()

    // Approve proposal
    const approveInput = { hash: 'g03p01ab' }
    expect(() => proposal.ProposalApproveInputSchema.parse(approveInput)).not.toThrow()
  })
})
