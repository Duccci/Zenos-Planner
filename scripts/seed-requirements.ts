/**
 * Seed Requirements Database
 *
 * Populates the requirements.db with project-level and gate-level requirements
 * extracted from the completed gate PRDs (gates 01-04).
 *
 * Usage: npx tsx scripts/seed-requirements.ts
 */

import Database from 'better-sqlite3'
import path from 'node:path'
import { generateRequirementHash, detectHashCollision } from '../src/utils/hash.js'

const DB_PATH = path.join(process.cwd(), 'zeno', '.zeno', 'requirements.db')

interface RequirementSeed {
  description: string
  type: 'functional' | 'non_functional' | 'constraint'
  priority: 'must' | 'should' | 'could' | 'wont'
  level: 'project' | 'gate'
  source: 'generated' | 'inherited' | 'transferred'
  gateId?: string
  acceptanceCriteria?: string
  parentId?: string
  projectRequirementId?: string
}

interface GateSeed {
  id: string
  sequence: number
  name: string
  hash: string
  status: 'completed' | 'pending'
  type: 'feature'
  completedAt?: string
  description: string
  dependsOn?: string
}

function openDb(): Database.Database {
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

function insertGate(db: Database.Database, gate: GateSeed): void {
  const existing = db.prepare('SELECT id FROM gates WHERE id = ?').get(gate.id)
  if (existing) {
    console.log(`  Gate ${gate.id} already exists, skipping`)
    return
  }

  db.prepare(`
    INSERT INTO gates (id, project_id, sequence, name, description, status, type, hash, created_at, completed_at, depends_on)
    VALUES (?, 'default-project', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
  `).run(
    gate.id,
    gate.sequence,
    gate.name,
    gate.description,
    gate.status,
    gate.type,
    gate.hash,
    gate.completedAt ?? null,
    gate.dependsOn ?? null
  )
  console.log(`  Inserted gate ${gate.id}: ${gate.name}`)
}

function insertRequirement(
  db: Database.Database,
  seed: RequirementSeed,
  resolvedParentId?: string
): { id: string; hash: string } {
  const baseHash = generateRequirementHash({
    type: seed.type,
    priority: seed.priority,
    description: seed.description,
    acceptanceCriteria: seed.acceptanceCriteria,
  })

  const finalHash = detectHashCollision(db, baseHash, {
    type: seed.type,
    priority: seed.priority,
    description: seed.description,
    acceptanceCriteria: seed.acceptanceCriteria,
  })

  // Check if already exists
  const existing = db.prepare('SELECT id FROM requirements WHERE hash = ?').get(finalHash) as
    | { id: string }
    | undefined
  if (existing) {
    console.log(`  Requirement already exists [${finalHash.substring(0, 8)}]: ${seed.description.substring(0, 60)}...`)
    return { id: existing.id, hash: finalHash }
  }

  const id = finalHash
  const now = new Date().toISOString()
  const parentId = resolvedParentId ?? seed.parentId ?? null
  const projectReqId = seed.projectRequirementId ?? null

  db.prepare(`
    INSERT INTO requirements (
      id, gate_id, parent_id, project_requirement_id, type, priority,
      level, source, description, acceptance_criteria, hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    seed.gateId ?? null,
    parentId,
    projectReqId,
    seed.type,
    seed.priority,
    seed.level,
    seed.source,
    seed.description.trim(),
    seed.acceptanceCriteria?.trim() ?? null,
    finalHash,
    now
  )

  const label = seed.level === 'project' ? 'PRJ' : seed.gateId ?? 'GATE'
  console.log(`  [${label}] ${finalHash.substring(0, 8)}: ${seed.description.substring(0, 70)}`)
  return { id, hash: finalHash }
}

// ============================================================================
// DATA DEFINITIONS
// ============================================================================

const completedGates: GateSeed[] = [
  {
    id: 'gate-01',
    sequence: 1,
    name: 'Gate 01: Core Infrastructure',
    hash: 'g01c0re1nfra',
    status: 'completed',
    type: 'feature',
    completedAt: '2026-01-28',
    description: 'Establishes foundational infrastructure: TypeScript strict mode, CLI framework, SQLite schema, core utilities.',
  },
  {
    id: 'gate-02',
    sequence: 2,
    name: 'Gate 02: Zeno Engine & Gate Generation',
    hash: 'g02zenoeng',
    status: 'completed',
    type: 'feature',
    completedAt: '2026-01-30',
    description: 'Implements core gate decomposition, code analysis, zeno init, write-time analysis.',
    dependsOn: '["gate-01"]',
  },
  {
    id: 'gate-03',
    sequence: 3,
    name: 'Gate 03: MCP Server & LLM Tool Integration',
    hash: 'g03mcpserver',
    status: 'completed',
    type: 'feature',
    completedAt: '2026-02-04',
    description: 'MCP server with function registry, Zod schemas, tool handlers, editor integrations.',
    dependsOn: '["gate-02"]',
  },
  {
    id: 'gate-04',
    sequence: 4,
    name: 'Gate 04: Requirements & Database Layer',
    hash: 'g04reqdb01',
    status: 'completed',
    type: 'feature',
    completedAt: '2026-02-07',
    description: 'Requirements database CRUD, hash registry, dependency tracking, pattern-based extraction.',
    dependsOn: '["gate-03"]',
  },
]

// Project-level requirements (cross-cutting concerns from PROJECT_PRD.md and gate PRDs)
const projectRequirements: RequirementSeed[] = [
  // Quality requirements
  {
    description: 'Maintain 90% or higher test coverage across all modules',
    type: 'non_functional',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'Vitest coverage report shows >=90% line coverage for all src/ modules',
  },
  {
    description: 'TypeScript strict mode enabled with zero type errors',
    type: 'non_functional',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'tsc --noEmit returns zero errors with all strict flags enabled',
  },
  {
    description: 'Linting error rate below 0.01% of total lines',
    type: 'non_functional',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'ESLint reports fewer than 1 error per 10,000 lines of code',
  },
  {
    description: 'Zero known security vulnerabilities in dependencies',
    type: 'non_functional',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'npm audit reports 0 high or critical vulnerabilities',
  },
  // Architectural requirements
  {
    description: 'Use content-addressable SHA-256 hashes (16 chars) for all entity references',
    type: 'constraint',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'All requirements, gates, and proposals use deterministic 16-char hex hash identifiers',
  },
  {
    description: 'SQLite database stores requirements and repositories with no server dependency',
    type: 'constraint',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'better-sqlite3 database operates without external server process',
  },
  {
    description: 'Database presence equals approval for requirements',
    type: 'constraint',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'No status column in requirements table; presence implies approved state',
  },
  // Functional requirements
  {
    description: 'Generate iterative gates through decomposition of project end state',
    type: 'functional',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'zeno init generates gate sequence from end state description',
  },
  {
    description: 'Provide CLI interface for all Zeno operations via Commander.js',
    type: 'functional',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'All operations accessible via zeno <category> <action> command pattern',
  },
  {
    description: 'Expose all operations as MCP tools for LLM invocation',
    type: 'functional',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'MCP server registers tools for gates, requirements, proposals, and analysis',
  },
  {
    description: 'Support hierarchical requirement decomposition with parent-child relationships',
    type: 'functional',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'Requirements table supports parent_id foreign key; children queryable by parent',
  },
  {
    description: 'Track dependencies between requirements using content-addressed hashes',
    type: 'functional',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'Dependency graph built from parent-child and cross-gate references',
  },
  {
    description: 'Support requirement transfer between gates during rescope',
    type: 'functional',
    priority: 'should',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'transferRequirement updates gate_id, source, source_gate_id for requirement and descendants',
  },
  {
    description: 'Generate AGENTS.md files for AI context and tool usage guidance',
    type: 'functional',
    priority: 'must',
    level: 'project',
    source: 'generated',
    acceptanceCriteria: 'AGENTS.md generated during zeno init with project-specific instructions',
  },
]

// Gate 01 specific requirements
const gate01Requirements: RequirementSeed[] = [
  {
    description: 'Set up TypeScript project with strict mode, ESLint, and Prettier configured',
    type: 'non_functional',
    priority: 'must',
    level: 'gate',
    source: 'inherited',
    gateId: 'gate-01',
    acceptanceCriteria: 'tsconfig.json strict: true, ESLint config present, Prettier config present',
  },
  {
    description: 'Configure Vitest test framework with coverage thresholds',
    type: 'non_functional',
    priority: 'must',
    level: 'gate',
    source: 'inherited',
    gateId: 'gate-01',
    acceptanceCriteria: 'vitest.config.ts with coverage reporting and 90% threshold',
  },
  {
    description: 'Implement CLI framework skeleton using Commander.js with extensible command structure',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-01',
    acceptanceCriteria: 'Commander.js program with nested command categories and help system',
  },
  {
    description: 'Create SQLite database with complete schema and migration system',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-01',
    acceptanceCriteria: 'Database initialization creates all tables; migrations run in order',
  },
  {
    description: 'Implement file system utilities with atomic write pattern',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-01',
    acceptanceCriteria: 'readFile, writeFile, ensureDir, fileExists functions with atomic writes',
  },
  {
    description: 'Implement SHA-256 hash utilities for content-addressable storage',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-01',
    acceptanceCriteria: 'fullHash, shortHash (16 chars), hashObject, hashFile functions',
  },
  {
    description: 'Implement configuration management via .zeno/config.json with Zod validation',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-01',
    acceptanceCriteria: 'loadConfig, saveConfig with Zod schema validation',
  },
  {
    description: 'Implement git integration utilities using simple-git wrapper',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-01',
    acceptanceCriteria: 'isGitRepo, getStatus, commit, createTag functions',
  },
  {
    description: 'Create project structure scaffolding for .zeno directory layout',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-01',
    acceptanceCriteria: 'createProjectStructure creates .zeno directory tree idempotently',
  },
  {
    description: 'Implement logging system with configurable levels',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-01',
    acceptanceCriteria: 'Logger with debug, info, warn, error methods using chalk colors',
  },
  {
    description: 'Implement typed error hierarchy with ZenoError base class',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-01',
    acceptanceCriteria: 'ZenoError, FileSystemError, DatabaseError, HashError classes with error codes',
  },
]

// Gate 02 specific requirements
const gate02Requirements: RequirementSeed[] = [
  {
    description: 'Implement iterative gate generation algorithm that decomposes end state into milestones',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-02',
    acceptanceCriteria: 'generateGates produces sequenced gates from end state description',
  },
  {
    description: 'Build zeno init command with interactive prompts for project initialization',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-02',
    acceptanceCriteria: 'zeno init prompts for project name, end state, codebase path; creates project structure',
  },
  {
    description: 'Create code analyzer using AST parsing for existing codebase analysis',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-02',
    acceptanceCriteria: 'Code analyzer parses JS/TS files using @babel/parser, extracts dependencies',
  },
  {
    description: 'Implement code metrics calculator for coupling, cohesion, and complexity',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-02',
    acceptanceCriteria: 'Metrics include afferent/efferent coupling, cyclomatic complexity, LOC',
  },
  {
    description: 'Implement core gate management commands: list, show, start, complete',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-02',
    acceptanceCriteria: 'zeno gates list/show/start/complete commands functional',
  },
  {
    description: 'Create gate template system for PRD markdown generation',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-02',
    acceptanceCriteria: 'Gate PRDs generated from templates with consistent structure',
  },
  {
    description: 'Build LLM integration layer for command-based interaction without API keys',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-02',
    acceptanceCriteria: 'Function signatures and invocation helpers for AI agent integration',
  },
  {
    description: 'Implement write-time analysis integration for greenfield projects on gate completion',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-02',
    acceptanceCriteria: 'Gate completion triggers incremental analysis, updates project metrics',
  },
  {
    description: 'Generate AGENTS.md for tool usage guidance during initialization',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'inherited',
    gateId: 'gate-02',
    acceptanceCriteria: 'AGENTS.md generated with project-specific AI context instructions',
  },
]

// Gate 03 specific requirements
const gate03Requirements: RequirementSeed[] = [
  {
    description: 'Implement MCP server using @modelcontextprotocol/sdk with stdio transport',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-03',
    acceptanceCriteria: 'MCP server starts via stdio, handles tool registration and request dispatch',
  },
  {
    description: 'Define Zod schemas for all MCP tool inputs and outputs',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-03',
    acceptanceCriteria: 'Complete Zod schemas for gates, requirements, proposals, repositories, analysis tools',
  },
  {
    description: 'Create centralized function registry exposing all Zeno operations',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-03',
    acceptanceCriteria: 'Function registry provides single source of truth for CLI and MCP tools',
  },
  {
    description: 'Refactor CLI commands to delegate to function registry (thin wrapper pattern)',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-03',
    acceptanceCriteria: 'CLI commands invoke function registry; no direct business logic in CLI layer',
  },
  {
    description: 'Implement all MCP tool handlers with input validation and structured responses',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-03',
    acceptanceCriteria: 'All ~20 tools across gates, requirements, proposals, analysis operational',
  },
  {
    description: 'Create editor integration configurations for VS Code, Cursor, and Windsurf',
    type: 'functional',
    priority: 'should',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-03',
    acceptanceCriteria: 'Configuration templates and setup guides for each editor',
  },
  {
    description: 'Implement MCP server health checks, diagnostics, and error logging',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-03',
    acceptanceCriteria: 'Health check endpoint, diagnostic commands, structured error logging',
  },
]

// Gate 04 specific requirements
const gate04Requirements: RequirementSeed[] = [
  {
    description: 'Implement requirement storage CRUD with content-addressed hashing and transactions',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-04',
    acceptanceCriteria: 'storeRequirement, getRequirementByHash, updateRequirement, deleteRequirement with transactions',
  },
  {
    description: 'Implement SHA-256 hash generation with collision detection and versioning',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-04',
    acceptanceCriteria: 'generateRequirementHash produces deterministic 16-char hashes; collisions get _v2 suffix',
  },
  {
    description: 'Build dependency graph utilities with cycle detection and visualization',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-04',
    acceptanceCriteria: 'DFS cycle detection, ASCII tree rendering, Mermaid diagram output',
  },
  {
    description: 'Implement pattern-based requirement extraction with confidence scoring',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-04',
    acceptanceCriteria: '13 patterns extract requirements; confidence >0.8 auto-approved, 0.5-0.8 review, <0.5 rejected',
  },
  {
    description: 'Implement gate-specific requirement generation from PRD objectives',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-04',
    acceptanceCriteria: 'generateRequirementsForGate reads PRD, extracts objectives, stores as gate-level requirements',
  },
  {
    description: 'Expose requirement operations as MCP tools via function registry',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-04',
    acceptanceCriteria: 'req_list, req_show, req_deps, req_transfer tools operational via MCP',
  },
  {
    description: 'Implement requirement transfer between gates with recursive descendant updates',
    type: 'functional',
    priority: 'must',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-04',
    acceptanceCriteria: 'transferRequirement updates gate_id, source, source_gate_id for requirement tree',
  },
  {
    description: 'Implement database cleanup utilities for WAL checkpoint and integrity validation',
    type: 'functional',
    priority: 'should',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-04',
    acceptanceCriteria: 'db cleanup, db validate, db checkpoint CLI commands operational',
  },
  {
    description: 'Track affected proposals when requirements are transferred',
    type: 'functional',
    priority: 'should',
    level: 'gate',
    source: 'generated',
    gateId: 'gate-04',
    acceptanceCriteria: 'findProposalsReferencingRequirement scans proposal files for hash references',
  },
]

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  console.log('Seeding requirements database...')
  console.log(`Database: ${DB_PATH}\n`)

  const db = openDb()

  try {
    // Step 1: Insert completed gates
    console.log('--- Inserting completed gates ---')
    for (const gate of completedGates) {
      insertGate(db, gate)
    }
    console.log()

    // Step 2: Insert project-level requirements
    console.log('--- Inserting project-level requirements ---')
    const projectReqIds = new Map<string, string>()
    for (const req of projectRequirements) {
      const result = insertRequirement(db, req)
      // Store mapping from description fragment to id for parent linking
      projectReqIds.set(req.description.substring(0, 40), result.id)
    }
    console.log()

    // Step 3: Insert gate-01 requirements
    console.log('--- Inserting gate-01 requirements ---')
    for (const req of gate01Requirements) {
      insertRequirement(db, req)
    }
    console.log()

    // Step 4: Insert gate-02 requirements
    console.log('--- Inserting gate-02 requirements ---')
    for (const req of gate02Requirements) {
      insertRequirement(db, req)
    }
    console.log()

    // Step 5: Insert gate-03 requirements
    console.log('--- Inserting gate-03 requirements ---')
    for (const req of gate03Requirements) {
      insertRequirement(db, req)
    }
    console.log()

    // Step 6: Insert gate-04 requirements
    console.log('--- Inserting gate-04 requirements ---')
    for (const req of gate04Requirements) {
      insertRequirement(db, req)
    }
    console.log()

    // Summary
    const reqCount = (db.prepare('SELECT COUNT(*) as count FROM requirements').get() as { count: number }).count
    const gateCount = (db.prepare('SELECT COUNT(*) as count FROM gates').get() as { count: number }).count
    const projectCount = (
      db.prepare("SELECT COUNT(*) as count FROM requirements WHERE level = 'project'").get() as { count: number }
    ).count
    const gateReqCount = (
      db.prepare("SELECT COUNT(*) as count FROM requirements WHERE level = 'gate'").get() as { count: number }
    ).count

    console.log('=== Summary ===')
    console.log(`Gates:                ${gateCount}`)
    console.log(`Total Requirements:   ${reqCount}`)
    console.log(`  Project-level:      ${projectCount}`)
    console.log(`  Gate-level:         ${gateReqCount}`)

    // Integrity check
    const integrity = db.pragma('integrity_check') as { integrity_check: string }[]
    const fkCheck = db.pragma('foreign_key_check') as unknown[]
    console.log(`\nIntegrity:   ${integrity[0]?.integrity_check ?? 'unknown'}`)
    console.log(`FK Errors:   ${fkCheck.length}`)

    console.log('\nDone.')
  } finally {
    db.close()
  }
}

main()
