/**
 * Template CLI Command
 *
 * Commands for accessing and listing Zeno templates.
 * Provides three main commands:
 * - list: Display all templates with descriptions
 * - get: Retrieve specific template content
 * - context: Get template formatted for LLM context injection
 */

import type { Command } from 'commander'
import { createDiscoveryService } from '../../generation/artifact-discovery-service.js'

interface TemplateInfo {
  name: string
  shortName?: string
  category: string
  description?: string
  path?: string
}
interface TemplateArtifact {
  name: string
  category: string
  description?: string
  content: string
  path?: string
}

/**
 * Resolve template name by accepting both full name and short name
 * Handles both 'gate-prd-template' and 'gate-prd' formats
 */
const discovery = createDiscoveryService(process.cwd())

async function resolveTemplateName(name: string): Promise<string | undefined> {
  const templates = await discovery.getTemplates()
  const exact = templates.find((t) => t.name === name)
  if (exact) return exact.name
  if (!name.endsWith('-template')) {
    const withSuffix = templates.find((t) => t.name === `${name}-template`)
    if (withSuffix) return withSuffix.name
  }
  const byShortName = templates.find((t) => t.shortName === name)
  if (byShortName) return byShortName.name
  return undefined
}

/**
 * Format templates list as ASCII table
 */
function formatTemplateTable(
  templates: { name: string; category: string; description: string }[]
): string {
  const nameWidth = Math.max(...templates.map((t) => t.name.length), 'Name'.length)
  const categoryWidth = Math.max(...templates.map((t) => t.category.length), 'Category'.length)

  const separator = `+${'-'.repeat(nameWidth + 2)}+${'-'.repeat(categoryWidth + 2)}+${String('Description'.length + 2)}+`
  const header = `| ${'Name'.padEnd(nameWidth)} | ${'Category'.padEnd(categoryWidth)} | Description |`

  let output = separator + '\n' + header + '\n' + separator + '\n'

  for (const template of templates) {
    const desc = template.description.substring(0, 40)
    output += `| ${template.name.padEnd(nameWidth)} | ${template.category.padEnd(categoryWidth)} | ${desc.padEnd(40)} |\n`
  }

  output += separator

  return output
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}

/**
 * Register template commands with the CLI program
 */
export function registerTemplateCommand(program: Command): void {
  const templateCmd = program
    .command('template')
    .description('Access Zeno templates for context and documentation')

  // ===== list command =====
  templateCmd
    .command('list')
    .description('List all available templates with descriptions')
    .option('--format <format>', 'Output format: table, json, list', 'table')
    .action(async (options: { format?: string }): Promise<void> => {
      try {
        const format = options.format ?? 'table'

        // Validate format
        if (!['table', 'json', 'list'].includes(format)) {
          console.error(`Invalid format '${format}'. Use: table, json, list`)
          process.exit(1)
        }

        const templates = (await discovery.getTemplates()) as TemplateInfo[]

        if (format === 'json') {
          // JSON format - array of template objects
          const output = templates.map((t) => ({
            name: t.name,
            category: t.category,
            description: t.description,
            path: t.path,
          }))
          console.log(JSON.stringify(output, null, 2))
        } else if (format === 'list') {
          // List format - one template per line
          for (const template of templates) {
            console.log(template.name)
          }
        } else {
          // Table format - default, human readable
          const tableData = templates.map((t) => ({
            name: t.name,
            category: t.category,
            description: t.description ?? 'No description',
          }))
          console.log('\n' + formatTemplateTable(tableData) + '\n')
        }
      } catch (error) {
        console.error('Error listing templates:', error)
        process.exit(1)
      }
    })

  // ===== get command =====
  templateCmd
    .command('get <name>')
    .description('Get specific template content')
    .option('--raw', 'Output raw markdown without headers')
    .action(async (name: string, options: { raw?: boolean }): Promise<void> => {
      try {
        const resolvedName = await resolveTemplateName(name)

        if (!resolvedName) {
          const templates = await discovery.getTemplates()
          const available = templates.map((t) => t.name).join(', ')
          console.error(`Template '${name}' not found. Available templates: ${available}`)
          process.exit(1)
        }

        const artifact = (await discovery.getArtifact('template', resolvedName)) as
          | TemplateArtifact
          | undefined
        const content = artifact?.content

        if (!content) {
          console.error(`Template content not available: ${resolvedName}`)
          process.exit(1)
        }

        if (options.raw) {
          console.log(content)
        } else {
          console.log(`# Template: ${resolvedName}`)
          console.log('='.repeat(60))
          console.log(content)
        }
      } catch (error) {
        console.error('Error loading template:', error)
        process.exit(1)
      }
    })

  // ===== context command =====
  templateCmd
    .command('context <name>')
    .description('Get template formatted for LLM context injection')
    .option('--metadata', 'Include template metadata')
    .option('--compact', 'Minimize whitespace for context injection')
    .action(
      async (name: string, options: { metadata?: boolean; compact?: boolean }): Promise<void> => {
        try {
          const resolvedName = await resolveTemplateName(name)

          if (!resolvedName) {
            const templates = await discovery.getTemplates()
            const available = templates.map((t) => t.name).join(', ')
            console.error(`Template '${name}' not found. Available templates: ${available}`)
            process.exit(1)
          }

          const artifact = (await discovery.getArtifact('template', resolvedName)) as
            | TemplateArtifact
            | undefined
          const content = artifact?.content
          const metadata = artifact
            ? {
                name: artifact.name,
                category: artifact.category,
                description: artifact.description,
              }
            : null

          if (!metadata) {
            console.error(`Template metadata not found: ${resolvedName}`)
            process.exit(1)
          }

          const wordCount = countWords(content ?? '')

          const FILL_HEADER = [
            '> **FILL-OUT INSTRUCTIONS** — Replace every `[bracketed placeholder]` with concrete,',
            '> project-specific content. HTML comments (`<!-- ... -->`) are LLM guidance — strip',
            '> them before submitting. YAML frontmatter values in single quotes need real project',
            '> values. Search for `[` to find every unfilled slot. The validator rejects files',
            '> that still contain bracket placeholders.',
            '',
            '---',
            '',
          ].join('\n')

          if (options.compact) {
            // Compact format - minimal whitespace
            console.log(`# Template: ${resolvedName}`)
            console.log(`**Category**: ${metadata.category}`)
            console.log(`**Words**: ${String(wordCount)}`)
            if (options.metadata) {
              console.log(`**Description**: ${metadata.description ?? ''}`)
            }
            console.log('')
            console.log(FILL_HEADER + (content ?? ''))
          } else {
            // Default format - readable with metadata
            console.log(`# Template Context`)
            console.log('')
            console.log(`**Name**: ${resolvedName}`)
            console.log(`**Category**: ${metadata.category}`)
            console.log(`**Word Count**: ${String(wordCount)}`)
            if (options.metadata) {
              console.log(`**Purpose**: ${metadata.description ?? ''}`)
            }
            console.log('')
            console.log(FILL_HEADER + (content ?? ''))
          }
        } catch (error) {
          console.error('Error loading template:', error)
          process.exit(1)
        }
      }
    )
}
