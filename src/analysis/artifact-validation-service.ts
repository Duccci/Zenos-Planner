/**
 * Artifact Validation Service (lightweight)
 * Used by CLI and MCP handlers for quick format/structure checks.
 */
import { readFile } from 'node:fs/promises'

export type ArtifactType = 'gate' | 'proposal' | 'architecture'
export type ValidationMode = 'format' | 'quality' | 'all'

export interface ValidationInput {
  artifactPath?: string
  artifactHash?: string
  artifactType: ArtifactType
  validationMode?: ValidationMode
}

export interface ValidationResult {
  passed: boolean
  errors?: string[]
  warnings?: string[]
  details?: unknown
}

export class ArtifactValidationService {
  async validate(input: ValidationInput): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    const pathProvided = Boolean(input.artifactPath)

    if (!pathProvided) {
      return {
        passed: false,
        errors: ['artifactPath is required for validation in this lightweight implementation'],
      }
    }

    const artifactPath = input.artifactPath
    if (!artifactPath) {
      return {
        passed: false,
        errors: ['artifactPath is required for validation in this lightweight implementation'],
      }
    }

    try {
      const content = await readFile(artifactPath, 'utf-8')

      if (input.artifactType === 'proposal') {
        const required = ['## Summary', '## Tasks', '## Files Affected', '## Dependencies']
        for (const r of required) {
          if (!content.includes(r)) {
            errors.push(`Missing required section: ${r}`)
          }
        }
        // Basic single-phase detection
        if (/(Phase|Stage)\s*\d+/i.test(content)) {
          errors.push(
            'Detected multi-phase language (e.g., "Phase 1") in proposal tasks; proposals must be single-phase'
          )
        }
      } else if (input.artifactType === 'gate') {
        const required = ['## Objectives', '## Requirements', '## Architecture', 'Scope Boundaries']
        for (const r of required) {
          if (!content.includes(r)) {
            warnings.push(`Gate: missing section (or different heading): ${r}`)
          }
        }
        if (!/\*\*Status\*\*:\s*(pending|in_progress|completed|rejected)/i.test(content)) {
          errors.push(
            'Gate Status field missing or invalid (expected one of pending|in_progress|completed|rejected)'
          )
        }
      } else {
        // detect mermaid, dot, or svg content
        if (!/```mermaid|digraph|graph\s+|<svg/i.test(content)) {
          errors.push('Architecture file does not appear to contain mermaid, dot, or svg content')
        }
      }

      // Note: quality checks are out of scope for this lightweight wrapper
    } catch (err) {
      errors.push(`Failed to read artifact: ${String(err)}`)
    }

    const passed = errors.length === 0
    return {
      passed,
      errors: passed ? undefined : errors,
      warnings: warnings.length ? warnings : undefined,
    }
  }
}
