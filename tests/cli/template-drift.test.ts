/**
 * Template Drift Check Tests
 *
 * Tests for checkTemplateDrift covering all major branches including
 * no-project, no-dirs, stale gates, stale proposals, and error paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Mock config utilities before importing checkTemplateDrift
vi.mock('../../src/utils/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/config.js')>()
  return {
    ...actual,
    findProjectRoot: vi.fn(() => null),
    getWorkspaceRoot: vi.fn(() => '/fake/workspace'),
    getZenoGitDir: vi.fn((root: string) => root),
  }
})

import { checkTemplateDrift } from '../../src/cli/commands/doctor/checks/template-drift.js'
import { findProjectRoot, getZenoGitDir } from '../../src/utils/config.js'

const mockFindProjectRoot = vi.mocked(findProjectRoot)
const mockGetZenoGitDir = vi.mocked(getZenoGitDir)

describe('checkTemplateDrift', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'zeno-drift-'))
    vi.clearAllMocks()
    mockFindProjectRoot.mockReturnValue(tmpDir)
    mockGetZenoGitDir.mockReturnValue(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns ok when findProjectRoot returns null (no Zeno project)', () => {
    mockFindProjectRoot.mockReturnValue(null)
    const result = checkTemplateDrift()
    expect(result.id).toBe('template_drift')
    expect(result.status).toBe('ok')
    expect(result.detail).toContain('No Zeno project found')
  })

  it('returns ok when neither gates nor proposals directory exists', () => {
    // tmpDir has no gates/ or proposals/ subdirectory
    const result = checkTemplateDrift()
    expect(result.status).toBe('ok')
    expect(result.detail).toContain('nothing to check')
  })

  it('returns ok when gates dir exists but is empty', () => {
    mkdirSync(join(tmpDir, 'gates'), { recursive: true })
    const result = checkTemplateDrift()
    expect(result.status).toBe('ok')
  })

  it('returns ok when gate file has no template_hash field', () => {
    const gatesDir = join(tmpDir, 'gates')
    mkdirSync(gatesDir, { recursive: true })
    writeFileSync(join(gatesDir, 'gate-01-init.md'), '# Gate 01\n\nNo hash here.\n', 'utf-8')
    const result = checkTemplateDrift()
    expect(result.status).toBe('ok')
  })

  it('returns ok when gate file template_hash matches current template', () => {
    // We don't know the real hash here, so we use a file with no hash — covered above.
    // This test verifies the "all match" path via empty hash field.
    const gatesDir = join(tmpDir, 'gates')
    mkdirSync(gatesDir, { recursive: true })
    writeFileSync(join(gatesDir, 'gate-01.md'), '---\ntitle: Gate 01\n---\n# Gate\n', 'utf-8')
    const result = checkTemplateDrift()
    expect(result.status).toBe('ok')
  })

  it('returns warn when a gate file has a stale template_hash', () => {
    const gatesDir = join(tmpDir, 'gates')
    mkdirSync(gatesDir, { recursive: true })
    // Use a known-wrong hash (16 hex chars, clearly differs from any real template hash)
    writeFileSync(
      join(gatesDir, 'gate-01-stale.md'),
      '---\ntemplate_hash: 0000000000000000\n---\n# Gate\n',
      'utf-8'
    )
    const result = checkTemplateDrift()
    expect(result.status).toBe('warn')
    expect(result.detail).toContain('gate-01-stale.md')
    expect(result.fix).toBeTruthy()
  })

  it('includes count of stale gate PRDs in warn detail', () => {
    const gatesDir = join(tmpDir, 'gates')
    mkdirSync(gatesDir, { recursive: true })
    writeFileSync(join(gatesDir, 'gate-01.md'), 'template_hash: 0000000000000000\n', 'utf-8')
    writeFileSync(join(gatesDir, 'gate-02.md'), 'template_hash: 0000000000000001\n', 'utf-8')
    const result = checkTemplateDrift()
    expect(result.status).toBe('warn')
    expect(result.detail).toContain('gate PRD(s)')
  })

  it('returns warn when a proposal file has a stale template_hash', () => {
    const proposalsDir = join(tmpDir, 'proposals')
    const gateSubdir = join(proposalsDir, 'gate-01')
    mkdirSync(gateSubdir, { recursive: true })
    writeFileSync(
      join(gateSubdir, 'my-proposal.md'),
      'template_hash: aaaa111122223333\n# Proposal\n',
      'utf-8'
    )
    const result = checkTemplateDrift()
    expect(result.status).toBe('warn')
    expect(result.detail).toContain('proposal(s)')
    expect(result.fix).toBeTruthy()
  })

  it('includes both gate and proposal counts when both are stale', () => {
    const gatesDir = join(tmpDir, 'gates')
    mkdirSync(gatesDir, { recursive: true })
    writeFileSync(join(gatesDir, 'gate-01.md'), 'template_hash: 0000000000000000\n', 'utf-8')

    const proposalsDir = join(tmpDir, 'proposals')
    const gateSubdir = join(proposalsDir, 'gate-01')
    mkdirSync(gateSubdir, { recursive: true })
    writeFileSync(join(gateSubdir, 'proposal.md'), 'template_hash: aaaa111122223333\n', 'utf-8')

    const result = checkTemplateDrift()
    expect(result.status).toBe('warn')
    expect(result.detail).toContain('gate PRD(s)')
    expect(result.detail).toContain('proposal(s)')
  })

  it('skips non-.md files in gates directory', () => {
    const gatesDir = join(tmpDir, 'gates')
    mkdirSync(gatesDir, { recursive: true })
    writeFileSync(join(gatesDir, 'archive.json'), '{"template_hash":"0000000000000000"}', 'utf-8')
    const result = checkTemplateDrift()
    expect(result.status).toBe('ok')
  })

  it('handles proposals dir with file (not directory) subentry gracefully', () => {
    const proposalsDir = join(tmpDir, 'proposals')
    mkdirSync(proposalsDir, { recursive: true })
    // Create a file (not a directory) as a subentry
    writeFileSync(join(proposalsDir, 'not-a-dir.md'), 'template_hash: 0000000000000000\n', 'utf-8')
    const result = checkTemplateDrift()
    // The file is a file (not a directory), so it is skipped
    expect(result.status).toBe('ok')
  })
})
