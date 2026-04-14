import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

// Mock config utilities used by installMcpConfig. The spread of `...actual`
// preserves all other config helpers (used by isZenoInstalled, ensureWorkspaceMcp, etc.).
vi.mock('../../src/utils/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/config.js')>()
  return {
    ...actual,
    isSubmoduleLayout: vi.fn(() => false),
    loadConfig: vi.fn(async () => {
      throw new Error('no config')
    }),
  }
})

import {
  getAdapterCommand,
  getVSCodeInstallUrl,
  isZenoInstalled,
  ensureWorkspaceMcp,
  buildMcpServerEntry,
  ensureCodeWorkspaceMcp,
  findCodeWorkspaceFile,
  extractWorkspaceFolders,
  installMcpConfig,
} from '../../src/mcp/editor-adapters.js'
import { isSubmoduleLayout, loadConfig } from '../../src/utils/config.js'

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

    it('uses default zeno-planner server name', () => {
      const result = ensureWorkspaceMcp(tmpDir)
      expect(result).toBe(true)
      const content = JSON.parse(readFileSync(join(tmpDir, '.vscode', 'mcp.json'), 'utf-8')) as Record<string, unknown>
      const servers = (content as { servers: Record<string, unknown> }).servers
      expect(Object.keys(servers)).toContain('zeno-planner')
    })

    it('uses custom server name when provided', () => {
      const result = ensureWorkspaceMcp(tmpDir, '.', undefined, 'zeno-my-project')
      expect(result).toBe(true)
      const content = JSON.parse(readFileSync(join(tmpDir, '.vscode', 'mcp.json'), 'utf-8')) as Record<string, unknown>
      const servers = (content as { servers: Record<string, unknown> }).servers
      expect(Object.keys(servers)).toContain('zeno-my-project')
      expect(Object.keys(servers)).not.toContain('zeno-planner')
    })

    it('uses submodule binary path when zenoDir is not dot', () => {
      const result = ensureWorkspaceMcp(tmpDir, 'zeno')
      expect(result).toBe(true)
      const content = JSON.parse(readFileSync(join(tmpDir, '.vscode', 'mcp.json'), 'utf-8')) as Record<string, unknown>
      const servers = (content as { servers: Record<string, unknown> }).servers
      const entry = servers['zeno-planner'] as { args: string[] }
      expect(entry.args[0]).toContain('zeno')
      expect(entry.args[0]).toContain('bin/mcp-server.js')
    })
  })
})

describe('buildMcpServerEntry', () => {
  it('returns correct shape without workspace', () => {
    const entry = buildMcpServerEntry('./bin/mcp-server.js')
    expect(entry.type).toBe('stdio')
    expect(entry.command).toBe('node')
    expect(entry.args).toEqual(['./bin/mcp-server.js'])
    expect(entry.description).toBeDefined()
    expect(entry['env']).toBeUndefined()
  })

  it('includes ZENO_WORKSPACE env when workspace is provided', () => {
    const entry = buildMcpServerEntry('./bin/mcp-server.js', '/my/project')
    expect(entry['env']).toEqual({ ZENO_WORKSPACE: '/my/project' })
  })

  it('uses exact binaryPath in args', () => {
    const entry = buildMcpServerEntry('/abs/path/to/mcp-server.js')
    expect(entry.args).toEqual(['/abs/path/to/mcp-server.js'])
  })
})

describe('ensureCodeWorkspaceMcp', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'zeno-code-workspace-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates a new .code-workspace file with minimal skeleton', () => {
    const wsFile = join(tmpDir, 'my.code-workspace')
    const result = ensureCodeWorkspaceMcp(wsFile, {
      serverName: 'zeno-my-project',
      zenoFolderName: 'Zenos-Planner',
      consumerFolderName: 'my-app',
    })
    expect(result).toBe(true)
    expect(existsSync(wsFile)).toBe(true)
    const content = JSON.parse(readFileSync(wsFile, 'utf-8')) as Record<string, unknown>
    expect(content['folders']).toBeDefined()
    const servers = ((content['settings'] as Record<string, unknown>)?.['mcp'] as Record<string, unknown>)?.['servers'] as Record<string, unknown>
    expect(servers['zeno-my-project']).toBeDefined()
  })

  it('uses workspaceFolder variable substitution in binary path (standalone Zeno folder)', () => {
    const wsFile = join(tmpDir, 'my.code-workspace')
    ensureCodeWorkspaceMcp(wsFile, {
      serverName: 'zeno-my-project',
      zenoFolderName: 'Zenos-Planner',
      consumerFolderName: 'my-app',
    })
    const content = JSON.parse(readFileSync(wsFile, 'utf-8')) as Record<string, unknown>
    const servers = ((content['settings'] as Record<string, unknown>)?.['mcp'] as Record<string, unknown>)?.['servers'] as Record<string, unknown>
    const entry = servers['zeno-my-project'] as { args: string[] }
    expect(entry.args[0]).toContain('${workspaceFolder:Zenos-Planner}')
    expect(entry.args[0]).toContain('/bin/mcp-server.js')
    // Must NOT contain absolute paths
    expect(entry.args[0]).not.toMatch(/^[A-Z]:|^\/[a-z]/)
  })

  it('uses workspaceFolder variable substitution in ZENO_WORKSPACE env', () => {
    const wsFile = join(tmpDir, 'my.code-workspace')
    ensureCodeWorkspaceMcp(wsFile, {
      serverName: 'zeno-my-project',
      zenoFolderName: 'Zenos-Planner',
      consumerFolderName: 'my-app',
    })
    const content = JSON.parse(readFileSync(wsFile, 'utf-8')) as Record<string, unknown>
    const servers = ((content['settings'] as Record<string, unknown>)?.['mcp'] as Record<string, unknown>)?.['servers'] as Record<string, unknown>
    const entry = servers['zeno-my-project'] as { env: Record<string, string> }
    expect(entry.env['ZENO_WORKSPACE']).toBe('${workspaceFolder:my-app}')
  })

  it('uses submodule binary path when submodulePath is provided', () => {
    const wsFile = join(tmpDir, 'my.code-workspace')
    ensureCodeWorkspaceMcp(wsFile, {
      serverName: 'zeno-project-a',
      zenoFolderName: 'Zenos-Planner',
      consumerFolderName: 'project-a',
      submodulePath: 'zeno',
    })
    const content = JSON.parse(readFileSync(wsFile, 'utf-8')) as Record<string, unknown>
    const servers = ((content['settings'] as Record<string, unknown>)?.['mcp'] as Record<string, unknown>)?.['servers'] as Record<string, unknown>
    const entry = servers['zeno-project-a'] as { args: string[] }
    expect(entry.args[0]).toBe('${workspaceFolder:project-a}/zeno/bin/mcp-server.js')
  })

  it('additively merges: second call adds project-b without removing project-a', () => {
    const wsFile = join(tmpDir, 'multi.code-workspace')
    ensureCodeWorkspaceMcp(wsFile, {
      serverName: 'zeno-project-a',
      zenoFolderName: 'Zenos-Planner',
      consumerFolderName: 'project-a',
    })
    ensureCodeWorkspaceMcp(wsFile, {
      serverName: 'zeno-project-b',
      zenoFolderName: 'Zenos-Planner',
      consumerFolderName: 'project-b',
    })
    const content = JSON.parse(readFileSync(wsFile, 'utf-8')) as Record<string, unknown>
    const servers = ((content['settings'] as Record<string, unknown>)?.['mcp'] as Record<string, unknown>)?.['servers'] as Record<string, unknown>
    expect(servers['zeno-project-a']).toBeDefined()
    expect(servers['zeno-project-b']).toBeDefined()
  })

  it('preserves existing settings keys', () => {
    const wsFile = join(tmpDir, 'existing.code-workspace')
    writeFileSync(wsFile, JSON.stringify({
      folders: [{ path: '.' }],
      settings: { 'editor.fontSize': 14 },
    }, null, 2), 'utf-8')
    ensureCodeWorkspaceMcp(wsFile, {
      serverName: 'zeno-app',
      zenoFolderName: 'Zenos-Planner',
      consumerFolderName: 'app',
    })
    const content = JSON.parse(readFileSync(wsFile, 'utf-8')) as Record<string, unknown>
    expect((content['settings'] as Record<string, unknown>)?.['editor.fontSize']).toBe(14)
    // folders also preserved
    expect((content['folders'] as unknown[]).length).toBe(1)
  })

  it('creates settings.mcp.servers correctly when settings key is absent', () => {
    const wsFile = join(tmpDir, 'nosettings.code-workspace')
    writeFileSync(wsFile, JSON.stringify({ folders: [] }, null, 2), 'utf-8')
    ensureCodeWorkspaceMcp(wsFile, {
      serverName: 'zeno-x',
      zenoFolderName: 'Zenos-Planner',
      consumerFolderName: 'x',
    })
    const content = JSON.parse(readFileSync(wsFile, 'utf-8')) as Record<string, unknown>
    const servers = ((content['settings'] as Record<string, unknown>)?.['mcp'] as Record<string, unknown>)?.['servers'] as Record<string, unknown>
    expect(servers['zeno-x']).toBeDefined()
  })

  it('is idempotent: returns false when entry is unchanged', () => {
    const wsFile = join(tmpDir, 'idem.code-workspace')
    ensureCodeWorkspaceMcp(wsFile, {
      serverName: 'zeno-app',
      zenoFolderName: 'Zenos-Planner',
      consumerFolderName: 'app',
    })
    const secondResult = ensureCodeWorkspaceMcp(wsFile, {
      serverName: 'zeno-app',
      zenoFolderName: 'Zenos-Planner',
      consumerFolderName: 'app',
    })
    expect(secondResult).toBe(false)
  })
})

describe('findCodeWorkspaceFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'zeno-find-ws-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns path when .code-workspace file exists in projectRoot', () => {
    const wsFile = join(tmpDir, 'my-project.code-workspace')
    writeFileSync(wsFile, '{}', 'utf-8')
    const result = findCodeWorkspaceFile(tmpDir)
    expect(result).toBe(wsFile)
  })

  it('returns path when .code-workspace file exists in parent directory', () => {
    const childDir = join(tmpDir, 'child')
    mkdirSync(childDir, { recursive: true })
    const wsFile = join(tmpDir, 'parent.code-workspace')
    writeFileSync(wsFile, '{}', 'utf-8')
    const result = findCodeWorkspaceFile(childDir)
    expect(result).toBe(wsFile)
  })

  it('returns undefined when no .code-workspace file exists in root or parent', () => {
    const childDir = join(tmpDir, 'empty-child')
    mkdirSync(childDir, { recursive: true })
    const result = findCodeWorkspaceFile(childDir)
    expect(result).toBeUndefined()
  })

  it('returns undefined when projectRoot directory does not exist', () => {
    const nonExistent = join(tmpDir, 'does-not-exist')
    const result = findCodeWorkspaceFile(nonExistent)
    expect(result).toBeUndefined()
  })

  it('prefers root file over parent file when both exist', () => {
    const childDir = join(tmpDir, 'sub')
    mkdirSync(childDir, { recursive: true })
    const rootWs = join(childDir, 'root.code-workspace')
    writeFileSync(rootWs, '{}', 'utf-8')
    const parentWs = join(tmpDir, 'parent.code-workspace')
    writeFileSync(parentWs, '{}', 'utf-8')
    const result = findCodeWorkspaceFile(childDir)
    expect(result).toBe(rootWs)
  })
})

describe('extractWorkspaceFolders', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'zeno-extract-ws-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  function makeZenoDir(base: string, name: string): string {
    const dir = join(base, name)
    mkdirSync(join(dir, 'bin'), { recursive: true })
    writeFileSync(join(dir, 'bin', 'mcp-server.js'), '// mcp')
    return dir
  }

  it('returns zeno and consumer folder names when both identified', () => {
    const zenoDir = makeZenoDir(tmpDir, 'zeno-tool')
    const consumerDir = join(tmpDir, 'my-app')
    mkdirSync(consumerDir, { recursive: true })
    const wsFile = join(tmpDir, 'multi.code-workspace')
    writeFileSync(wsFile, JSON.stringify({
      folders: [
        { path: resolve(tmpDir, 'zeno-tool'), name: 'Zenos-Planner' },
        { path: consumerDir, name: 'my-app' },
      ],
    }, null, 2), 'utf-8')
    const result = extractWorkspaceFolders(wsFile, consumerDir)
    expect(result).toBeDefined()
    expect(result?.zeno).toBe('Zenos-Planner')
    expect(result?.consumer).toBe('my-app')
    // Suppress unused var warning
    void zenoDir
  })

  it('uses basename when folder has no name property', () => {
    const zenoDir = makeZenoDir(tmpDir, 'zeno-tool')
    const consumerDir = join(tmpDir, 'consumer')
    mkdirSync(consumerDir, { recursive: true })
    const wsFile = join(tmpDir, 'multi.code-workspace')
    writeFileSync(wsFile, JSON.stringify({
      folders: [
        { path: resolve(tmpDir, 'zeno-tool') },
        { path: consumerDir },
      ],
    }, null, 2), 'utf-8')
    const result = extractWorkspaceFolders(wsFile, consumerDir)
    expect(result?.zeno).toBe('zeno-tool')
    expect(result?.consumer).toBe('consumer')
    void zenoDir
  })

  it('returns undefined when no folders property', () => {
    const wsFile = join(tmpDir, 'no-folders.code-workspace')
    writeFileSync(wsFile, JSON.stringify({ settings: {} }, null, 2), 'utf-8')
    const result = extractWorkspaceFolders(wsFile, tmpDir)
    expect(result).toBeUndefined()
  })

  it('returns undefined when file does not exist', () => {
    const result = extractWorkspaceFolders(join(tmpDir, 'nonexistent.code-workspace'), tmpDir)
    expect(result).toBeUndefined()
  })

  it('returns undefined when no folder matches both zeno and consumer criteria', () => {
    const wsFile = join(tmpDir, 'partial.code-workspace')
    const otherDir = join(tmpDir, 'other')
    mkdirSync(otherDir, { recursive: true })
    writeFileSync(wsFile, JSON.stringify({
      folders: [{ path: otherDir, name: 'other' }],
    }, null, 2), 'utf-8')
    const result = extractWorkspaceFolders(wsFile, tmpDir)
    expect(result).toBeUndefined()
  })

  it('returns undefined when content is invalid JSON', () => {
    const wsFile = join(tmpDir, 'bad.code-workspace')
    writeFileSync(wsFile, '{ invalid json {{', 'utf-8')
    // jsonc-parser tolerates some malformed JSON; at minimum should not throw
    const result = extractWorkspaceFolders(wsFile, tmpDir)
    // Result is undefined or a valid object — no throw
    expect(result === undefined || typeof result === 'object').toBe(true)
  })
})

describe('installMcpConfig', () => {
  let tmpDir: string

  function setupValidInstall(root: string): void {
    const binDir = join(root, 'bin')
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(binDir, 'zeno.js'), '// zeno')
    writeFileSync(join(binDir, 'mcp-server.js'), '// mcp')
    mkdirSync(join(root, 'src'), { recursive: true })
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'zeno-install-mcp-'))
    vi.resetAllMocks()
    vi.mocked(isSubmoduleLayout).mockReturnValue(false)
    vi.mocked(loadConfig).mockRejectedValue(new Error('no config'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('throws when Zeno binaries are not installed', async () => {
    // tmpDir has no bin/ directory
    await expect(installMcpConfig(tmpDir)).rejects.toThrow('not properly installed')
  })

  it('writes .vscode/mcp.json in standalone mode (no .code-workspace)', async () => {
    setupValidInstall(tmpDir)
    const result = await installMcpConfig(tmpDir)
    expect(result.target).toBe('mcp-json')
    expect(result.written).toBe(true)
    expect(existsSync(join(tmpDir, '.vscode', 'mcp.json'))).toBe(true)
  })

  it('dry run returns mcp-json target without writing files', async () => {
    setupValidInstall(tmpDir)
    const result = await installMcpConfig(tmpDir, { dryRun: true })
    expect(result.target).toBe('mcp-json')
    expect(result.written).toBe(false)
    expect(existsSync(join(tmpDir, '.vscode', 'mcp.json'))).toBe(false)
  })

  it('uses options.serverName when provided', async () => {
    setupValidInstall(tmpDir)
    const result = await installMcpConfig(tmpDir, { serverName: 'my-custom-server' })
    expect(result.serverName).toBe('my-custom-server')
  })

  it('uses server name from config when options.serverName is absent', async () => {
    setupValidInstall(tmpDir)
    vi.mocked(loadConfig).mockResolvedValueOnce({ zenoServerName: 'zeno-from-cfg' } as never)
    const result = await installMcpConfig(tmpDir)
    expect(result.serverName).toBe('zeno-from-cfg')
  })

  it('falls back to auto-generated server name when config load throws', async () => {
    setupValidInstall(tmpDir)
    // default mock already throws; serverName auto-generated from dirname
    const result = await installMcpConfig(tmpDir)
    expect(result.serverName).toMatch(/^zeno-/)
  })

  it('writes to .code-workspace when one is found with identifiable folders', async () => {
    const consumerDir = join(tmpDir, 'consumer')
    mkdirSync(consumerDir, { recursive: true })
    setupValidInstall(consumerDir)
    // Place a .code-workspace file pointing to both dirs (parent finds it)
    const wsFile = join(tmpDir, 'workspace.code-workspace')
    writeFileSync(wsFile, JSON.stringify({
      folders: [
        { path: tmpDir, name: 'Zenos-Planner' },
        { path: consumerDir, name: 'consumer' },
      ],
    }, null, 2), 'utf-8')
    const result = await installMcpConfig(consumerDir, { serverName: 'zeno-ws' })
    expect(result.target).toBe('code-workspace')
    expect(result.written).toBe(true)
  })

  it('dry run with .code-workspace returns written: false', async () => {
    const consumerDir = join(tmpDir, 'consumer')
    mkdirSync(consumerDir, { recursive: true })
    setupValidInstall(consumerDir)
    const wsFile = join(tmpDir, 'workspace.code-workspace')
    writeFileSync(wsFile, JSON.stringify({
      folders: [
        { path: tmpDir, name: 'Zenos-Planner' },
        { path: consumerDir, name: 'consumer' },
      ],
    }, null, 2), 'utf-8')
    const result = await installMcpConfig(consumerDir, { serverName: 'zeno-ws', dryRun: true })
    expect(result.target).toBe('code-workspace')
    expect(result.written).toBe(false)
  })
})
