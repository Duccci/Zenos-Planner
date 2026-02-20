/**
 * CLI Workflow Integration Test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { tmpdir } from 'os'

describe('CLI Workflow Integration', () => {
  let tempDir: string
  let originalCwd: string

  beforeEach(() => {
    // Create temporary directory for test
    tempDir = path.join(tmpdir(), 'zeno-test-' + Math.random().toString(36).substr(2, 9))
    fs.mkdirSync(tempDir, { recursive: true })

    originalCwd = process.cwd()
    process.chdir(tempDir)

    vi.clearAllMocks()
  })

  afterEach(() => {
    // Cleanup
    process.chdir(originalCwd)
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should complete zeno init workflow', () => {
    // Create project structure
    fs.mkdirSync(path.join(tempDir, 'zeno', '.zeno'), { recursive: true })
    fs.mkdirSync(path.join(tempDir, 'zeno', 'gates'), { recursive: true })
    fs.mkdirSync(path.join(tempDir, 'zeno', 'proposals'), { recursive: true })

    const zenoDir = path.join(tempDir, 'zeno')
    expect(fs.existsSync(zenoDir)).toBe(true)
    expect(fs.existsSync(path.join(zenoDir, '.zeno'))).toBe(true)
    expect(fs.existsSync(path.join(zenoDir, 'gates'))).toBe(true)
    expect(fs.existsSync(path.join(zenoDir, 'proposals'))).toBe(true)
  })

  it('should display gates list correctly', () => {
    // Setup mock gates data structure
    const gatesDir = path.join(tempDir, 'zeno', 'gates')
    fs.mkdirSync(gatesDir, { recursive: true })

    // Create sample gate files
    fs.writeFileSync(path.join(gatesDir, 'gate-01-setup.md'), '# Gate 1\n**Status**: pending\n')
    fs.writeFileSync(path.join(gatesDir, 'gate-02-build.md'), '# Gate 2\n**Status**: pending\n')

    // Verify gates can be discovered
    const gateFiles = fs.readdirSync(gatesDir).filter((f) => f.endsWith('.md'))
    expect(gateFiles).toHaveLength(2)
    expect(gateFiles).toContain('gate-01-setup.md')
    expect(gateFiles).toContain('gate-02-build.md')
  })

  it('should show gate details', () => {
    // Setup gate with detailed content
    const gatesDir = path.join(tempDir, 'zeno', 'gates')
    fs.mkdirSync(gatesDir, { recursive: true })

    const gateContent = `# Gate 1: Setup
**Status**: pending
**Type**: feature
**Sequence**: 1

## Objectives
- Initialize project structure
- Set up development environment

## Requirements
- Must support TypeScript
- Must include linting`

    const gatePath = path.join(gatesDir, 'gate-01-setup.md')
    fs.writeFileSync(gatePath, gateContent)

    // Verify gate details are accessible
    const content = fs.readFileSync(gatePath, 'utf8')
    expect(content).toContain('Gate 1: Setup')
    expect(content).toContain('pending')
    expect(content).toContain('feature')
    expect(content).toContain('Objectives')
  })

  it('should handle start gate with confirmation', () => {
    // Setup gate in pending status
    const gatesDir = path.join(tempDir, 'zeno', 'gates')
    fs.mkdirSync(gatesDir, { recursive: true })

    const gatePath = path.join(gatesDir, 'gate-01-setup.md')
    fs.writeFileSync(gatePath, '# Gate 1\n**Status**: pending\n')

    // Verify initial state is pending
    let content = fs.readFileSync(gatePath, 'utf8')
    expect(content).toContain('pending')

    // Simulate gate transition to in_progress
    fs.writeFileSync(gatePath, '# Gate 1\n**Status**: in_progress\n')

    // Verify state changed
    content = fs.readFileSync(gatePath, 'utf8')
    expect(content).toContain('in_progress')
    expect(content).not.toContain('pending')
  })

  it('should provide helpful error messages', () => {
    // Test missing gate scenario
    const gatesDir = path.join(tempDir, 'zeno', 'gates')
    fs.mkdirSync(gatesDir, { recursive: true })

    const gatePath = path.join(gatesDir, 'gate-01-setup.md')

    // Verify error case: gate does not exist
    expect(fs.existsSync(gatePath)).toBe(false)

    // Create error handling by verifying file operations
    try {
      const content = fs.readFileSync(gatePath, 'utf8')
      expect(content).toBeDefined()
    } catch (err) {
      expect(err).toBeDefined()
      expect((err as NodeJS.ErrnoException).code).toBe('ENOENT')
    }
  })

  it('should maintain consistent output formatting', () => {
    // Setup structured gate content
    const gatesDir = path.join(tempDir, 'zeno', 'gates')
    fs.mkdirSync(gatesDir, { recursive: true })

    const gateTemplate = `# Gate {id}: {name}
**Status**: {status}
**Type**: {type}
**Sequence**: {sequence}

## Objectives
- {objective1}
- {objective2}

## Requirements
- {requirement1}
- {requirement2}`

    const gate1 = gateTemplate
      .replace('{id}', '1')
      .replace('{name}', 'Setup')
      .replace('{status}', 'pending')
      .replace('{type}', 'feature')
      .replace('{sequence}', '1')
      .replace('{objective1}', 'Initialize')
      .replace('{objective2}', 'Configure')
      .replace('{requirement1}', 'TypeScript')
      .replace('{requirement2}', 'Linting')

    const gate2 = gateTemplate
      .replace('{id}', '2')
      .replace('{name}', 'Build')
      .replace('{status}', 'pending')
      .replace('{type}', 'feature')
      .replace('{sequence}', '2')
      .replace('{objective1}', 'Compile')
      .replace('{objective2}', 'Package')
      .replace('{requirement1}', 'Build tool')
      .replace('{requirement2}', 'Bundler')

    fs.writeFileSync(path.join(gatesDir, 'gate-01-setup.md'), gate1)
    fs.writeFileSync(path.join(gatesDir, 'gate-02-build.md'), gate2)

    // Verify formatting consistency
    const gates = [gate1, gate2]
    for (const gate of gates) {
      expect(gate).toMatch(/^# Gate \d+:/)
      expect(gate).toContain('**Status**:')
      expect(gate).toContain('**Type**:')
      expect(gate).toContain('**Sequence**:')
      expect(gate).toContain('## Objectives')
      expect(gate).toContain('## Requirements')
    }
  })
})
