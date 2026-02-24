/**
 * CI Verification Script: MCP Tools Documentation Coverage
 *
 * Ensures every registered MCP tool and action has corresponding documentation
 * in docs/MCP-TOOLS.md. Fails the build if any tool/action is not documented.
 *
 * Usage: npx tsx scripts/verify-mcp-docs-coverage.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Import the ToolRegistry to get the authoritative list of tools and actions
// For CI purposes, we read the source file directly to avoid build dependencies
const registryPath = path.join(__dirname, '../src/mcp/schemas/registry.ts')
const docPath = path.join(__dirname, '../docs/MCP-TOOLS.md')

interface Tool {
  toolName: string
  actions: readonly string[]
}

/**
 * Parse ToolRegistry from the registry.ts file.
 * Extracts tool names and actions by reading the TypeScript source.
 */
function parseRegistry(content: string): Map<string, string[]> {
  const tools = new Map<string, string[]>()

  // More robust regex to handle multiline actions and whitespace variations
  const toolMatches = content.matchAll(
    /toolName:\s*['"]([^'"]+)['"]\s*,\s*actions:\s*\[([^\]]+)\]\s*as\s*const/gs
  )

  for (const match of toolMatches) {
    const [, toolName, actionsStr] = match
    // Extract action names, handling multiline and extra whitespace
    const actions = actionsStr
      .split(',')
      .map((a) => a.trim().replace(/['"]/g, '').trim())
      .filter((a) => a.length > 0 && a !== '')

    tools.set(toolName, actions)
  }

  return tools
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
    // Check for tool heading: ## toolName anywhere in the document
    const toolHeading = `## ${toolName}`
    if (!docContent.includes(toolHeading)) {
      missingTools.push(toolName)
      continue
    }

    // Check for action subsections: #### <toolName>: <action>
    const missingForTool: string[] = []
    for (const action of actions) {
      const actionHeading = `#### ${toolName}: ${action}`
      if (!docContent.includes(actionHeading)) {
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

  // Read registry
  if (!fs.existsSync(registryPath)) {
    console.error(`[ERROR] Registry file not found: ${registryPath}`)
    return 1
  }

  const registryContent = fs.readFileSync(registryPath, 'utf-8')
  const tools = parseRegistry(registryContent)

  if (tools.size === 0) {
    console.error('[ERROR] No tools found in registry. Check parsing logic.')
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
