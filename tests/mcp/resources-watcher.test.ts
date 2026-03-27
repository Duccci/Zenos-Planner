import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { registerResources } from '../../src/mcp/resources/index.js'

const tmpDir = join(process.cwd(), '.local', 'test-workspace-resources-watcher')

describe('MCP resources watcher', () => {
  beforeEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {}
    mkdirSync(join(tmpDir, 'zeno', 'proposals', 'solitary'), { recursive: true })
    mkdirSync(join(tmpDir, '.zeno'), { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {}
  })

  it('registers new resources when files are added with watcher enabled', async () => {
    const registered: any[] = []
    const fakeServer = {
      registerResource: (name: string, uri: string, meta: any, reader: any) => {
        registered.push({ name, uri, meta })
        return { remove: () => {} }
      },
    } as any

    const result = (await registerResources(fakeServer as any, tmpDir, { watch: true })) as any
    expect(result.count).toBeGreaterThanOrEqual(1)

    // Add a new proposal file and wait for watcher to pick it up
    writeFileSync(join(tmpDir, 'zeno', 'proposals', 'solitary', 'added.md'), '# Added\n')

    // wait for the 2s debounce + buffer in the watcher implementation
    await new Promise((resolve) => setTimeout(resolve, 2500))

    const names = registered.map((r) => r.name)
    expect(names.some((n) => n.includes('added.md'))).toBe(true)

    // Close watcher
    result.watcher.close()
  })
})
