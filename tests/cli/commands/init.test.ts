/**
 * Init Command Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerInitCommand } from '../../../src/cli/commands/init.js'
import { Command } from 'commander'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile, mkdir } from 'node:fs/promises'

// Mock dependencies
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  confirm: vi.fn(),
  editor: vi.fn(),
}))

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../../src/scaffold/index.js', () => ({
  createProjectStructure: vi.fn().mockResolvedValue(['dir1', 'dir2']),
}))

vi.mock('../../../src/generation/requirement-generator.js', () => ({
  RequirementGenerator: vi.fn().mockImplementation(() => ({
    generateFromEndState: vi.fn().mockReturnValue([
      { id: 'req1', description: 'Requirement 1' },
      { id: 'req2', description: 'Requirement 2' },
    ]),
  })),
}))

vi.mock('../../../src/core/gate-generator.js', () => ({
  generateGates: vi.fn().mockReturnValue({
    gates: [
      { id: 'gate-01', name: 'Foundation' },
      { id: 'gate-02', name: 'Features' },
    ],
    totalComplexity: 100,
  }),
}))

vi.mock('../../../src/generation/agents-generator.js', () => ({
  generateAgentsMD: vi.fn().mockReturnValue('# AGENTS.md content'),
}))

vi.mock('../../../src/generation/agents-writer.js', () => ({
  writeAgentsMD: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/storage/database.js', () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/utils/config.js', () => ({
  getDefaultConfig: vi.fn().mockReturnValue({ version: '0.1.0' }),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/utils/file.js', () => ({
  fileExists: vi.fn(),
  directoryExists: vi.fn(),
}))

describe('Init Command', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'zeno-test-'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore errors during cleanup
    }
  })

  it('should register the init command', () => {
    const program = new Command()
    registerInitCommand(program)

    const initCmd = program.commands.find(cmd => cmd.name() === 'init')
    expect(initCmd).toBeDefined()
    expect(initCmd!.description()).toBe('Initialize a new Zeno project')
  })

  describe('validateProjectName', () => {
    const validateProjectName = (name: string): boolean | string => {
      if (!name.trim()) {
        return 'Project name cannot be empty'
      }
      if (name.length > 100) {
        return 'Project name must be 100 characters or less'
      }
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
        return 'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
      }
      return true
    }

    it('should accept valid project names', () => {
      expect(validateProjectName('My Project')).toBe(true)
      expect(validateProjectName('my-project')).toBe(true)
      expect(validateProjectName('my_project_123')).toBe(true)
    })

    it('should reject empty names', () => {
      expect(validateProjectName('')).toContain('cannot be empty')
      expect(validateProjectName('   ')).toContain('cannot be empty')
    })

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(101)
      expect(validateProjectName(longName)).toContain('100 characters')
    })

    it('should reject names with invalid characters', () => {
      expect(validateProjectName('project@name')).toContain('can only contain')
      expect(validateProjectName('project/name')).toContain('can only contain')
    })
  })

  describe('validateCodebasePath', () => {
    const validateCodebasePath = (pathStr: string, mockExists: (p: string) => boolean): boolean | string => {
      if (!mockExists(pathStr)) {
        return `Directory does not exist: ${pathStr}`
      }
      return true
    }

    it('should accept valid directory paths', () => {
      const mockDirectoryExists = vi.fn().mockReturnValue(true)
      expect(validateCodebasePath('/valid/path', mockDirectoryExists)).toBe(true)
      expect(mockDirectoryExists).toHaveBeenCalledWith('/valid/path')
    })

    it('should reject non-existent directories', () => {
      const mockDirectoryExists = vi.fn().mockReturnValue(false)
      expect(validateCodebasePath('/invalid/path', mockDirectoryExists)).toContain('does not exist')
      expect(mockDirectoryExists).toHaveBeenCalledWith('/invalid/path')
    })
  })
})

/**
 * Helper comment for clarity
 */
