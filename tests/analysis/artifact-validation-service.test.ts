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
    const FULL_SECTIONS = '## Summary\n\n## Proposal Type\n\n## Coverage & Estimates\n\n## Single-Phase Requirement\n\n## Context\n\n## Tasks\n\n## Files Affected\n\n## Rollback\n'
    await writeFile(filePath, FULL_SECTIONS, 'utf8')
    const res = await svc.validate({ artifactPath: filePath, artifactType: 'proposal', validationMode: 'format' })
    await unlink(filePath)
    expect(res.passed).toBe(true)
  })

  it('detects multi-phase language', async () => {
    const svc = new ArtifactValidationService()
    const tmpDir = path.join(process.cwd(), 'tests', 'tmp')
    await mkdir(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'proposal-multi.md')
    const FULL_SECTIONS = '## Summary\nPhase 1: do this\n## Proposal Type\n\n## Coverage & Estimates\n\n## Single-Phase Requirement\n\n## Context\n\n## Tasks\n\n## Files Affected\n\n## Rollback\n'
    await writeFile(filePath, FULL_SECTIONS, 'utf8')
    const res = await svc.validate({ artifactPath: filePath, artifactType: 'proposal', validationMode: 'format' })
    await unlink(filePath)
    expect(res.passed).toBe(false)
    expect((res.errors || []).join('')).toContain('multi-phase')
  })
})
