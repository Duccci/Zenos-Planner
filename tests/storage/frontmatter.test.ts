import { describe, it, expect } from 'vitest'
import {
  parseFrontmatter,
  stripFrontmatter,
  serializeProposalFrontmatter,
  serializeGateFrontmatter,
  patchFrontmatter,
  parseProposalFrontmatter,
  parseGateFrontmatter,
} from '../../src/storage/frontmatter.js'

const PROPOSAL_FM = `---
zeno:
  hash: abc12345
  gate_id: gate-06
  status: pending
  created_at: '2026-03-01'
---

# Proposal: Test
`

const GATE_FM = `---
zeno:
  id: gate-06
  name: Multi-Repo Support
  sequence: 6
  type: feature
  status: pending
  hash: def67890
  project_id: default-project
  depends_on:
    - gate-05
---

# Gate 6: Multi-Repo Support
`

describe('frontmatter', () => {
  describe('parseFrontmatter', () => {
    it('parses zeno: block from valid YAML frontmatter', () => {
      const result = parseFrontmatter(PROPOSAL_FM)
      expect(result).toBeDefined()
      expect(result?.['hash']).toBe('abc12345')
      expect(result?.['gate_id']).toBe('gate-06')
    })

    it('returns null when no frontmatter block', () => {
      expect(parseFrontmatter('# Just a heading\n\nSome content.')).toBeNull()
    })

    it('returns null when YAML has no zeno: key', () => {
      const noZeno = '---\ntitle: "Not a zeno file"\n---\n# Heading\n'
      expect(parseFrontmatter(noZeno)).toBeNull()
    })

    it('returns null when zeno value is not an object', () => {
      const scalar = '---\nzeno: just-a-string\n---\n# Heading\n'
      expect(parseFrontmatter(scalar)).toBeNull()
    })

    it('returns null when YAML is unparseable', () => {
      // yaml.load returns null for empty content — handled by !parsed?.zeno path
      const empty = '---\n\n---\n# Heading\n'
      expect(parseFrontmatter(empty)).toBeNull()
    })
  })

  describe('stripFrontmatter', () => {
    it('removes the --- fence block', () => {
      const result = stripFrontmatter(PROPOSAL_FM)
      expect(result).not.toContain('---')
      expect(result).toContain('# Proposal: Test')
    })

    it('is a no-op when no frontmatter', () => {
      const plain = '# Heading\n\nBody text.\n'
      expect(stripFrontmatter(plain)).toBe(plain)
    })
  })

  describe('serializeProposalFrontmatter', () => {
    it('produces a YAML block containing required fields', () => {
      const result = serializeProposalFrontmatter({
        hash: 'abc12345',
        gate_id: 'gate-06',
        status: 'pending',
      })
      expect(result.startsWith('---\n')).toBe(true)
      expect(result).toContain('hash: abc12345')
      expect(result).toContain('gate_id: gate-06')
      expect(result).toContain('status: pending')
    })

    it('omits null and undefined values', () => {
      const result = serializeProposalFrontmatter({
        hash: 'abc12345',
        gate_id: null,
        requirement_id: undefined,
        approved_at: null,
      })
      expect(result).not.toContain('gate_id')
      expect(result).not.toContain('requirement_id')
      expect(result).not.toContain('approved_at')
    })
  })

  describe('serializeGateFrontmatter', () => {
    it('produces a YAML block with all gate fields', () => {
      const result = serializeGateFrontmatter({
        id: 'gate-06',
        name: 'Multi-Repo Support',
        sequence: 6,
        type: 'feature',
        status: 'pending',
        hash: 'def67890',
        depends_on: ['gate-05'],
      })
      expect(result).toContain('id: gate-06')
      expect(result).toContain('sequence: 6')
      expect(result).toContain('gate-05')
    })

    it('omits null fields (e.g. completed_at)', () => {
      const result = serializeGateFrontmatter({
        id: 'gate-01',
        name: 'Init',
        sequence: 1,
        type: 'feature',
        status: 'pending',
        hash: 'aabbccdd',
        completed_at: null,
      })
      expect(result).not.toContain('completed_at')
    })
  })

  describe('patchFrontmatter', () => {
    it('replaces existing frontmatter with new data', () => {
      const patched = patchFrontmatter(PROPOSAL_FM, { hash: 'newhash99', status: 'approved' })
      expect(patched).toContain('hash: newhash99')
      expect(patched).toContain('status: approved')
      expect(patched).not.toContain('abc12345')
      expect(patched).toContain('# Proposal: Test')
    })

    it('prepends frontmatter to content that has none', () => {
      const plain = '# My Proposal\n\nContent here.\n'
      const patched = patchFrontmatter(plain, { hash: 'newhash99' })
      expect(patched.startsWith('---\n')).toBe(true)
      expect(patched).toContain('# My Proposal')
    })
  })

  describe('parseProposalFrontmatter', () => {
    it('parses a valid proposal frontmatter block', () => {
      const result = parseProposalFrontmatter(PROPOSAL_FM)
      expect(result).not.toBeNull()
      expect(result?.hash).toBe('abc12345')
      expect(result?.gate_id).toBe('gate-06')
      expect(result?.status).toBe('pending')
    })

    it('returns null when no frontmatter', () => {
      expect(parseProposalFrontmatter('# No frontmatter')).toBeNull()
    })

    it('returns null when hash is missing', () => {
      const noHash = '---\nzeno:\n  gate_id: gate-06\n  status: pending\n---\n# Proposal\n'
      expect(parseProposalFrontmatter(noHash)).toBeNull()
    })

    it('returns null defaults for absent optional fields', () => {
      const minimal = '---\nzeno:\n  hash: abc12345\n---\n# Proposal\n'
      const result = parseProposalFrontmatter(minimal)
      expect(result?.gate_id).toBeNull()
      expect(result?.requirement_id).toBeNull()
      expect(result?.approved_at).toBeNull()
      expect(result?.rejected_at).toBeNull()
      expect(result?.started_at).toBeNull()
      expect(result?.implemented_at).toBeNull()
    })

    it('preserves defined optional fields', () => {
      const content = '---\nzeno:\n  hash: abc12345\n  approved_by: alice\n  started_at: \'2026-03-01\'\n---\n'
      const result = parseProposalFrontmatter(content)
      expect(result?.approved_by).toBe('alice')
      expect(result?.started_at).toBe('2026-03-01')
    })
  })

  describe('parseGateFrontmatter', () => {
    it('parses a valid gate frontmatter block', () => {
      const result = parseGateFrontmatter(GATE_FM)
      expect(result).not.toBeNull()
      expect(result?.id).toBe('gate-06')
      expect(result?.name).toBe('Multi-Repo Support')
      expect(result?.sequence).toBe(6)
      expect(result?.depends_on).toEqual(['gate-05'])
    })

    it('returns null when no frontmatter', () => {
      expect(parseGateFrontmatter('# No frontmatter')).toBeNull()
    })

    it('returns null when id is missing', () => {
      const noId = '---\nzeno:\n  name: Test Gate\n  hash: abc12345\n---\n# Gate\n'
      expect(parseGateFrontmatter(noId)).toBeNull()
    })

    it('returns null when name is missing', () => {
      const noName = '---\nzeno:\n  id: gate-01\n  hash: abc12345\n---\n# Gate\n'
      expect(parseGateFrontmatter(noName)).toBeNull()
    })

    it('returns null when hash is missing', () => {
      const noHash = '---\nzeno:\n  id: gate-01\n  name: Test Gate\n---\n# Gate\n'
      expect(parseGateFrontmatter(noHash)).toBeNull()
    })

    it('applies defaults for type and status when absent', () => {
      const minimal = '---\nzeno:\n  id: gate-01\n  name: Test Gate\n  hash: abc12345\n---\n# Gate\n'
      const result = parseGateFrontmatter(minimal)
      expect(result?.type).toBe('feature')
      expect(result?.status).toBe('pending')
      expect(result?.project_id).toBe('default-project')
      expect(result?.depends_on).toEqual([])
    })

    it('coerces sequence to number', () => {
      const content = '---\nzeno:\n  id: gate-03\n  name: API\n  hash: abc12345\n  sequence: 3\n---\n'
      const result = parseGateFrontmatter(content)
      expect(result?.sequence).toBe(3)
      expect(typeof result?.sequence).toBe('number')
    })
  })
})
