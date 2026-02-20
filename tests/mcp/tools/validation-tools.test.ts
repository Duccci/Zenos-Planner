/**
 * Validation Tools - Branch Coverage Tests
 *
 * Targets uncovered branches: json output format, text with errors,
 * text with warnings, error catch path, mock result path.
 */
import { describe, it, expect } from 'vitest'
import { validationHandlers } from '../../../src/mcp/tools/validation-tools.js'
import { mkdir, writeFile, unlink } from 'fs/promises'
import * as path from 'path'

const tmpDir = path.join(process.cwd(), 'tests', 'tmp')

function getText(res: { content: { type: string; text?: string }[] }): string {
  return (res.content[0] as { type: string; text: string }).text
}

describe('validation-tools', () => {
  it('returns text result for a valid proposal', async () => {
    const handlers = validationHandlers({} as any)
    await mkdir(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'proposal-small.md')
    await writeFile(filePath, '## Summary\n## Tasks\n## Files Affected\n## Dependencies\n', 'utf8')
    const res = await handlers.artifact_validate({
      artifactPath: filePath,
      artifactType: 'proposal',
      validationMode: 'format',
      outputFormat: 'text',
    })
    try {
      await unlink(filePath)
    } catch {}
    expect(res).toBeDefined()
    expect(res.content).toBeDefined()
    expect(res.content[0]?.text).toBeDefined()
    expect((res.content[0]?.text as string).includes('PASSED')).toBe(true)
  })

  it('returns JSON output format when outputFormat=json', async () => {
    const handlers = validationHandlers({} as any)
    await mkdir(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'proposal-json.md')
    await writeFile(filePath, '## Summary\n## Tasks\n## Files Affected\n## Dependencies\n', 'utf8')

    const res = await handlers.artifact_validate({
      artifactPath: filePath,
      artifactType: 'proposal',
      validationMode: 'format',
      outputFormat: 'json',
    })

    try {
      await unlink(filePath)
    } catch {}

    expect(res.structuredContent).toBeDefined()
    expect((res.structuredContent as any).passed).toBe(true)
    expect(() => JSON.parse(getText(res as any))).not.toThrow()
  })

  it('returns text with errors for invalid proposal', async () => {
    const handlers = validationHandlers({} as any)
    await mkdir(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'proposal-invalid.md')
    await writeFile(filePath, '# Empty proposal\nNo required sections.\n', 'utf8')

    const res = await handlers.artifact_validate({
      artifactPath: filePath,
      artifactType: 'proposal',
      validationMode: 'format',
      outputFormat: 'text',
    })

    try {
      await unlink(filePath)
    } catch {}

    const text = getText(res as any)
    expect(text).toContain('FAILED')
    expect(text).toContain('Errors:')
    expect(text).toContain('Missing required section')
  })

  it('returns text with warnings for gate missing optional sections', async () => {
    const handlers = validationHandlers({} as any)
    await mkdir(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'gate-warn.md')
    // Include Status but omit optional sections to trigger warnings
    await writeFile(filePath, '# Gate\n**Status**: pending\n', 'utf8')

    const res = await handlers.artifact_validate({
      artifactPath: filePath,
      artifactType: 'gate',
      validationMode: 'format',
      outputFormat: 'text',
    })

    try {
      await unlink(filePath)
    } catch {}

    const text = getText(res as any)
    expect(text).toContain('Warnings:')
    expect(text).toContain('missing section')
  })

  it('returns JSON with errors for invalid gate', async () => {
    const handlers = validationHandlers({} as any)
    await mkdir(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'gate-invalid-json.md')
    await writeFile(filePath, '# Gate\nNo status field.\n', 'utf8')

    const res = await handlers.artifact_validate({
      artifactPath: filePath,
      artifactType: 'gate',
      validationMode: 'format',
      outputFormat: 'json',
    })

    try {
      await unlink(filePath)
    } catch {}

    expect((res.structuredContent as any).passed).toBe(false)
    expect((res.structuredContent as any).errors).toBeDefined()
  })

  it('handles error in catch path for invalid input', async () => {
    const handlers = validationHandlers({} as any)

    // Missing required artifactType triggers Zod parse error
    const res = await handlers.artifact_validate({})

    const text = getText(res as any)
    expect(text).toContain('INTERNAL_ERROR')
  })

  it('handles mock result when _mockResult is provided', async () => {
    const handlers = validationHandlers({} as any)

    const mockResult = {
      passed: true,
    }

    const res = await handlers.artifact_validate({
      artifactType: 'proposal',
      mockResult: JSON.stringify(mockResult),
    })

    expect(res.structuredContent).toBeDefined()
    expect(
      (res.structuredContent as any).passed ?? (res.structuredContent as any).output
    ).toBeTruthy()
  })
})
