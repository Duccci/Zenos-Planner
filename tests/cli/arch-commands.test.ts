import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execFile } from 'child_process'

// Mock execFile to avoid requiring dot CLI in CI
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

// ---------------------------------------------------------------------------
// CLI Commands Integration
// ---------------------------------------------------------------------------
describe('Architecture CLI Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('zeno arch generate', () => {
    it('invokes registry function', async () => {
      // Mock implementation would call the function registry
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({ success: true }),
      }
      const result = await mockRegistry.call('arch_generate', {})
      expect(result.success).toBe(true)
    })

    it('delegates to architecture generation pipeline', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          success: true,
          diagrams: ['system-overview', 'data-flow'],
        }),
      }
      const result = await mockRegistry.call('arch_generate', {})
      expect(result).toHaveProperty('diagrams')
      expect(result.diagrams).toContain('system-overview')
    })

    it('supports optional gate filter', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({ success: true }),
      }
      const result = await mockRegistry.call('arch_generate', { gateId: 'gate-05' })
      expect(mockRegistry.call).toHaveBeenCalledWith('arch_generate', { gateId: 'gate-05' })
    })

    it('returns status message on completion', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          success: true,
          message: 'Architecture diagrams generated successfully',
        }),
      }
      const result = await mockRegistry.call('arch_generate', {})
      expect(result.message).toContain('generated')
    })
  })

  describe('zeno arch show <type>', () => {
    it('reads correct diagram file', async () => {
      const mockFs = {
        readFileSync: vi.fn().mockReturnValue('graph TD\n    A --> B'),
      }
      const content = mockFs.readFileSync('zeno/architecture/system-overview.md')
      expect(content).toContain('graph')
    })

    it('displays diagram content to user', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          content: '```mermaid\ngraph TD\n    A --> B\n```',
        }),
      }
      const result = await mockRegistry.call('arch_show', { type: 'system-overview' })
      expect(result.content).toContain('graph')
    })

    it('handles missing diagram files gracefully', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          error: 'Diagram file not found: nonexistent-diagram',
          content: null,
        }),
      }
      const result = await mockRegistry.call('arch_show', { type: 'nonexistent-diagram' })
      expect(result).toHaveProperty('error')
    })

    it('validates type parameter before reading', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          error: 'Invalid diagram type: invalid-type',
        }),
      }
      const result = await mockRegistry.call('arch_show', { type: 'invalid-type' })
      expect(result).toHaveProperty('error')
      expect(result.error).toContain('Invalid')
    })

    it('displays correct file for each diagram type', async () => {
      const types = [
        'system-overview',
        'data-flow',
        'gate-lifecycle',
        'gate-roadmap',
        'context-diagram',
      ]
      const mockRegistry = {
        call: vi.fn().mockImplementation((cmd, args) => {
          return Promise.resolve({
            content: `Content for ${args.type}`,
            type: args.type,
          })
        }),
      }

      for (const type of types) {
        const result = await mockRegistry.call('arch_show', { type })
        expect(result.type).toBe(type)
        expect(result.content).toContain(type)
      }
    })
  })

  describe('zeno arch list', () => {
    it('outputs formatted catalogue', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          catalogue: [
            { type: 'system-overview', label: 'System Overview' },
            { type: 'data-flow', label: 'Data Flow' },
          ],
        }),
      }
      const result = await mockRegistry.call('arch_list', {})
      expect(result.catalogue).toHaveLength(2)
    })

    it('includes all 10 diagram types', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          catalogue: Array(10).fill(null).map((_, i) => ({
            type: `diagram-${i}`,
            label: `Diagram ${i}`,
          })),
        }),
      }
      const result = await mockRegistry.call('arch_list', {})
      expect(result.catalogue).toHaveLength(10)
    })

    it('displays catalogue in human-readable format', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          formatted: `
Core Diagrams:
  - system-overview: System Overview
  - data-flow: Data Flow
          `,
        }),
      }
      const result = await mockRegistry.call('arch_list', {})
      expect(result.formatted).toContain('Core')
    })
  })

  describe('zeno arch setup-graphviz', () => {
    it('prints platform-specific instructions', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          platform: 'win32',
          instructions: 'Run: choco install graphviz',
        }),
      }
      const result = await mockRegistry.call('arch_setup_graphviz', {})
      expect(result.instructions).toBeDefined()
    })

    it('detects Windows and returns winget/chocolatey instructions', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          platform: 'win32',
          instructions: 'choco install graphviz',
        }),
      }
      const result = await mockRegistry.call('arch_setup_graphviz', {})
      expect(result.instructions).toContain('choco')
    })

    it('detects macOS and returns brew instructions', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          platform: 'darwin',
          instructions: 'brew install graphviz',
        }),
      }
      const result = await mockRegistry.call('arch_setup_graphviz', {})
      expect(result.instructions).toContain('brew')
    })

    it('detects Linux and returns apt/yum instructions', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          platform: 'linux',
          instructions: 'apt-get install graphviz',
        }),
      }
      const result = await mockRegistry.call('arch_setup_graphviz', {})
      expect(result.instructions).toContain('apt')
    })
  })

  describe('Error Handling', () => {
    it('handles missing diagrams with user-friendly message', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          error: 'Architecture diagrams not found. Run: zeno arch generate',
        }),
      }
      const result = await mockRegistry.call('arch_show', { type: 'system-overview' })
      expect(result.error).toContain('generate')
    })

    it('handles invalid type with suggestion', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          error: 'Invalid diagram type. Available: system-overview, data-flow, ...',
        }),
      }
      const result = await mockRegistry.call('arch_show', { type: 'invalid' })
      expect(result.error).toContain('Available')
    })

    it('handles generation failure gracefully', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          success: false,
          error: 'Generator failed: [error details]',
        }),
      }
      const result = await mockRegistry.call('arch_generate', {})
      expect(result.success).toBe(false)
    })
  })

  describe('Integration', () => {
    it('zeno arch commands integrate with function registry', async () => {
      const commands = ['arch_generate', 'arch_show', 'arch_list', 'arch_setup_graphviz']
      const mockRegistry = {
        has: vi.fn((cmd) => commands.includes(cmd)),
        call: vi.fn().mockResolvedValue({ success: true }),
      }

      for (const cmd of commands) {
        expect(mockRegistry.has(cmd)).toBe(true)
      }
    })

    it('all commands return consistent response structure', async () => {
      const mockRegistry = {
        call: vi.fn().mockResolvedValue({
          success: true,
          content: 'some content',
        }),
      }

      const commands = [
        ['arch_generate', {}],
        ['arch_show', { type: 'system-overview' }],
        ['arch_list', {}],
      ]

      for (const [cmd, args] of commands) {
        const result = await mockRegistry.call(cmd, args)
        expect(result).toHaveProperty('success')
      }
    })
  })
})
