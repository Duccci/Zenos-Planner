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
  toSlug,
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
        projectStatement: 'Goal',
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
    it('finds project root with zeno/.zeno/config.json', async () => {
      const zenoDir = join(testDir, 'zeno', '.zeno')
      await mkdir(zenoDir, { recursive: true })
      await writeFile(join(zenoDir, 'config.json'), JSON.stringify({ projectName: 'Test' }), 'utf-8')

      const result = findProjectRoot(testDir)
      expect(result).toBe(testDir.replace(/\\/g, '/'))
    })

    it('returns null when no zeno/.zeno found', () => {
      const result = findProjectRoot(testDir)
      expect(result).toBeNull()
    })

    it('returns null when zeno/.zeno exists but has no config.json', async () => {
      const zenoDir = join(testDir, 'zeno', '.zeno')
      await mkdir(zenoDir, { recursive: true })
      // directory exists but no config.json
      const result = findProjectRoot(testDir)
      expect(result).toBeNull()
    })

    it('finds root from subdirectory', async () => {
      const zenoDir = join(testDir, 'zeno', '.zeno')
      const subDir = join(testDir, 'src', 'utils')
      await mkdir(zenoDir, { recursive: true })
      await mkdir(subDir, { recursive: true })
      await writeFile(join(zenoDir, 'config.json'), JSON.stringify({ projectName: 'Test' }), 'utf-8')

      const result = findProjectRoot(subDir)
      expect(result).toBe(testDir.replace(/\\/g, '/'))
    })

    it('prefers consumer project root over a mounted submodule', async () => {
      // Simulate: consumer uses standalone layout, planner is a submodule at zeno/
      //   <consumer>/
      //     .zeno/config.json          ← consumer's own config (standalone)
      //     zeno/                      ← submodule (planner repo)
      //       .git                     ← FILE (gitdir pointer for submodule)
      //       zeno/.zeno/config.json   ← planner's own self-planning config

      const consumerRoot = testDir
      const submoduleRoot = join(consumerRoot, 'zeno')
      const submoduleZenoDir = join(submoduleRoot, 'zeno', '.zeno')
      const consumerStandalone = join(consumerRoot, '.zeno')

      await mkdir(submoduleZenoDir, { recursive: true })
      await writeFile(
        join(submoduleZenoDir, 'config.json'),
        JSON.stringify({ projectName: 'Zenos-Planner' }),
        'utf-8'
      )

      // .git as a FILE simulates a submodule gitdir pointer
      await writeFile(join(submoduleRoot, '.git'), 'gitdir: ../.git/modules/zeno\n', 'utf-8')

      // Consumer's config lives at <consumer>/.zeno/config.json (standalone layout)
      await mkdir(consumerStandalone, { recursive: true })
      await writeFile(
        join(consumerStandalone, 'config.json'),
        JSON.stringify({ projectName: 'MyApp', zenoDir: '.', zenoToolDir: 'zeno', zenoSubmodule: true }),
        'utf-8'
      )

      // From inside the submodule, findProjectRoot should return the consumer root
      const srcDir = join(submoduleRoot, 'src')
      await mkdir(srcDir, { recursive: true })
      const result = findProjectRoot(srcDir)
      expect(result).toBe(consumerRoot.replace(/\\/g, '/'))
    })

    it('skips standard-layout config inside a submodule with no consumer config', async () => {
      // When zeno/ is a submodule but the consumer hasn't run init yet,
      // findProjectRoot should NOT return the consumer root by matching
      // the planner's config that sits inside the submodule.
      const consumerRoot = testDir
      const submoduleRoot = join(consumerRoot, 'zeno')
      const plannerConfig = join(submoduleRoot, 'zeno', '.zeno')

      await mkdir(plannerConfig, { recursive: true })
      await writeFile(
        join(plannerConfig, 'config.json'),
        JSON.stringify({ projectName: 'Zenos-Planner' }),
        'utf-8'
      )

      // .git as a FILE = submodule
      await writeFile(join(submoduleRoot, '.git'), 'gitdir: ../.git/modules/zeno\n', 'utf-8')

      // No consumer config anywhere — findProjectRoot should return null
      const result = findProjectRoot(consumerRoot)
      expect(result).toBeNull()
    })

    it('prefers standalone consumer config when zenoDir is a submodule', async () => {
      // Simulate: consumer uses standalone layout (zenoDir: '.') while planner
      // submodule has its own config in its zeno/.zeno/ directory.
      //   <consumer>/
      //     .zeno/config.json         ← consumer's standalone config
      //     zeno/                     ← submodule
      //       .git                    ← FILE (submodule marker)
      //       zeno/.zeno/config.json  ← planner's own self-planning config

      const consumerRoot = testDir
      const submoduleRoot = join(consumerRoot, 'zeno')
      const plannerConfig = join(submoduleRoot, 'zeno', '.zeno')
      const consumerConfig = join(consumerRoot, '.zeno')

      // Planner's config inside the submodule
      await mkdir(plannerConfig, { recursive: true })
      await writeFile(
        join(plannerConfig, 'config.json'),
        JSON.stringify({ projectName: 'Zenos-Planner' }),
        'utf-8'
      )

      // Submodule marker (.git file)
      await writeFile(join(submoduleRoot, '.git'), 'gitdir: ../.git/modules/zeno\n', 'utf-8')

      // Consumer's standalone config at root
      await mkdir(consumerConfig, { recursive: true })
      await writeFile(
        join(consumerConfig, 'config.json'),
        JSON.stringify({ projectName: 'MyApp', zenoDir: '.', zenoToolDir: 'zeno', zenoSubmodule: true }),
        'utf-8'
      )

      // findProjectRoot from inside the submodule should find the consumer root
      const srcDir = join(submoduleRoot, 'src')
      await mkdir(srcDir, { recursive: true })
      expect(findProjectRoot(srcDir)).toBe(consumerRoot.replace(/\\/g, '/'))

      // findProjectRoot from the consumer root should find its own standalone config
      expect(findProjectRoot(consumerRoot)).toBe(consumerRoot.replace(/\\/g, '/'))

      // loadConfig should load the consumer's standalone config, not the planner's
      const loaded = await loadConfig(consumerRoot.replace(/\\/g, '/'))
      expect(loaded.projectName).toBe('MyApp')
    })
  })

  describe('getDefaultConfig', () => {
    it('creates config with required fields', () => {
      const config = getDefaultConfig('My Project')

      expect(config.projectName).toBe('My Project')
      expect(config.projectStatement).toBeUndefined()
      expect(config.version).toBe('0.1.0')
      expect(config.hashAlgorithm).toBe('sha256')
      expect(config.hashLength).toBe(16)
      expect(config.qualityThresholds.codeCoverage).toBe(90)
    })

    it('creates config with end state', () => {
      const config = getDefaultConfig('My Project', 'End state description')

      expect(config.projectName).toBe('My Project')
      expect(config.projectStatement).toBe('End state description')
    })

    it('populates zenoServerName from project name slug', () => {
      const config = getDefaultConfig('My Cool Project')
      expect(config.zenoServerName).toBe('zeno-my-cool-project')
    })

    it('zenoServerName uses slug for names with special characters', () => {
      const config = getDefaultConfig("Zeno's Planner")
      expect(config.zenoServerName).toBe('zeno-zeno-s-planner')
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

  describe('workflowMode', () => {
    it('accepts solo workflowMode', () => {
      const config = { projectName: 'Test', workflowMode: 'solo' }
      const result = ZenoConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.workflowMode).toBe('solo')
      }
    })

    it('accepts team workflowMode', () => {
      const config = { projectName: 'Test', workflowMode: 'team' }
      const result = ZenoConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.workflowMode).toBe('team')
      }
    })

    it('rejects invalid workflowMode value', () => {
      const config = { projectName: 'Test', workflowMode: 'foo' }
      const result = ZenoConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })

    it('defaults workflowMode to solo when not provided (backward compat)', () => {
      const config = { projectName: 'Test' }
      const result = ZenoConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.workflowMode).toBe('solo')
      }
    })
  })

  describe('zenoServerName field', () => {
    it('accepts zenoServerName as optional string', () => {
      const config = { projectName: 'Test', zenoServerName: 'zeno-my-app' }
      const result = ZenoConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.zenoServerName).toBe('zeno-my-app')
    })

    it('loads existing config without zenoServerName without error', () => {
      const config = { projectName: 'Test', version: '0.1.0' }
      const result = ZenoConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.zenoServerName).toBeUndefined()
      }
    })
  })

})

describe('toSlug', () => {
  it('converts spaces to hyphens', () => {
    expect(toSlug('My Cool Project')).toBe('my-cool-project')
  })

  it('lowercases the result', () => {
    expect(toSlug('Hello World')).toBe('hello-world')
  })

  it('collapses consecutive special chars into one hyphen', () => {
    expect(toSlug('  Zeno---Planner!!  ')).toBe('zeno-planner')
  })

  it('trims leading and trailing hyphens', () => {
    expect(toSlug('---hello---')).toBe('hello')
  })

  it('returns project for empty string', () => {
    expect(toSlug('')).toBe('project')
  })

  it('returns project for all-symbol string', () => {
    expect(toSlug('!!!')).toBe('project')
  })

  it('handles leading/trailing whitespace', () => {
    expect(toSlug('  test  ')).toBe('test')
  })

  it('preserves numbers', () => {
    expect(toSlug('Project 42')).toBe('project-42')
  })
})

