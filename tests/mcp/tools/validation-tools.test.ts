import { describe, it, expect } from 'vitest'
import { validationHandlers } from '../../../src/mcp/tools/validation-tools.js'
import { mkdir, writeFile, unlink } from 'fs/promises'
import * as path from 'path'

describe('validation-tools handler', () => {
  it('artifact_validate returns text result for a valid proposal', async () => {
    const handlers = validationHandlers({} as any)
    const tmpDir = path.join(process.cwd(), 'tests', 'tmp')
    await mkdir(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'proposal-small.md')
    await writeFile(filePath, '## Summary\n## Tasks\n## Files Affected\n## Dependencies\n', 'utf8')
    const res = await handlers.artifact_validate({ artifactPath: filePath, artifactType: 'proposal', validationMode: 'format', outputFormat: 'text' })
    try { await unlink(filePath) } catch {}
    expect(res).toBeDefined()
    expect(res.content).toBeDefined()
    expect(res.content[0]?.text).toBeDefined()
    expect((res.content[0]?.text as string).includes('PASSED')).toBe(true)
  })
})
