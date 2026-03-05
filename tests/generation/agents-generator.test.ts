import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { generateAgentsMD, ZENO_BLOCK_START, ZENO_BLOCK_END } from '../../src/generation/agents-generator.js'
import type { ZenoConfig } from '../../src/utils/config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_PATH = resolve(__dirname, '../../templates/md-templates/agents-template.md')
const templateContent = readFileSync(TEMPLATE_PATH, 'utf-8')

// ---------------------------------------------------------------------------
// Helpers — extract the inner ZENO block from the template so assertions are
// scoped to only the Zeno-managed content (same slice the generator produces).
// ---------------------------------------------------------------------------

function extractZenoBlock(md: string): string {
  const startIdx = md.indexOf(ZENO_BLOCK_START)
  const endIdx = md.indexOf(ZENO_BLOCK_END)
  if (startIdx === -1 || endIdx === -1) return md
  return md.slice(startIdx + ZENO_BLOCK_START.length, endIdx)
}

/** All ## / ### section headings inside the ZENO block (skips the file title). */
function parseHeaders(md: string): string[] {
  return md
    .split('\n')
    .filter(line => /^#{2,4} /.test(line))
    .map(line => line.replace(/^#+\s+/, '').trim())
}

/**
 * Backtick-wrapped tool names in the first column of the MCP Tool Reference
 * table (lines of the form `| \`tool_name\` | ...`).
 */
function parseMcpToolNames(md: string): string[] {
  const section = md.match(/#{2,3} MCP Tool Reference[\s\S]*?(?=\n#{2,3} |\n---)/)?.[0] ?? ''
  return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map(m => m[1].trim())
}

/**
 * All backtick-wrapped values from the right column of the Quick Navigation
 * table (lines of the form `| ... | \`value\` ...`).
 */
function parseNavToolRefs(md: string): string[] {
  const section = md.match(/#{2,3} Quick Navigation[\s\S]*?(?=\n#{2,3} )/)?.[0] ?? ''
  return [...section.matchAll(/\|\s+`([^`]+)`/g)]
    .map(m => m[1].trim())
    .filter(v => v.includes('_action') || v === 'config_get')
}

// Parse from the inner ZENO block only
const ZENO_BLOCK = extractZenoBlock(templateContent)
const TEMPLATE_HEADERS = parseHeaders(ZENO_BLOCK)
const TEMPLATE_MCP_TOOLS = parseMcpToolNames(ZENO_BLOCK)
const TEMPLATE_NAV_TOOLS = parseNavToolRefs(ZENO_BLOCK)

// ---------------------------------------------------------------------------

function createTestConfig(overrides: Partial<ZenoConfig> = {}): ZenoConfig {
  return {
    projectName: 'Test Project',
    version: '1.0.0',
    hashAlgorithm: 'sha256',
    hashLength: 16,
    versioning: {
      enabled: true,
      proposalBump: 'patch',
      gateBump: 'minor',
      lifecycleBump: 'major',
    },
    workflowMode: 'solo',
    qualityThresholds: {
      codeCoverage: 90,
      securityVulnerabilities: 0,
      lintingErrorRate: 0.01,
      typeCheckingErrors: 0,
    },
    ...overrides,
  } as ZenoConfig
}

describe('Agents Generator', () => {
  it('output contains all section headers from the template ZENO block', () => {
    const result = generateAgentsMD(createTestConfig())
    for (const header of TEMPLATE_HEADERS) {
      expect(result, `missing header: "${header}"`).toContain(header)
    }
  })

  it('output contains all MCP tool names from the template reference table', () => {
    const result = generateAgentsMD(createTestConfig())
    expect(TEMPLATE_MCP_TOOLS.length).toBeGreaterThan(0)
    for (const tool of TEMPLATE_MCP_TOOLS) {
      expect(result, `missing MCP tool: "${tool}"`).toContain(tool)
    }
  })

  it('output contains all nav tool references from the template Quick Navigation table', () => {
    const result = generateAgentsMD(createTestConfig())
    expect(TEMPLATE_NAV_TOOLS.length).toBeGreaterThan(0)
    for (const ref of TEMPLATE_NAV_TOOLS) {
      expect(result, `missing nav ref: "${ref}"`).toContain(ref)
    }
  })

  it('project name appears in the Project metadata line', () => {
    const config = createTestConfig({ projectName: 'My Awesome Project' })
    const result = generateAgentsMD(config)
    expect(result).toContain('My Awesome Project')
    expect(result).not.toContain('[Project Name]')
  })

  it('date placeholder is replaced with a real date', () => {
    const result = generateAgentsMD(createTestConfig())
    expect(result).toMatch(/Last Updated.*\d{4}-\d{2}-\d{2}/)
    expect(result).not.toContain('[TIMESTAMP]')
  })
})
