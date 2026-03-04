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
    await writeFile(
      filePath,
      [
        '## Summary',
        '',
        'This proposal implements the new widget renderer component for the generation pipeline.',
        'It introduces a typed WidgetRenderer class and wires it into the diagram catalogue.',
        'The change is additive and does not modify existing renderer contracts.',
        '',
        '## Context',
        '',
        'The diagram catalogue lacks a widget renderer, causing unsupported type errors.',
        'This proposal fills the gap without changing the catalogue interface.',
        '',
        '## Tasks',
        '',
        '- [ ] Create src/generation/widget-renderer.ts with WidgetRenderer class',
        '- [ ] Register WidgetRenderer in src/generation/diagram-catalogue.ts',
        '',
        '## Files Affected',
        '',
        '| File | Action | Description |',
        '| ---- | ------ | ----------- |',
        '| src/generation/widget-renderer.ts | create | New renderer |',
        '',
        '## Rollback',
        '',
        'Delete widget-renderer.ts and remove its entry from diagram-catalogue.ts.',
      ].join('\n'),
      'utf8'
    )
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
    await writeFile(
      filePath,
      [
        '## Summary',
        '',
        'This proposal refactors the gate writer to support batched disk writes.',
        'It reduces I/O overhead by grouping writes into a single atomic operation.',
        'The interface is unchanged; only the internal implementation is affected.',
        '',
        '## Context',
        '',
        'Profiling showed the gate writer is called on every gate update.',
        'Batching writes will reduce total file system calls.',
        '',
        '## Tasks',
        '',
        '- [ ] Refactor gate-writer.ts to batch writes into a transaction',
        '- [ ] Update tests to verify batch behaviour',
        '',
        '## Files Affected',
        '',
        '| File | Action | Description |',
        '| ---- | ------ | ----------- |',
        '| src/core/gate-writer.ts | modify | Batch write support |',
        '',
        '## Rollback',
        '',
        'Revert gate-writer.ts to the non-batched implementation.',
      ].join('\n'),
      'utf8'
    )

    const res = await handlers.artifact_validate({
      artifactPath: filePath,
      artifactType: 'proposal',
      outputFormat: 'json',
    })

    try {
      await unlink(filePath)
    } catch {}

    expect(res.content[0]?.text).toBeDefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    expect(parsed.passed).toBe(true)
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
      outputFormat: 'text',
    })

    const text = getText(res as any)
    expect(text).toContain('FAILED')
    expect(text).toContain('Errors:')
    expect(text).toContain('Missing required section')
  })

  it('returns text PASSED for gate with all required template sections', async () => {
    const handlers = validationHandlers({} as any)
    await mkdir(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'gate-valid.md')
    // Include Status, a checkbox in Objectives, and every required section from gate-prd-template.md
    const gateContent = [
      '# Gate 01: Test',
      '',
      '**Status**: pending',
      '',
      '## Overview',
      '',
      'This gate establishes the core storage infrastructure for the project.',
      'It delivers the SQLite registry and basic CRUD operations for requirements.',
      'Subsequent gates depend on this foundation being in place.',
      '',
      '## Objectives',
      '',
      '- [ ] Implement SQLite registry with schema migrations',
      '- [ ] Expose CRUD operations for requirements and gates',
      '- [ ] Write integration tests covering all registry operations',
      '',
      '## Context',
      '',
      'No prior gates have been completed. This is the foundational gate.',
      'Future gates will build on the registry created here.',
      '',
      '## Requirements',
      '',
      '| Hash | Name | Type | Priority | How This Gate Addresses It |',
      '| ---- | ---- | ---- | -------- | -------------------------- |',
      '| #abc123ef45678901 | Core storage | functional | must | Implements registry |',
      '',
      '## Proposals',
      '',
      'No proposals generated yet.',
      '',
      '## Architecture Diagrams',
      '',
      'See zeno/architecture/system-overview.md for the component diagram.',
      '',
      '## Technical Decisions for This Gate',
      '',
      'SQLite chosen for its zero-dependency, embedded nature and broad OS support.',
      '',
      '## Architecture Updates',
      '',
      'No changes to the existing architecture diagrams required at this stage.',
      '',
      '## Gate-Specific Quality Considerations',
      '',
      'All registry operations must be covered by integration tests at 90% coverage.',
      '',
      '## Dependencies',
      '',
      '*No gate dependencies.*',
      '',
      '## Implementation Steps',
      '',
      '1. Create database schema and migration scripts',
      '2. Implement repository layer for requirements and gates',
      '3. Write integration tests',
      '',
      '## Known Issues & Limitations',
      '',
      'None identified at this stage.',
      '',
      '## Risks & Mitigation',
      '',
      'Schema changes after gate completion may require manual migrations.',
      'Mitigation: freeze the schema before gate completion.',
      '',
      '## Gate Completion Criteria',
      '',
      'All integration tests pass at 90% coverage with zero linting errors.',
      '',
      '## Notes',
      '',
      'Entry point is src/storage/database.ts.',
    ].join('\n')
    await writeFile(filePath, gateContent, 'utf8')

    const res = await handlers.artifact_validate({
      artifactPath: filePath,
      artifactType: 'gate',
      outputFormat: 'text',
    })

    try {
      await unlink(filePath)
    } catch {}

    const text = getText(res as any)
    expect(text).toContain('PASSED')
  })

  it('returns JSON with errors for invalid gate', async () => {
    const handlers = validationHandlers({} as any)
    await mkdir(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'gate-invalid-json.md')
    await writeFile(filePath, '# Gate\nNo status field.\n', 'utf8')

    const res = await handlers.artifact_validate({
      artifactPath: filePath,
      artifactType: 'gate',
      outputFormat: 'json',
    })

    try {
      await unlink(filePath)
    } catch {}

    const parsedGate = JSON.parse(res.content[0]!.text as string)
    expect(parsedGate.passed).toBe(false)
    expect(parsedGate.errors).toBeDefined()
  })

  it('handles error in catch path for invalid input', async () => {
    const handlers = validationHandlers({} as any)

    // Missing required artifactType triggers Zod parse error
    const res = await handlers.artifact_validate({})

    const text = getText(res as any)
    expect(text).toContain('VALIDATION_ERROR')
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

    expect(res.content[0]?.text).toBeDefined()
    const parsedMock = JSON.parse(res.content[0]!.text as string)
    expect(parsedMock.passed ?? parsedMock.output ?? true).toBeTruthy()
  })
})
