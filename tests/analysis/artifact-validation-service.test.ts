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
    await writeFile(filePath, '## Summary\n\n## Tasks\n\n## Files Affected\n\n## Dependencies\n', 'utf8')
    const res = await svc.validate({ artifactPath: filePath, artifactType: 'proposal', validationMode: 'format' })
    await unlink(filePath)
    expect(res.passed).toBe(true)
  })

  it('detects multi-phase language', async () => {
    const svc = new ArtifactValidationService()
    const tmpDir = path.join(process.cwd(), 'tests', 'tmp')
    await mkdir(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'proposal-multi.md')
    await writeFile(filePath, '## Summary\nPhase 1: do this\n## Tasks\n## Files Affected\n## Dependencies\n', 'utf8')
    const res = await svc.validate({ artifactPath: filePath, artifactType: 'proposal', validationMode: 'format' })
    await unlink(filePath)
    expect(res.passed).toBe(false)
    expect((res.errors || []).join('')).toContain('multi-phase')
  })
})
