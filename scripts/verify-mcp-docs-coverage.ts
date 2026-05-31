/**
 * CI Verification Script: MCP Tools Documentation Coverage
 *
 * Ensures every registered MCP handler tool has corresponding documentation in
 * docs/MCP-TOOLS.md. Fails the build if live tool definitions drift from docs.
 *
 * Usage: npx tsx scripts/verify-mcp-docs-coverage.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { getMcpToolDefinitionInfo } from '../src/mcp/tools/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const docPath = path.join(__dirname, '../docs/MCP-TOOLS.md')

function getRegisteredTools(): Map<string, string[]> {
  return new Map(
    getMcpToolDefinitionInfo().map((tool) => [tool.name, tool.actions] as const)
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasToolReference(docContent: string, toolName: string): boolean {
  const escapedToolName = escapeRegExp(toolName)
  const headingPattern = new RegExp('^##\\s+' + escapedToolName + '\\b', 'm')
  const tablePattern = new RegExp('\\|\\s*`' + escapedToolName + '`\\s*\\|')
  return headingPattern.test(docContent) || tablePattern.test(docContent)
}

function hasActionReference(docContent: string, toolName: string, action: string): boolean {
  const escapedToolName = escapeRegExp(toolName)
  const escapedAction = escapeRegExp(action)
  const headingPattern = new RegExp(
    '^#{3,4}\\s+' + escapedToolName + ':\\s+' + escapedAction + '\\b',
    'm'
  )
  const tablePattern = new RegExp(
    '\\|\\s*`' + escapedToolName + '`\\s*\\|\\s*`' + escapedAction + '`\\s*\\|'
  )
  const inlinePattern = new RegExp('`' + escapedToolName + '`[^\\n]*`' + escapedAction + '`')
  return headingPattern.test(docContent) || tablePattern.test(docContent) || inlinePattern.test(docContent)
}

/**
 * Check if documentation contains a tool heading and all its action subsections.
 */
function verifyDocumentation(
  docContent: string,
  tools: Map<string, string[]>
): { passed: boolean; missingTools: string[]; missingActions: Map<string, string[]> } {
  const missingTools: string[] = []
  const missingActions = new Map<string, string[]>()

  for (const [toolName, actions] of tools) {
    if (!hasToolReference(docContent, toolName)) {
      missingTools.push(toolName)
      continue
    }

    // Check for action subsections: #### <toolName>: <action>
    const missingForTool: string[] = []
    for (const action of actions) {
      if (!hasActionReference(docContent, toolName, action)) {
        missingForTool.push(action)
      }
    }

    if (missingForTool.length > 0) {
      missingActions.set(toolName, missingForTool)
    }
  }

  const passed = missingTools.length === 0 && missingActions.size === 0

  return { passed, missingTools, missingActions }
}

/**
 * Main verification function.
 */
async function verify(): Promise<number> {
  console.log('[MCP Documentation Coverage Verification]')
  console.log()

  const tools = getRegisteredTools()

  if (tools.size === 0) {
    console.error('[ERROR] No MCP handler tool definitions found. Check src/mcp/tools/index.ts.')
    return 1
  }

  console.log(`[INFO] Found ${tools.size} registered tools:`)
  for (const [toolName, actions] of tools) {
    console.log(`  - ${toolName} (${actions.length} actions): ${actions.join(', ')}`)
  }
  console.log()

  // Read documentation
  if (!fs.existsSync(docPath)) {
    console.error(`[ERROR] Documentation file not found: ${docPath}`)
    return 1
  }

  const docContent = fs.readFileSync(docPath, 'utf-8')

  // Verify coverage
  const { passed, missingTools, missingActions } = verifyDocumentation(docContent, tools)

  if (passed) {
    console.log('[OK] All registered tools and actions are documented.')
    console.log()
    return 0
  }

  // Report missing items
  console.error('[COVERAGE FAILURE]')
  console.error()

  if (missingTools.length > 0) {
    console.error(`Missing tool documentation for ${missingTools.length} tool(s):`)
    for (const tool of missingTools) {
      console.error(`  - ## ${tool}`)
    }
    console.error()
  }

  if (missingActions.size > 0) {
    console.error(`Missing action documentation for ${missingActions.size} tool(s):`)
    for (const [tool, actions] of missingActions) {
      console.error(`  [${tool}]`)
      for (const action of actions) {
        console.error(`    - #### ${tool}: ${action}`)
      }
    }
    console.error()
  }

  console.error(`Add missing sections to ${docPath}`)
  console.error()

  return 1
}

// Run verification
verify().then((exitCode) => {
  process.exit(exitCode)
})
