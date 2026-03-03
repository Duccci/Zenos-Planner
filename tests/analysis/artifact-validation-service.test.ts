import { describe, it, expect } from 'vitest'
import { writeFile, mkdir, unlink } from 'fs/promises'
import * as path from 'path'
import { ArtifactValidationService } from '../../src/analysis/artifact-validation-service.js'

describe('ArtifactValidationService', () => {
  it('returns error when artifactPath not provided', async () => {
    const svc = new ArtifactValidationService()
    const res = await svc.validate({ artifactType: 'proposal' } as any)
    expect(res.passed).toBe(false)
    expect(res.errors).toBeDefined()
    expect((res.errors || []).join('')).toContain('artifactPath')
  })

  it('validates a good proposal file', async () => {
    const svc = new ArtifactValidationService()
    const tmpDir = path.join(process.cwd(), 'tests', 'tmp')
    await mkdir(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'proposal-good.md')
    const FULL_SECTIONS = [
      '## Summary',
      '',
      'This proposal adds a new caching layer to the storage module.',
      'It reduces redundant database reads by memoizing frequently accessed records.',
      'The change is backward compatible and scoped to the storage layer.',
      '',
      '## Context',
      '',
      'The storage module performs repeated reads on hot paths without caching.',
      'This caused measurable latency in integration tests.',
      '',
      '## Tasks',
      '',
      '- [ ] Add LRU cache to StorageService.get()',
      '- [ ] Write unit tests for cache hit and miss paths',
      '',
      '## Files Affected',
      '',
      '| File | Action | Description |',
      '| ---- | ------ | ----------- |',
      '| src/storage/storage-service.ts | modify | Add LRU cache field |',
      '',
      '## Rollback',
      '',
      'Remove the LRU cache field and revert storage-service.ts to prior state.',
    ].join('\n')
    await writeFile(filePath, FULL_SECTIONS, 'utf8')
    const res = await svc.validate({ artifactPath: filePath, artifactType: 'proposal' })
    await unlink(filePath)
    expect(res.passed).toBe(true)
  })

  it('detects multi-phase language', async () => {
    const svc = new ArtifactValidationService()
    const tmpDir = path.join(process.cwd(), 'tests', 'tmp')
    await mkdir(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'proposal-multi.md')
    const FULL_SECTIONS = '## Summary\nPhase 1: do this\n## Context\n\n## Tasks\n\n## Files Affected\n\n## Rollback\n'
    await writeFile(filePath, FULL_SECTIONS, 'utf8')
    const res = await svc.validate({ artifactPath: filePath, artifactType: 'proposal' })
    await unlink(filePath)
    expect(res.passed).toBe(false)
    expect((res.errors || []).join('')).toContain('multi-phase')
  })
})
