import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { findProposalsReferencingRequirement } from '../../src/generation/proposals-discovery.js'
import { join } from 'node:path'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'

function ensureDir(path: string) {
  try {
    require('node:fs').mkdirSync(path, { recursive: true })
  } catch {}
}

describe('findProposalsReferencingRequirement', () => {
  let baseDir: string
  let proposalsRoot: string

  beforeEach(() => {
    baseDir = process.cwd()
    proposalsRoot = join(baseDir, 'zeno', 'proposals', 'test-affected-proposals')
    ensureDir(join(proposalsRoot, 'gate-01'))
    ensureDir(join(proposalsRoot, 'archive'))

    // Active proposal referencing target
    const active = `# Proposal: Active Test\n\n**Hash**: #p-active\n**Requirement**: #target-req\n\n---\n\n## Summary\n\nReference to requirement.`
    writeFileSync(join(proposalsRoot, 'gate-01', 'active.md'), active, 'utf-8')

    // Archived proposal referencing target
    const archived = `# Proposal: Archived Test\n\n**Hash**: #p-arch\n**Requirement**: #target-req\n\n---\n\n## Summary\n\nArchived reference.`
    writeFileSync(join(proposalsRoot, 'archive', 'archived.md'), archived, 'utf-8')

    // Proposal that does NOT reference target
    const other = `# Proposal: Other\n\n**Hash**: #p-other\n**Requirement**: #some-other\n\n---\n\n## Summary\n\nNo matching reference.`
    writeFileSync(join(proposalsRoot, 'gate-01', 'other.md'), other, 'utf-8')
  })

  afterEach(() => {
    try {
      rmSync(join(process.cwd(), 'zeno', 'proposals', 'test-affected-proposals'), { recursive: true, force: true })
    } catch {}
  })

  it('finds proposals in active and archive that reference a requirement', async () => {
    const matches = await findProposalsReferencingRequirement(process.cwd(), 'target-req')
    expect(matches).toEqual(expect.arrayContaining(['p-active', 'p-arch']))
    expect(matches).not.toContain('p-other')
  })
})