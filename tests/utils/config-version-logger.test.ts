/**
 * Additional coverage for util functions with missing branch/line coverage.
 * Targets: config.ts (getComplexityThresholds, readProjectOverview, getProjectOverviewPath, saveConfig error path),
 *          version.ts (edge cases), logger.ts (logSection, logTable, logHash)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, rm, writeFile, mkdtemp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  getComplexityThresholds,
  getProjectOverviewPath,
  readProjectOverview,
  saveConfig,
  getDefaultConfig,
} from '../../src/utils/config.js'
import { parseSemver, formatSemver, bumpSemver } from '../../src/utils/version.js'
import { logSection, logTable, logHash } from '../../src/utils/logger.js'

describe('config - getComplexityThresholds', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'zeno-test-cov-'))
  })

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  it('returns defaults when no config exists', async () => {
    const result = await getComplexityThresholds(testDir)
    expect(result.maxMermaidNodes).toBe(5)
    expect(result.maxMermaidEdges).toBe(8)
    expect(result.nestingDepthMultiplier).toBe(2)
    expect(result.svgCollapseThresholdBytes).toBe(50000)
  })

  it('merges config values with defaults', async () => {
    const zenoDir = join(testDir, 'zeno', '.zeno')
    await mkdir(zenoDir, { recursive: true })

    const config = {
      projectName: 'Test',
      architecture: {
        complexity: {
          maxMermaidNodes: 10,
          maxMermaidEdges: 15,
          nestingDepthMultiplier: 3,
          svgCollapseThresholdBytes: 100000,
        },
      },
    }
    await writeFile(join(zenoDir, 'config.json'), JSON.stringify(config), 'utf-8')

    const result = await getComplexityThresholds(testDir)
    expect(result.maxMermaidNodes).toBe(10)
    expect(result.maxMermaidEdges).toBe(15)
  })

  it('uses defaults when architecture section is absent', async () => {
    const zenoDir = join(testDir, 'zeno', '.zeno')
    await mkdir(zenoDir, { recursive: true })

    const config = { projectName: 'Test' }
    await writeFile(join(zenoDir, 'config.json'), JSON.stringify(config), 'utf-8')

    const result = await getComplexityThresholds(testDir)
    expect(result.maxMermaidNodes).toBe(5)
  })
})

describe('config - getProjectOverviewPath', () => {
  it('returns path ending with project-overview.json', () => {
    const result = getProjectOverviewPath('/some/project')
    expect(result).toContain('project-overview.json')
    expect(result).toContain('.zeno')
  })
})

describe('config - readProjectOverview', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'zeno-test-overview-'))
  })

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  it('throws when overview file does not exist', async () => {
    const zenoDir = join(testDir, 'zeno', '.zeno')
    await mkdir(zenoDir, { recursive: true })

    await expect(readProjectOverview(testDir)).rejects.toThrow('Project overview not found')
  })

  it('throws for invalid overview format', async () => {
    const zenoDir = join(testDir, 'zeno', '.zeno')
    await mkdir(zenoDir, { recursive: true })

    await writeFile(join(zenoDir, 'project-overview.json'), '{"bad": true}', 'utf-8')

    await expect(readProjectOverview(testDir)).rejects.toThrow()
  })

  it('throws for non-JSON content', async () => {
    const zenoDir = join(testDir, 'zeno', '.zeno')
    await mkdir(zenoDir, { recursive: true })

    await writeFile(join(zenoDir, 'project-overview.json'), 'not json', 'utf-8')

    await expect(readProjectOverview(testDir)).rejects.toThrow()
  })

  it('reads valid project overview', async () => {
    const zenoDir = join(testDir, 'zeno', '.zeno')
    await mkdir(zenoDir, { recursive: true })

    const overview = {
      projectName: 'Test',
      projectVersion: '1.0.0',
      currentGate: null,
      totalGatesPlanned: 5,
      endState: 'Done',
      startState: null,
      completedGates: [],
      currentGateInfo: null,
      upcomingGates: [],
      architecture: { layers: [], keyDependencies: {} },
    }
    await writeFile(join(zenoDir, 'project-overview.json'), JSON.stringify(overview), 'utf-8')

    const result = await readProjectOverview(testDir)
    expect(result.projectName).toBe('Test')
    expect(result.totalGatesPlanned).toBe(5)
  })
})

describe('config - saveConfig validation', () => {
  it('rejects config with invalid quality thresholds', async () => {
    const config = {
      projectName: '',
      version: '1.0.0',
    } as any
    await expect(saveConfig(config, '/tmp')).rejects.toThrow('Invalid configuration')
  })
})

describe('version - edge cases', () => {
  it('rejects non-semver strings', () => {
    expect(() => parseSemver('abc')).toThrow('Invalid version')
    expect(() => parseSemver('1.2')).toThrow('Invalid version')
    expect(() => parseSemver('1.2.3.4')).toThrow('Invalid version')
  })

  it('rejects whitespace-only input', () => {
    expect(() => parseSemver('  ')).toThrow('Invalid version')
  })

  it('trims whitespace from valid input', () => {
    const result = parseSemver('  1.2.3  ')
    expect(result).toEqual({ major: 1, minor: 2, patch: 3 })
  })

  it('formats semver correctly', () => {
    expect(formatSemver({ major: 0, minor: 0, patch: 0 })).toBe('0.0.0')
    expect(formatSemver({ major: 10, minor: 20, patch: 30 })).toBe('10.20.30')
  })

  it('bumps major version correctly', () => {
    expect(bumpSemver('1.2.3', 'major')).toBe('2.0.0')
  })

  it('bumps minor version and resets patch', () => {
    expect(bumpSemver('1.2.3', 'minor')).toBe('1.3.0')
  })

  it('bumps patch version', () => {
    expect(bumpSemver('1.2.3', 'patch')).toBe('1.2.4')
  })
})

describe('logger - output functions', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Set log level to debug so all messages are shown
    process.env['ZENO_LOG_LEVEL'] = 'debug'
  })

  afterEach(() => {
    errorSpy.mockRestore()
    warnSpy.mockRestore()
    delete process.env['ZENO_LOG_LEVEL']
  })

  it('logSection outputs header lines', () => {
    logSection('Test Section')
    expect(errorSpy).toHaveBeenCalledTimes(3) // separator, title, separator
  })

  it('logTable outputs header, separator, and rows', () => {
    logTable(
      ['Name', 'Value'],
      [
        ['a', '1'],
        ['b', '2'],
      ]
    )
    expect(errorSpy).toHaveBeenCalledTimes(4) // header, separator, row1, row2
  })

  it('logTable respects indent option', () => {
    logTable(['Col'], [['val']], { indent: 4 })
    const firstCall = errorSpy.mock.calls[0]?.[0] as string
    expect(firstCall).toMatch(/^\s{4}/)
  })

  it('logHash adds # prefix when missing', () => {
    const result = logHash('abc123')
    expect(result).toContain('#abc123')
  })

  it('logHash keeps existing # prefix', () => {
    const result = logHash('#abc123')
    expect(result).toContain('#abc123')
    // Should not double the #
    expect(result).not.toContain('##')
  })
})
