/**
 * Template drift check
 *
 * ok:   All gate PRDs and proposal scaffold files match their current template
 *       hashes (or have no template_hash field — legacy files are skipped).
 * warn: One or more files contain a template_hash that differs from the current
 *       shipped template, indicating a stale artifact that should be regenerated.
 *
 * Gate PRDs embed `template_hash` (gate-prd-template.md hash).
 * Proposal scaffolds embed `template_hash` (proposal-template.md hash).
 * Files without a template_hash are skipped.
 */

import { createHash } from 'node:crypto'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findProjectRoot, getWorkspaceRoot, getZenoGitDir } from '../../../../utils/config.js'
import type { DoctorCheckResult } from '../types.js'

const __installDir = fileURLToPath(new URL('../../../../../', import.meta.url))

function currentTemplateHash(): string {
  const templatePath = join(__installDir, 'templates', 'md-templates', 'gate-prd-template.md')
  const raw = readFileSync(templatePath, 'utf-8')
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

function currentProposalTemplateHash(): string {
  const templatePath = join(__installDir, 'templates', 'md-templates', 'proposal-template.md')
  const raw = readFileSync(templatePath, 'utf-8')
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

function extractTemplateHash(content: string): string | null {
  const match = /^\s*template_hash:\s*['"]?([a-f0-9]{16})['"]?\s*$/m.exec(content)
  return match?.[1] ?? null
}

/**
 * Collect stale proposal files by walking zeno/proposals/ subdirectories.
 * Only files whose template_hash field is present and mismatched are reported.
 */
function collectStaleProposals(proposalsDir: string, expectedHash: string): string[] {
  const stale: string[] = []
  if (!existsSync(proposalsDir)) return stale

  let subdirs: string[]
  try {
    subdirs = readdirSync(proposalsDir)
  } catch {
    return stale
  }

  for (const subdir of subdirs) {
    const subdirPath = join(proposalsDir, subdir)
    try {
      if (!statSync(subdirPath).isDirectory()) continue
    } catch {
      continue
    }

    let files: string[]
    try {
      files = readdirSync(subdirPath).filter(f => f.endsWith('.md'))
    } catch {
      continue
    }

    for (const filename of files) {
      const filePath = join(subdirPath, filename)
      try {
        const content = readFileSync(filePath, 'utf-8')
        const fileHash = extractTemplateHash(content)
        if (fileHash !== null && fileHash !== expectedHash) {
          stale.push(`${subdir}/${filename}`)
        }
      } catch {
        // Unreadable file — skip silently
      }
    }
  }

  return stale
}

export function checkTemplateDrift(): DoctorCheckResult {
  const id = 'template_drift'
  const label = 'Gate PRD & proposal template drift'

  const projectRoot = findProjectRoot(getWorkspaceRoot())
  if (!projectRoot) {
    return {
      id,
      label,
      status: 'ok',
      detail: 'No Zeno project found — skipping template drift check',
      fix: null,
    }
  }

  const zenoDir = getZenoGitDir(projectRoot)
  const gatesDir = join(zenoDir, 'gates')
  const proposalsDir = join(zenoDir, 'proposals')

  if (!existsSync(gatesDir) && !existsSync(proposalsDir)) {
    return {
      id,
      label,
      status: 'ok',
      detail: 'No gates or proposals directory found — nothing to check',
      fix: null,
    }
  }

  let expectedGateHash: string
  try {
    expectedGateHash = currentTemplateHash()
  } catch {
    return {
      id,
      label,
      status: 'warn',
      detail: 'Could not read gate-prd-template.md to compute expected hash',
      fix: 'Ensure the package installation is intact (templates/md-templates/gate-prd-template.md must exist)',
    }
  }

  let expectedProposalHash: string
  try {
    expectedProposalHash = currentProposalTemplateHash()
  } catch {
    return {
      id,
      label,
      status: 'warn',
      detail: 'Could not read proposal-template.md to compute expected hash',
      fix: 'Ensure the package installation is intact (templates/md-templates/proposal-template.md must exist)',
    }
  }

  const staleGates: string[] = []

  if (existsSync(gatesDir)) {
    let entries: string[]
    try {
      entries = readdirSync(gatesDir).filter(f => f.endsWith('.md'))
    } catch {
      entries = []
    }

    for (const filename of entries) {
      const filePath = join(gatesDir, filename)
      try {
        const content = readFileSync(filePath, 'utf-8')
        const fileHash = extractTemplateHash(content)
        if (fileHash !== null && fileHash !== expectedGateHash) {
          staleGates.push(filename)
        }
      } catch {
        // Unreadable file — skip silently
      }
    }
  }

  const staleProposals = collectStaleProposals(proposalsDir, expectedProposalHash)

  const totalStale = staleGates.length + staleProposals.length
  if (totalStale === 0) {
    return {
      id,
      label,
      status: 'ok',
      detail: `All gate PRDs and proposal scaffolds match their template hashes (or have no hash field)`,
      fix: null,
    }
  }

  const parts: string[] = []
  if (staleGates.length > 0) {
    parts.push(`${String(staleGates.length)} gate PRD(s): ${staleGates.join(', ')}`)
  }
  if (staleProposals.length > 0) {
    parts.push(`${String(staleProposals.length)} proposal(s): ${staleProposals.join(', ')}`)
  }

  return {
    id,
    label,
    status: 'warn',
    detail: `Template drift detected in ${parts.join('; ')}`,
    fix: 'For gate PRDs: re-run `zeno gates replan`. For proposals: re-run `proposal_action:generate` for the affected gate to regenerate scaffolds.',
  }
}
