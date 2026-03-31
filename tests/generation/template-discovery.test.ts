/**
 * Template Discovery - Branch Coverage Tests
 *
 * Tests uncovered branches: non-md files, frontmatter parsing,
 * invalid file error, readdir failure, empty frontmatter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}))

describe('template-discovery branches', () => {
  beforeEach(() => vi.clearAllMocks())

  it('discovers templates with frontmatter description', async () => {
    const fs = await import('fs')
    const { discoverTemplates } = await import('../../src/generation/template-discovery.js')

    vi.mocked(fs.promises.readdir)
      .mockResolvedValueOnce(['proposal-template.md', 'notes.txt'] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any)

    vi.mocked(fs.promises.readFile).mockResolvedValueOnce(
      '---\ndescription: A proposal template\n---\n# Template\nContent here.' as any
    )

    const templates = await discoverTemplates('/project')
    expect(templates.length).toBe(1)
    expect(templates[0]!.description).toBe('A proposal template')
    expect(templates[0]!.category).toBe('markdown')
  })

  it('skips non-md files (continue branch)', async () => {
    const fs = await import('fs')
    const { discoverTemplates } = await import('../../src/generation/template-discovery.js')

    vi.mocked(fs.promises.readdir)
      .mockResolvedValueOnce(['readme.txt', 'data.json'] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any)

    const templates = await discoverTemplates('/project')
    expect(templates.length).toBe(0)
  })

  it('handles readdir failure gracefully (catch branch)', async () => {
    const fs = await import('fs')
    const { discoverTemplates } = await import('../../src/generation/template-discovery.js')

    vi.mocked(fs.promises.readdir)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'))

    const templates = await discoverTemplates('/missing')
    expect(templates.length).toBe(0)
  })

  it('uses first line as description when no frontmatter', async () => {
    const fs = await import('fs')
    const { discoverTemplates } = await import('../../src/generation/template-discovery.js')

    vi.mocked(fs.promises.readdir)
      .mockResolvedValueOnce(['gate-template.md'] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any)

    vi.mocked(fs.promises.readFile).mockResolvedValueOnce(
      '# Gate Template\nSome content here.' as any
    )

    const templates = await discoverTemplates('/project')
    expect(templates.length).toBe(1)
    expect(templates[0]!.description).toBe('# Gate Template')
  })

  it('handles readFile failure for individual files (inner catch)', async () => {
    const fs = await import('fs')
    const { discoverTemplates } = await import('../../src/generation/template-discovery.js')

    vi.mocked(fs.promises.readdir)
      .mockResolvedValueOnce(['bad.md', 'good.md'] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any)

    vi.mocked(fs.promises.readFile)
      .mockRejectedValueOnce(new Error('Permission denied'))
      .mockResolvedValueOnce('# Good Template\nOK' as any)

    const templates = await discoverTemplates('/project')
    // bad.md skipped, good.md should be included
    expect(templates.length).toBe(1)
  })

  it('discovers architecture templates', async () => {
    const fs = await import('fs')
    const { discoverTemplates } = await import('../../src/generation/template-discovery.js')

    vi.mocked(fs.promises.readdir)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce(['overview-template.md'] as any)
      .mockResolvedValueOnce([] as any)

    vi.mocked(fs.promises.readFile).mockResolvedValueOnce(
      '---\ndesc: Architecture overview\n---\n# Overview' as any
    )

    const templates = await discoverTemplates('/project')
    expect(templates.length).toBe(1)
    expect(templates[0]!.category).toBe('architecture')
    expect(templates[0]!.description).toBe('Architecture overview')
  })

  it('uses desc field from frontmatter as fallback', async () => {
    const fs = await import('fs')
    const { discoverTemplates } = await import('../../src/generation/template-discovery.js')

    vi.mocked(fs.promises.readdir)
      .mockResolvedValueOnce(['t.md'] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any)

    vi.mocked(fs.promises.readFile).mockResolvedValueOnce('---\ndesc: Short desc\n---\n# T' as any)

    const templates = await discoverTemplates('/project')
    expect(templates[0]!.description).toBe('Short desc')
  })

  it('loads template content via loadTemplateContent', async () => {
    const fs = await import('fs')
    const { loadTemplateContent } = await import('../../src/generation/template-discovery.js')

    vi.mocked(fs.promises.readFile).mockResolvedValueOnce('# Full Template Content' as any)

    const content = await loadTemplateContent('/project', 'templates/md-templates/test.md')
    expect(content).toBe('# Full Template Content')
  })
})
