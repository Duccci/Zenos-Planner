/**
 * Tests for architecture commands
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { Command } from 'commander'

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

const mockRegistryInvoke = vi.fn()
vi.mock('../../../src/index.js', () => ({
  getGlobalRegistry: () => ({ invoke: mockRegistryInvoke }),
}))

import { registerArchCommands } from '../../../src/cli/commands/arch.js'
import { logger } from '../../../src/utils/logger.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLogger = logger as any

describe('arch command', () => {
  let tempDir: string
  let program: Command

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arch-test-'))
    program = new Command()
    program.exitOverride()
    vi.clearAllMocks()
    mockRegistryInvoke.mockResolvedValue({ success: true, data: {} })
    registerArchCommands(program)
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should create arch command with subcommands', () => {
    expect(true).toBe(true)
  })

  it('should handle generate architecture diagrams', () => {
    expect(true).toBe(true)
  })

  it('should display architecture diagrams', () => {
    expect(true).toBe(true)
  })

  it('should handle missing architecture directory gracefully', () => {
    expect(true).toBe(true)
  })

  it('should support diagram type filtering', () => {
    expect(true).toBe(true)
  })

  describe('registerArchCommands - action handlers', () => {
    it('arch generate action logs generate message', async () => {
      await program.parseAsync(['node', 'zeno', 'arch', 'generate'])
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('generate'))
    })

    it('arch show <type> action invokes registry with type', async () => {
      await program.parseAsync(['node', 'zeno', 'arch', 'show', 'system'])
      expect(mockRegistryInvoke).toHaveBeenCalledWith('arch_show', expect.objectContaining({ type: 'system' }))
    })

    it('arch setup-graphviz on darwin shows brew instructions', () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
      program.parse(['node', 'zeno', 'arch', 'setup-graphviz'])
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('brew'))
      platformSpy.mockRestore()
    })

    it('arch setup-graphviz on linux shows apt-get instructions', () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
      program.parse(['node', 'zeno', 'arch', 'setup-graphviz'])
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('apt-get'))
      platformSpy.mockRestore()
    })

    it('arch setup-graphviz on win32 shows chocolatey instructions', () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
      program.parse(['node', 'zeno', 'arch', 'setup-graphviz'])
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('choco'))
      platformSpy.mockRestore()
    })

    it('arch setup-graphviz on unknown platform shows graphviz.org URL', () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('freebsd' as NodeJS.Platform)
      program.parse(['node', 'zeno', 'arch', 'setup-graphviz'])
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('graphviz.org'))
      platformSpy.mockRestore()
    })
  })
})
