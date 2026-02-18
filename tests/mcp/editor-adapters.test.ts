import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  getAdapterCommand,
  getVSCodeInstallUrl,
  isZenoInstalled,
  ensureWorkspaceMcp,
} from '../../src/mcp/editor-adapters.js'

describe('editor adapters', () => {
  it('returns a valid activation command for each editor', () => {
    const vscode = getAdapterCommand('vscode')
    expect(vscode).toContain('mcp-server.js')

    const cursor = getAdapterCommand('cursor')
    expect(cursor).toContain('--adapter cursor')

    const windsurf = getAdapterCommand('windsurf')
    expect(windsurf).toContain('--adapter windsurf')
  })

  it('getAdapterCommand uses given projectRoot for path', () => {
    const projectRoot = join('custom', 'path')
    const cmd = getAdapterCommand('vscode', projectRoot)
    expect(cmd).toContain('custom')
    expect(cmd).toContain('mcp-server.js')
  })

  it('getVSCodeInstallUrl returns a vscode: URL with encoded config', () => {
    const url = getVSCodeInstallUrl()
    expect(url).toMatch(/^vscode:mcp\/install\?/)
    expect(url).toContain('zeno-planner')
    expect(url).toContain('stdio')
  })

  describe('isZenoInstalled', () => {
    let tmpDir: string

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'zeno-install-test-'))
    })

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true })
    })

    it('returns invalid when bin/zeno.js is missing', () => {
      const result = isZenoInstalled(tmpDir)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('zeno.js')
    })

    it('returns invalid when bin/mcp-server.js is missing', () => {
      const binDir = join(tmpDir, 'bin')
      mkdirSync(binDir, { recursive: true })
      writeFileSync(join(binDir, 'zeno.js'), '// zeno')
      const result = isZenoInstalled(tmpDir)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('mcp-server.js')
    })

    it('returns invalid when src directory is missing', () => {
      const binDir = join(tmpDir, 'bin')
      mkdirSync(binDir, { recursive: true })
      writeFileSync(join(binDir, 'zeno.js'), '// zeno')
      writeFileSync(join(binDir, 'mcp-server.js'), '// mcp')
      const result = isZenoInstalled(tmpDir)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('src')
    })

    it('returns valid when all required paths exist', () => {
      const binDir = join(tmpDir, 'bin')
      mkdirSync(binDir, { recursive: true })
      writeFileSync(join(binDir, 'zeno.js'), '// zeno')
      writeFileSync(join(binDir, 'mcp-server.js'), '// mcp')
      mkdirSync(join(tmpDir, 'src'), { recursive: true })
      const result = isZenoInstalled(tmpDir)
      expect(result.valid).toBe(true)
      expect(result.reason).toBeUndefined()
    })
  })

  describe('ensureWorkspaceMcp', () => {
    let tmpDir: string

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'zeno-mcp-test-'))
    })

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true })
    })

    it('creates .vscode/mcp.json when neither .vscode dir nor mcp.json exist', () => {
      const result = ensureWorkspaceMcp(tmpDir)
      expect(result).toBe(true)
      expect(existsSync(join(tmpDir, '.vscode', 'mcp.json'))).toBe(true)
    })

    it('returns false when mcp.json already exists', () => {
      const vscodeDirPath = join(tmpDir, '.vscode')
      mkdirSync(vscodeDirPath, { recursive: true })
      writeFileSync(join(vscodeDirPath, 'mcp.json'), '{}')
      const result = ensureWorkspaceMcp(tmpDir)
      expect(result).toBe(false)
    })

    it('creates mcp.json when .vscode dir exists but mcp.json does not', () => {
      const vscodeDirPath = join(tmpDir, '.vscode')
      mkdirSync(vscodeDirPath, { recursive: true })
      const result = ensureWorkspaceMcp(tmpDir)
      expect(result).toBe(true)
      expect(existsSync(join(vscodeDirPath, 'mcp.json'))).toBe(true)
    })

    it('returns false when writeFileSync throws (non-writable path)', () => {
      // Pass a path where the parent exists but target is a directory, causing write error
      const vscodeDirPath = join(tmpDir, '.vscode')
      mkdirSync(vscodeDirPath, { recursive: true })
      // Make mcp.json a directory to force write error
      mkdirSync(join(vscodeDirPath, 'mcp.json'), { recursive: true })
      const result = ensureWorkspaceMcp(tmpDir)
      // writeFileSync throws when target is a directory → catch block returns false
      expect(result).toBe(false)
    })
  })
})
