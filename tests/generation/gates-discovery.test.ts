import { describe, it, expect } from 'vitest'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverGates } from '../../src/generation/gates-discovery.js'

const TEST_DIR = join(tmpdir(), `.test-gates-discovery-${Date.now()}`)

describe('gates-discovery', () => {
  async function setup() {
    await mkdir(join(TEST_DIR, 'zeno', 'gates'), { recursive: true })
  }

  async function cleanup() {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true })
    }
  }

  it('returns empty array when gates directory does not exist (covers readdir catch)', async () => {
    // projectRoot with no zeno/gates directory → readdir throws → returns []
    const result = await discoverGates('/path/that/does/not/exist/xyz')
    expect(result).toEqual([])
  })

  it('discovers gates from markdown files in gates directory', async () => {
    await setup()

    const gateContent = `# Gate 01: Core Setup\n\nFirst heading below.\n\nDescription paragraph.`
    await writeFile(join(TEST_DIR, 'zeno', 'gates', 'gate-01-core-setup.md'), gateContent, 'utf-8')

    const result = await discoverGates(TEST_DIR)

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('gate-01')
    expect(result[0]!.sequence).toBe(1)
    await cleanup()
  })

  it('skips files that do not match gate filename pattern', async () => {
    await setup()

    await writeFile(join(TEST_DIR, 'zeno', 'gates', 'README.md'), '# README', 'utf-8')
    await writeFile(join(TEST_DIR, 'zeno', 'gates', 'gate-01-setup.md'), '# Gate\n\nDesc', 'utf-8')

    const result = await discoverGates(TEST_DIR)

    expect(result).toHaveLength(1)
    await cleanup()
  })

  it('ignores entries starting with "archive"', async () => {
    await setup()

    await mkdir(join(TEST_DIR, 'zeno', 'gates', 'archive'), { recursive: true })
    await writeFile(
      join(TEST_DIR, 'zeno', 'gates', 'archive', 'gate-01-old.md'),
      '# Old Gate',
      'utf-8'
    )
    await writeFile(
      join(TEST_DIR, 'zeno', 'gates', 'gate-02-active.md'),
      '# Active Gate\n\nDesc',
      'utf-8'
    )

    const result = await discoverGates(TEST_DIR)

    // Only active gate returned (archive skipped)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('gate-02')
    await cleanup()
  })

  it('swallows per-file read errors and continues (covers inner catch)', async () => {
    await setup()

    // Create a directory named "gate-01-bad.md" — fs.readFile on a directory throws
    const badPath = join(TEST_DIR, 'zeno', 'gates', 'gate-01-bad.md')
    mkdirSync(badPath, { recursive: true })

    // Also create a valid gate file
    await writeFile(
      join(TEST_DIR, 'zeno', 'gates', 'gate-02-good.md'),
      '# Gate 02\n\nGood gate.',
      'utf-8'
    )

    // Should not throw; bad entry is skipped, good gate is returned
    const result = await discoverGates(TEST_DIR)
    expect(Array.isArray(result)).toBe(true)
    // gate-02-good should be found
    const good = result.find((g) => g.id === 'gate-02')
    expect(good).toBeDefined()
    await cleanup()
  })

  it('sorts gates by sequence number', async () => {
    await setup()

    await writeFile(join(TEST_DIR, 'zeno', 'gates', 'gate-03-third.md'), '# Third\n\nDesc', 'utf-8')
    await writeFile(join(TEST_DIR, 'zeno', 'gates', 'gate-01-first.md'), '# First\n\nDesc', 'utf-8')
    await writeFile(
      join(TEST_DIR, 'zeno', 'gates', 'gate-02-second.md'),
      '# Second\n\nDesc',
      'utf-8'
    )

    const result = await discoverGates(TEST_DIR)

    expect(result).toHaveLength(3)
    expect(result[0]!.sequence).toBe(1)
    expect(result[1]!.sequence).toBe(2)
    expect(result[2]!.sequence).toBe(3)
    await cleanup()
  })

  it('skips .md files that start with "archive" prefix (line 25 arm=0)', async () => {
    await setup()

    // 'archive-old.md' ends with .md (passes first check) but starts with 'archive' → skipped
    await writeFile(
      join(TEST_DIR, 'zeno', 'gates', 'archive-old.md'),
      '# Old Archived Gate',
      'utf-8'
    )
    // Valid gate file to ensure discoverGates runs the loop
    await writeFile(
      join(TEST_DIR, 'zeno', 'gates', 'gate-02-active.md'),
      '# Gate 02: Active\n\nDesc',
      'utf-8'
    )

    const result = await discoverGates(TEST_DIR)

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('gate-02')
    await cleanup()
  })

  it('uses title-part fallback name and no description when content has no heading or second paragraph (lines 39/42 arm=1)', async () => {
    await setup()

    // Content with no '# heading' → name falls back to titlePart.replace(/-/g, ' ')
    // No blank-line-separated paragraph     → desc is undefined
    await writeFile(
      join(TEST_DIR, 'zeno', 'gates', 'gate-04-my-feature.md'),
      'No heading here. Just plain text.',
      'utf-8'
    )

    const result = await discoverGates(TEST_DIR)

    expect(result).toHaveLength(1)
    // titlePart = 'my-feature', hyphens replaced by spaces (line 39 arm=1)
    expect(result[0]!.name).toBe('my feature')
    // No second paragraph so description is undefined (line 42 arm=1)
    expect(result[0]!.description).toBeUndefined()
    await cleanup()
  })
})
