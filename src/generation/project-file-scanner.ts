/**
 * Project File Scanner
 *
 * Discovers spec-like files and directories in an existing project and extracts
 * their text content so it can be fed into the requirement-extraction pipeline.
 *
 * Scanned candidates:
 *   - Well-known spec filenames at the project root (README.md, REQUIREMENTS.md, …)
 *   - All text files found under well-known spec directories (docs/, specs/, …)
 *
 * Spec directories are scanned recursively; skip-listed directories
 * (node_modules, dist, .git, zeno, …) are never descended into.
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Well-known spec / documentation filenames to look for at the project root. */
const ROOT_SPEC_FILENAMES = new Set([
  'README.md',
  'readme.md',
  'REQUIREMENTS.md',
  'requirements.md',
  'requirements.txt',
  'SPEC.md',
  'spec.md',
  'DESIGN.md',
  'design.md',
  'FEATURES.md',
  'features.md',
  'TODO.md',
  'todo.md',
  'ROADMAP.md',
  'roadmap.md',
  'USER_STORIES.md',
  'user-stories.md',
  'ARCHITECTURE.md',
  'architecture.md',
  'OVERVIEW.md',
  'overview.md',
  'SCOPE.md',
  'scope.md',
  'GOALS.md',
  'goals.md',
])

/** Directories whose contents are treated as specs. Scanned recursively. */
const SPEC_DIRECTORIES = new Set([
  'docs',
  'doc',
  'spec',
  'specs',
  'requirements',
  'features',
  'design',
  'documentation',
  'rfcs',
  'proposals',
])

/** File extensions eligible for text extraction. */
const READABLE_EXTENSIONS = new Set(['.md', '.txt', '.rst', '.adoc'])

/** Directories to never descend into. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  'vendor',
  'zeno',     // Zeno's own planning directory — not a project spec
  '.zeno',
  '.local',
])

const MAX_FILE_BYTES = 128 * 1024  // 128 KB per file — avoid huge generated docs

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScannedFile {
  /** Relative path from projectRoot for display purposes. */
  relativePath: string
  /** Raw text content. */
  content: string
}

export interface ScanResult {
  files: ScannedFile[]
  /** Combined text of all scanned files (separated by newlines). */
  combinedText: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan `projectRoot` for spec-like files and return their text content.
 *
 * Searches:
 *   1. Root-level filenames in `ROOT_SPEC_FILENAMES`
 *   2. Files inside `SPEC_DIRECTORIES` (recursive, readable extensions only)
 *
 * Never throws — errors for individual files are silently skipped.
 */
export async function scanProjectFiles(projectRoot: string): Promise<ScanResult> {
  const collected: ScannedFile[] = []

  // 1. Root-level spec files
  for (const filename of ROOT_SPEC_FILENAMES) {
    const fullPath = join(projectRoot, filename)
    if (!existsSync(fullPath)) continue
    const content = await safeReadFile(fullPath)
    if (content) {
      collected.push({ relativePath: filename, content })
    }
  }

  // 2. Spec directories (one level deep)
  let rootEntries: string[]
  try {
    rootEntries = await readdir(projectRoot)
  } catch {
    rootEntries = []
  }

  for (const entry of rootEntries) {
    if (!SPEC_DIRECTORIES.has(entry.toLowerCase())) continue
    if (SKIP_DIRS.has(entry.toLowerCase())) continue

    const dirPath = join(projectRoot, entry)
    let dirStat
    try {
      dirStat = await stat(dirPath)
    } catch {
      continue
    }
    if (!dirStat.isDirectory()) continue

    const dirFiles = await scanDirectory(dirPath, projectRoot)
    collected.push(...dirFiles)
  }

  // Deduplicate by relativePath (root-level file may already be listed)
  const seen = new Set<string>()
  const deduplicated = collected.filter((f) => {
    const key = f.relativePath.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const combinedText = deduplicated.map((f) => f.content).join('\n\n')
  return { files: deduplicated, combinedText }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function scanDirectory(
  dirPath: string,
  projectRoot: string
): Promise<ScannedFile[]> {
  let entries: string[]
  try {
    entries = await readdir(dirPath)
  } catch {
    return []
  }

  const results: ScannedFile[] = []

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.toLowerCase())) continue

    const fullPath = join(dirPath, entry)
    let entryStat
    try {
      entryStat = await stat(fullPath)
    } catch {
      continue
    }

    if (entryStat.isDirectory()) {
      const nested = await scanDirectory(fullPath, projectRoot)
      results.push(...nested)
    } else if (entryStat.isFile() && READABLE_EXTENSIONS.has(extname(entry).toLowerCase())) {
      const content = await safeReadFile(fullPath)
      if (content) {
        results.push({ relativePath: relative(projectRoot, fullPath), content })
      }
    }
  }

  return results
}

async function safeReadFile(fullPath: string): Promise<string | null> {
  try {
    const fileStat = await stat(fullPath)
    if (fileStat.size > MAX_FILE_BYTES) return null
    return await readFile(fullPath, 'utf-8')
  } catch {
    return null
  }
}
