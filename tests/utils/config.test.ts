import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, mkdtemp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  ZenoConfigSchema,
  getZenoDir,
  getConfigPath,
  findProjectRoot,
  getDefaultConfig,
  loadConfig,
  saveConfig,
  isZenoProject,
} from '../../src/utils/config.js'

describe('config utilities', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'zeno-test-config-'))
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  describe('ZenoConfigSchema', () => {
    it('validates valid config', () => {
      const config = {
        projectName: 'Test Project',
        version: '1.0.0',
        qualityThresholds: {
          codeCoverage: 90,
          securityVulnerabilities: 0,
          lintingErrorRate: 0.01,
          typeCheckingErrors: 0,
        },
        hashAlgorithm: 'sha256',
        hashLength: 16,
      }

      const result = ZenoConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('requires projectName', () => {
      const config = {
        endState: 'Goal',
      }

      const result = ZenoConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })

    it('rejects empty projectName', () => {
      const config = {
        projectName: '',
      }

      const result = ZenoConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })

    it('applies defaults for optional fields', () => {
      const config = {
        projectName: 'Test',
      }

      const result = ZenoConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.version).toBe('0.1.0')
        expect(result.data.qualityThresholds.codeCoverage).toBe(90)
        expect(result.data.hashAlgorithm).toBe('sha256')
        expect(result.data.hashLength).toBe(16)
      }
    })
  })

  describe('getZenoDir', () => {
    it('returns zeno/.zeno path for project root', () => {
      const result = getZenoDir('/project')
      expect(result).toContain('zeno')
      expect(result).toContain('.zeno')
    })

    it('uses cwd as default', () => {
      const result = getZenoDir()
      expect(result).toContain('zeno')
      expect(result).toContain('.zeno')
    })
  })

  describe('getConfigPath', () => {
    it('returns config.json path inside zeno/.zeno', () => {
      const result = getConfigPath('/project')
      expect(result).toContain('zeno')
      expect(result).toContain('.zeno')
      expect(result).toContain('config.json')
    })
  })

  describe('findProjectRoot', () => {
    it('finds project root with zeno/.zeno directory', async () => {
      const zenoDir = join(testDir, 'zeno', '.zeno')
      await mkdir(zenoDir, { recursive: true })

      const result = findProjectRoot(testDir)
      expect(result).toBe(testDir.replace(/\\/g, '/'))
    })

    it('returns null when no zeno/.zeno found', () => {
      const result = findProjectRoot(testDir)
      expect(result).toBeNull()
    })

    it('finds root from subdirectory', async () => {
      const zenoDir = join(testDir, 'zeno', '.zeno')
      const subDir = join(testDir, 'src', 'utils')
      await mkdir(zenoDir, { recursive: true })
      await mkdir(subDir, { recursive: true })

      const result = findProjectRoot(subDir)
      expect(result).toBe(testDir.replace(/\\/g, '/'))
    })
  })

  describe('getDefaultConfig', () => {
    it('creates config with required fields', () => {
      const config = getDefaultConfig('My Project')

      expect(config.projectName).toBe('My Project')
      expect(config.version).toBe('0.1.0')
      expect(config.hashAlgorithm).toBe('sha256')
      expect(config.hashLength).toBe(16)
      expect(config.qualityThresholds.codeCoverage).toBe(90)
    })
  })

  describe('loadConfig', () => {
    it('loads valid config file', async () => {
      const zenoDir = join(testDir, 'zeno', '.zeno')
      await mkdir(zenoDir, { recursive: true })

      const config = {
        projectName: 'Test',
        version: '1.0.0',
        qualityThresholds: {
          codeCoverage: 90,
          securityVulnerabilities: 0,
          lintingErrorRate: 0.01,
          typeCheckingErrors: 0,
        },
        hashAlgorithm: 'sha256',
        hashLength: 16,
      }
      await writeFile(join(zenoDir, 'config.json'), JSON.stringify(config), 'utf-8')

      const loaded = await loadConfig(testDir)
      expect(loaded.projectName).toBe('Test')
    })

    it('throws for missing config file', async () => {
      await expect(loadConfig(testDir)).rejects.toThrow('Configuration file not found')
    })

    it('throws for invalid config', async () => {
      const zenoDir = join(testDir, 'zeno', '.zeno')
      await mkdir(zenoDir, { recursive: true })
      await writeFile(join(zenoDir, 'config.json'), '{"invalid": true}', 'utf-8')

      await expect(loadConfig(testDir)).rejects.toThrow()
    })
  })

  describe('saveConfig', () => {
    it('saves config to file', async () => {
      const zenoDir = join(testDir, 'zeno', '.zeno')
      await mkdir(zenoDir, { recursive: true })

      const config = getDefaultConfig('Test')
      await saveConfig(config, testDir)

      const loaded = await loadConfig(testDir)
      expect(loaded.projectName).toBe('Test')
    })

    it('throws for invalid config', async () => {
      const invalidConfig = { projectName: '' } as never

      await expect(saveConfig(invalidConfig, testDir)).rejects.toThrow('Invalid configuration')
    })
  })

  describe('isZenoProject', () => {
    it('returns true when config exists', async () => {
      const zenoDir = join(testDir, 'zeno', '.zeno')
      await mkdir(zenoDir, { recursive: true })

      const config = getDefaultConfig('Test')
      await writeFile(join(zenoDir, 'config.json'), JSON.stringify(config), 'utf-8')

      expect(isZenoProject(testDir)).toBe(true)
    })

    it('returns false when no config', () => {
      expect(isZenoProject(testDir)).toBe(false)
    })
  })

  describe('findProjectRoot edge cases', () => {
    it('handles reaching root without finding .zeno', () => {
      // Test with an isolated temp directory that definitely has no .zeno
      const result = findProjectRoot(testDir)
      expect(result).toBeNull()
    })
  })

  describe('loadConfig edge cases', () => {
    it('wraps non-ConfigError exceptions', async () => {
      const zenoDir = join(testDir, 'zeno', '.zeno')
      await mkdir(zenoDir, { recursive: true })
      // Write invalid JSON that will fail parsing
      await writeFile(join(zenoDir, 'config.json'), 'not json', 'utf-8')

      await expect(loadConfig(testDir)).rejects.toThrow()
    })

    it('re-throws ConfigError from readJsonFile', async () => {
      const zenoDir = join(testDir, 'zeno', '.zeno')
      await mkdir(zenoDir, { recursive: true })
      // Write JSON that's valid but doesn't match schema (empty projectName)
      await writeFile(join(zenoDir, 'config.json'), '{"projectName": ""}', 'utf-8')

      await expect(loadConfig(testDir)).rejects.toThrow()
    })
  })

})

