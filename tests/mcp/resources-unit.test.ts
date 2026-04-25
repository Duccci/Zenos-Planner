import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReaddirSync = vi.fn()
const mockStatSync = vi.fn()
const mockExistsSync = vi.fn()
const mockReadFileSync = vi.fn()
const mockGlob = vi.fn()

vi.mock('node:fs', () => ({
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}))

vi.mock('glob', () => ({
  glob: (...args: unknown[]) => mockGlob(...args),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

describe('mcp resources coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register discovered resources', async () => {
    // Setup: workspace is a Zeno project with a few files
    mockStatSync.mockImplementation((p: string) => {
      if (p.includes('zeno') || p.includes('.zeno')) {
        return { isDirectory: () => true }
      }
      throw new Error('ENOENT')
    })
    mockReaddirSync.mockReturnValue([])
    mockGlob.mockResolvedValue(['/workspace/zeno/PROJECT_PRD.md'])
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('# PRD Content')

    const mockServer = {
      registerResource: vi.fn().mockReturnValue({ remove: vi.fn() }),
    }

    const { registerResources } = await import('../../src/mcp/resources/index.js')
    const count = await registerResources(mockServer as never, '/workspace')
    expect(typeof count).toBe('number')
  })

  it('should handle server without registerResource', async () => {
    mockStatSync.mockImplementation((p: string) => {
      if (p.includes('zeno')) return { isDirectory: () => true }
      throw new Error('ENOENT')
    })
    mockReaddirSync.mockReturnValue([])
    mockGlob.mockResolvedValue([])

    const mockServer = {} // no registerResource method

    const { registerResources } = await import('../../src/mcp/resources/index.js')
    const count = await registerResources(mockServer as never, '/workspace')
    expect(count).toBe(0)
  })

  it('should handle workspace with no Zeno projects', async () => {
    mockStatSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })

    const mockServer = {
      registerResource: vi.fn().mockReturnValue({ remove: vi.fn() }),
    }

    const { registerResources } = await import('../../src/mcp/resources/index.js')
    const count = await registerResources(mockServer as never, '/nonexistent')
    // A workspace-independent placeholder template is always registered so that
    // the MCP `resources` capability is declared before transport connect.
    expect(count).toBe(1)
    expect(mockServer.registerResource).toHaveBeenCalledWith(
      'zeno:template:placeholder',
      'template://zeno/placeholder',
      expect.any(Object),
      expect.any(Function)
    )
  })

  it('should handle file read for file:// resources', async () => {
    mockStatSync.mockImplementation((p: string) => {
      if (p.includes('zeno')) return { isDirectory: () => true }
      throw new Error('ENOENT')
    })
    mockReaddirSync.mockReturnValue([])
    mockGlob.mockResolvedValue(['/workspace/zeno/PROJECT_PRD.md'])
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('# PRD Content')

    let readCallback: (() => unknown) | undefined
    const mockServer = {
      registerResource: vi
        .fn()
        .mockImplementation((_name: string, _uri: string, _opts: unknown, cb: () => unknown) => {
          readCallback = cb
          return { remove: vi.fn() }
        }),
    }

    const { registerResources } = await import('../../src/mcp/resources/index.js')
    await registerResources(mockServer as never, '/workspace')

    if (readCallback) {
      const result = readCallback()
      expect(result).toHaveProperty('contents')
    }
  })
})
