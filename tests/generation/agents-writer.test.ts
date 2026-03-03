import { describe, it, expect, vi, beforeEach } from 'vitest'
import { writeAgentsMD } from '../../src/generation/agents-writer.js'
import { ZENO_BLOCK_START, ZENO_BLOCK_END } from '../../src/generation/agents-generator.js'
import { readFile } from 'fs/promises'

const mockWriteFile = vi.fn()

// Mock fs/promises for readFile (agents-writer imports readFile directly from here)
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}))

// Mock the file utility used for writing (agents-writer imports writeFile from here)
vi.mock('../../src/utils/file.js', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

const INNER = '## Zeno Planner: MCP Tool Dispatch\n**Project**: My Project\n**Last Updated**: 2024-01-01'
const FULL_BLOCK = `${ZENO_BLOCK_START}\n${INNER}\n${ZENO_BLOCK_END}`

describe('Agents Writer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteFile.mockResolvedValue(undefined)
  })

  it('creates AGENTS.md with shell + block when file does not exist', async () => {
    ;(readFile as any).mockRejectedValue(new Error('File not found'))
    const basePath = '/project'

    const result = await writeAgentsMD(INNER, basePath)

    expect(result).toContain('AGENTS.md')
    const [writtenPath, writtenContent] = mockWriteFile.mock.calls[0] as [string, string]
    expect(writtenPath).toContain('AGENTS.md')
    expect(writtenPath).not.toContain('zeno')
    expect(writtenContent).toContain(ZENO_BLOCK_START)
    expect(writtenContent).toContain(ZENO_BLOCK_END)
    expect(writtenContent).toContain(INNER)
  })

  it('surgically replaces existing ZENO block when markers are present', async () => {
    const existingContent = `# My Project\n\nUser notes here.\n\n${FULL_BLOCK}\n\n## User Section\n`
    ;(readFile as any).mockResolvedValue(existingContent)
    const newInner = '## Zeno Planner: MCP Tool Dispatch\n**Project**: My Project\n**Last Updated**: 2024-06-01'
    const basePath = '/project'

    await writeAgentsMD(newInner, basePath)

    const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string]
    // User content outside markers must be preserved
    expect(writtenContent).toContain('# My Project')
    expect(writtenContent).toContain('User notes here.')
    expect(writtenContent).toContain('## User Section')
    // New inner content replaces old
    expect(writtenContent).toContain(newInner)
    // Old inner content gone
    expect(writtenContent).not.toContain('2024-01-01')
    // Markers still present
    expect(writtenContent).toContain(ZENO_BLOCK_START)
    expect(writtenContent).toContain(ZENO_BLOCK_END)
  })

  it('appends block when file exists but has no ZENO markers', async () => {
    ;(readFile as any).mockResolvedValue('# Existing AGENTS\n\nSome user content.\n')
    const basePath = '/project'

    await writeAgentsMD(INNER, basePath)

    const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string]
    expect(writtenContent).toContain('# Existing AGENTS')
    expect(writtenContent).toContain('Some user content.')
    expect(writtenContent).toContain(ZENO_BLOCK_START)
    expect(writtenContent).toContain(INNER)
  })
})
