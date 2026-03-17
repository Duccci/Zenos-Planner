/**
 * Configuration Tool Schemas
 *
 * Zod schemas for configuration-related MCP tool inputs and outputs.
 */

import { z } from 'zod'

/**
 * Schema for config_get output
 * Returns project configuration including quality thresholds, git settings, and version
 */
export const ConfigGetOutputSchema = z.object({
  /** Project name */
  projectName: z.string(),

  /** Project statement describing what is being built */
  projectStatement: z.string().optional(),

  /** Project version (semver format) */
  version: z.string(),

  /** Quality thresholds for validation */
  qualityThresholds: z.object({
    /** Code coverage percentage (0-100) */
    codeCoverage: z.number().min(0).max(100),
    /** Maximum allowed security vulnerabilities */
    securityVulnerabilities: z.number().min(0),
    /** Maximum linting error rate (0-1) */
    lintingErrorRate: z.number().min(0),
    /** Maximum type checking errors */
    typeCheckingErrors: z.number().min(0),
  }),

  /** Hash algorithm and length settings */
  hashAlgorithm: z.string(),
  hashLength: z.number().int().positive(),

  /** Git integration settings */
  git: z
    .object({
      /** Auto-commit on gate/proposal completion */
      autoCommit: z.boolean(),
      /** Auto-tag on completion */
      autoTag: z.boolean(),
      /** Auto-push to remote */
      autoPush: z.boolean(),
      /** Remote repository name */
      remote: z.string(),
      /** Commit message format */
      commitFormat: z.string(),
    })
    .optional(),

  /** Project versioning settings */
  versioning: z
    .object({
      /** Whether versioning is enabled */
      enabled: z.boolean(),
      /** Semver component to bump on proposal completion */
      proposalBump: z.enum(['patch', 'minor', 'major']),
      /** Semver component to bump on gate completion */
      gateBump: z.enum(['patch', 'minor', 'major']),
      /** Semver component to bump on lifecycle completion */
      lifecycleBump: z.enum(['patch', 'minor', 'major']),
    })
    .optional(),
})

export type ConfigGetOutput = z.infer<typeof ConfigGetOutputSchema>
