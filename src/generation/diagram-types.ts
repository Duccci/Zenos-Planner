/**
 * Diagram types and template-driven discovery
 *
 * Provides a runtime-discoverable DiagramType registry rather than a hard-coded enum.
 */
import { readdirSync } from 'node:fs'
import { join, extname, basename } from 'node:path'

export type DiagramType = string

export type DiagramCategory = 'core' | 'conditional'

export interface ComplexityScore {
  nodeCount: number
  edgeCount: number
  nestingDepth: number
  totalScore: number
}

export interface ComplexityThresholds {
  maxMermaidNodes: number
  maxMermaidEdges: number
  nestingDepthMultiplier: number
  svgCollapseThresholdBytes?: number
}

export type RenderingBackend = 'mermaid' | 'graphviz'

export interface DiagramMetadata {
  type: DiagramType
  category: DiagramCategory
  renderingBackend: RenderingBackend
  gateName?: string
  filePath?: string
}

/**
 * Discover available diagram templates by scanning the project's templates directories.
 * Returns an array of template short names (e.g. 'system-overview-template').
 */
export function discoverDiagramTemplates(projectRoot: string = process.cwd()): string[] {
  const templatesDir = join(projectRoot, 'templates')
  const mdDir = join(templatesDir, 'md-templates')
  const archDir = join(templatesDir, 'architecture-templates')
  const out = new Set<string>()

  function scan(dir: string): void {
    try {
      const entries = readdirSync(dir)
      for (const name of entries) {
        if (!name.endsWith('.md')) continue
        const short = basename(name, extname(name)).replace(/-template$/i, '')
        out.add(short)
      }
    } catch {
      // directory may not exist - ignore
    }
  }

  scan(mdDir)
  scan(archDir)

  return Array.from(out).sort()
}

/**
 * Produce a registry mapping template shortName -> relative path (templates/ ...).
 */
export function getTemplateRegistry(projectRoot: string = process.cwd()): Record<string, string> {
  const registry: Record<string, string> = {}
  for (const t of discoverDiagramTemplates(projectRoot)) {
    // prefer md-templates location by default
    registry[t] = `templates/md-templates/${t}.md`
  }
  return registry
}

export function getAvailableDiagramTypes(projectRoot: string = process.cwd()): DiagramType[] {
  return discoverDiagramTemplates(projectRoot)
}
