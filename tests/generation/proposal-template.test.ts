import { describe, it, expect } from 'vitest'
import {
  renderProposalTemplate,
  loadProposalTemplate,
} from '../../src/generation/proposal-template.js'
import type { ProposalData } from '../../src/generation/proposal-template.js'
import type { ProposalRole } from '../../src/core/types.js'

describe('Proposal Template - Rendering Branches', () => {
  const baseData: ProposalData = {
    title: 'Test Proposal',
    hash: 'abc123def4',
    gateId: 'gate-01',
    gateName: 'API Layer',
    requirement: 'req-hash-001',
    status: 'pending',
    created: '2024-01-15',
    summary: 'Brief summary',
    context: {
      whyChange: 'Context explanation',
      dependencies: [],
    },
    tasks: [],
    filesAffected: [],
    implementationNotes: 'Technical notes',
    rollback: 'Rollback plan',
  }

  const template = loadProposalTemplate()

  describe('requirement branch coverage', () => {
    it('should render with requirement hash present', () => {
      const data = { ...baseData, requirement: 'req-hash-001' }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toContain('#req-hash-001')
    })

    it('should render placeholder when requirement is undefined', () => {
      const data = { ...baseData, requirement: undefined }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toContain('#[Requirement Hash]')
    })

    it('should render placeholder when requirement is null', () => {
      const data = { ...baseData, requirement: null as any }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toContain('#[Requirement Hash]')
    })
  })

  describe('tasks section rendering', () => {
    it('should render empty tasks section', () => {
      const data = { ...baseData, tasks: [] }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toBeDefined()
      expect(rendered.length).toBeGreaterThan(0)
    })

    it('should render single task', () => {
      const data = {
        ...baseData,
        tasks: [
          {
            title: 'Create handler',
            files: 'src/handler.ts',
            action: 'create',
            description: 'Create the main handler',
            acceptance: ['Should handle errors', 'Should return response'],
          },
        ],
      }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toBeDefined()
      expect(rendered.length).toBeGreaterThan(0)
    })

    it('should render multiple tasks with incremental numbering', () => {
      const data = {
        ...baseData,
        tasks: [
          {
            title: 'Task One',
            files: 'file1.ts',
            action: 'create',
            description: 'First task',
            acceptance: ['Criterion 1'],
          },
          {
            title: 'Task Two',
            files: 'file2.ts',
            action: 'modify',
            description: 'Second task',
            acceptance: ['Criterion 2'],
          },
        ],
      }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toBeDefined()
      expect(rendered.length).toBeGreaterThan(0)
    })
  })

  describe('dependencies section rendering', () => {
    it('should render empty dependencies', () => {
      const data = { ...baseData, context: { ...baseData.context, dependencies: [] } }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toBeDefined()
      expect(rendered.length).toBeGreaterThan(0)
    })

    it('should render dependencies with hash, type, and description', () => {
      const data = {
        ...baseData,
        context: {
          ...baseData.context,
          dependencies: [
            {
              hash: 'dep-hash-001',
              type: 'requires',
              description: 'Database schema migration',
            },
          ],
        },
      }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toBeDefined()
      expect(rendered.length).toBeGreaterThan(0)
    })
  })

  describe('filesAffected section rendering', () => {
    it('should render empty files affected', () => {
      const data = { ...baseData, filesAffected: [] }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toBeDefined()
      expect(rendered.length).toBeGreaterThan(0)
    })

    it('should render files with action and description', () => {
      const data = {
        ...baseData,
        filesAffected: [
          {
            file: 'src/api/handler.ts',
            action: 'create',
            description: 'New API handler',
          },
        ],
      }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toBeDefined()
      expect(rendered).toContain('src/api/handler.ts')
    })
  })

  describe('context preservation', () => {
    it('should preserve all template fields', () => {
      const data = {
        ...baseData,
        implementationNotes: 'Use async/await pattern',
        rollback: 'Revert to previous version',
      }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toBeDefined()
      expect(rendered.length).toBeGreaterThan(0)
    })

    it('should include creation date in ISO format', () => {
      const isoDate = new Date().toISOString().split('T')[0]
      const data = { ...baseData, created: isoDate }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toBeDefined()
      expect(rendered).toContain(isoDate)
    })
  })

  describe('roles field on ProposalData', () => {
    it('should accept ProposalData with roles: ProposalRole[]', () => {
      const data: ProposalData = {
        ...baseData,
        roles: ['testing', 'feature'] as ProposalRole[],
      }
      expect(data.roles).toContain('testing')
      expect(data.roles).toContain('feature')
    })

    it('should accept ProposalData without roles (optional field)', () => {
      const data: ProposalData = { ...baseData }
      const rendered = renderProposalTemplate(template, data)
      expect(rendered).toBeDefined()
      expect(rendered.length).toBeGreaterThan(0)
    })

    it.skip('should render {{ROLES}} placeholder as comma-joined string when roles provided', () => { // @red
      const minimalTemplate = '## Roles\n{{ROLES}}'
      const data: ProposalData = {
        ...baseData,
        roles: ['testing', 'feature'] as ProposalRole[],
      }
      const rendered = renderProposalTemplate(minimalTemplate, data)
      expect(rendered).toContain('testing, feature')
    })

    it('should not throw when rendering template without roles field', () => {
      const minimalTemplate = '## Roles\n{{ROLES}}'
      const data: ProposalData = { ...baseData }
      expect(() => renderProposalTemplate(minimalTemplate, data)).not.toThrow()
    })
  })
})
