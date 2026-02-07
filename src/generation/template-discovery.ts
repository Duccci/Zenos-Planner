import { promises as fs } from 'fs'
import * as path from 'path'

export interface Template {
  name: string
  shortName: string
  path: string
  description: string
  category: 'markdown' | 'architecture'
}

async function readFileHead(filePath: string, maxBytes = 4096): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8')
  return content.slice(0, maxBytes)
}

function parseFrontmatter(text: string): Record<string, string> | null {
  const fm = /^---\s*\n([\s\S]*?)\n---/.exec(text)
  if (!fm) return null
  const body = fm[1]!
  const out: Record<string, string> = {}
  for (const line of body.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line)
    if (m) out[m[1]!.trim()] = m[2]!.trim()
  }
  return out
}

export async function discoverTemplates(projectRoot: string): Promise<Template[]> {
  const templatesDir = path.join(projectRoot, 'templates')
  const mdDir = path.join(templatesDir, 'md-templates')
  const archDir = path.join(templatesDir, 'architecture-templates')

  const results: Template[] = []

  async function scanDir(dir: string, category: 'markdown' | 'architecture') {
    let entries: string[] = []
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
        const firstLine = head.split(/\r?\n/).find(l => l.trim().length > 0) || ''
        const descriptionFromFm = fm ? (fm['description'] || fm['desc']) : undefined

        const shortName = name.replace(/-template\.md$/i, '').replace(/\.md$/i, '')
        const templateName = `${shortName}-template`

        results.push({
          name: templateName,
          shortName,
          path: path.relative(projectRoot, full).replace(/\\/g, '/'),
          description: descriptionFromFm || (firstLine || ''),
          category
        })
      } catch (e) {
        // skip invalid files
      }
    }
  }

  await scanDir(mdDir, 'markdown')
  await scanDir(archDir, 'architecture')

  return results
}

export async function loadTemplateContent(projectRoot: string, relPath: string): Promise<string> {
  const full = path.join(projectRoot, relPath)
  return fs.readFile(full, 'utf-8')
}
