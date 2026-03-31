import { promises as fs } from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __installDir = fileURLToPath(new URL('../..', import.meta.url))

export interface Template {
  name: string
  shortName: string
  path: string
  description: string
  category: 'markdown' | 'architecture' | 'misc'
  content?: string
  localPath?: string
}

async function readFileHead(filePath: string, maxBytes = 4096): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8')
  return content.slice(0, maxBytes)
}

function parseFrontmatter(text: string): Record<string, string> | null {
  const fm = /^---\s*\n([\s\S]*?)\n---/.exec(text)
  if (!fm) return null
  const body = fm[1]
  if (!body) return null
  const out: Record<string, string> = {}
  for (const line of body.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line)
    if (m?.[1]) out[m[1].trim()] = m[2]?.trim() ?? ''
  }
  return out
}

export async function discoverTemplates(projectRoot?: string): Promise<Template[]> {
  const baseDir = projectRoot ?? __installDir
  const templatesDir = path.join(baseDir, 'templates')
  const mdDir = path.join(templatesDir, 'md-templates')
  const archDir = path.join(templatesDir, 'architecture-templates')
  const miscDir = path.join(templatesDir, 'misc-templates')

  const results: Template[] = []

  async function scanDir(dir: string, category: 'markdown' | 'architecture'): Promise<void> {
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    } catch {
      return
    }

    for (const name of entries) {
      if (!name.endsWith('.md')) continue
      const full = path.join(dir, name)
      try {
        const head = await readFileHead(full)
        const fm = parseFrontmatter(head)
        const firstLine = head.split(/\r?\n/).find((l) => l.trim().length > 0) ?? ''
        const descriptionFromFm = fm?.['description'] ?? fm?.['desc'] ?? undefined

        const shortName = name.replace(/-template\.md$/i, '').replace(/\.md$/i, '')
        const templateName = `${shortName}-template`

        results.push({
          name: templateName,
          shortName,
          path: path.relative(__installDir, full).replace(/\\/g, '/'),
          description: descriptionFromFm ?? firstLine,
          category,
        })
      } catch {
        // skip invalid files
      }
    }
  }

  async function scanMiscDir(dir: string): Promise<void> {
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    } catch {
      return
    }

    if (!Array.isArray(entries)) return

    for (const name of entries) {
      // skip hidden files and directories
      if (name.startsWith('.')) continue
      const full = path.join(dir, name)
      try {
        const stat = await fs.stat(full)
        if (!stat.isFile()) continue
      } catch {
        continue
      }
      const shortName = name.replace(/-template$/, '')
      const templateName = shortName === name ? name : `${shortName}-template`
      results.push({
        name: templateName,
        shortName,
        path: path.relative(__installDir, full).replace(/\\/g, '/'),
        description: `Misc template: ${shortName}`,
        category: 'misc',
      })
    }
  }

  await scanDir(mdDir, 'markdown')
  await scanDir(archDir, 'architecture')
  await scanMiscDir(miscDir)

  return results
}

export async function loadTemplateContent(_projectRoot: string | undefined, relPath: string): Promise<string> {
  const full = path.join(__installDir, relPath)
  return fs.readFile(full, 'utf-8')
}

/**
 * Load the bundled .gitignore template from templates/misc-templates/gitignore.
 */
export async function loadGitignoreTemplate(): Promise<string> {
  const full = path.join(__installDir, 'templates', 'misc-templates', 'gitignore')
  return fs.readFile(full, 'utf-8')
}

/**
 * Copies a template from the install directory into <workspacePath>/.local/zeno-templates/
 * and returns the absolute destination path. No template content is returned.
 */
export async function copyTemplateToLocal(workspacePath: string, relPath: string): Promise<string> {
  const srcPath = path.join(__installDir, relPath)
  const destDir = path.join(workspacePath, '.local', 'zeno-templates')
  await fs.mkdir(destDir, { recursive: true })
  const destPath = path.join(destDir, path.basename(relPath))
  await fs.copyFile(srcPath, destPath)
  return destPath
}
