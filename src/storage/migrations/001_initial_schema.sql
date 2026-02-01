-- Zeno Initial Schema Migration
-- Creates all tables, indexes, and constraints for Zeno's Planner
-- Note: Gate metadata and state history are stored in project-overview.json and Git
-- Proposals are stored as Markdown files in zeno/proposals/

-- Gates table: Project milestones and deliverables
CREATE TABLE IF NOT EXISTS gates (
  id TEXT PRIMARY KEY,
  project_id TEXT DEFAULT 'default-project',
  sequence INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  type TEXT NOT NULL DEFAULT 'feature' CHECK (type IN ('feature', 'quality', 'rescope')),
  completion_description TEXT,
  proposal_hashes TEXT,
  depends_on TEXT,
  hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Repositories table: Repository boundaries and metadata for multi-repo support
CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('main', 'service', 'library', 'tool')),
  hash TEXT UNIQUE NOT NULL,
  metadata TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Requirements table: Hierarchical requirements and project specifications
-- Unified format for both traditional requirements and spec-driven development
-- Content can be requirement descriptions, acceptance criteria, or full specifications
-- Presence in database = approved (changes only via gate/proposal refactors)
CREATE TABLE IF NOT EXISTS requirements (
  id TEXT PRIMARY KEY,
  gate_id TEXT,
  parent_id TEXT,
  project_requirement_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('functional', 'non_functional', 'constraint')),
  priority TEXT NOT NULL CHECK (priority IN ('must', 'should', 'could', 'wont')),
  level TEXT NOT NULL CHECK (level IN ('project', 'gate')),
  source TEXT NOT NULL CHECK (source IN ('generated', 'inherited', 'transferred')),
  description TEXT NOT NULL,
  acceptance_criteria TEXT,
  hash TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'implemented', 'tested')),
  source_gate_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES requirements(id)
);

-- Index for requirement status (used by status queries and filters)
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);

-- Indexes

-- Repository queries
CREATE INDEX IF NOT EXISTS idx_repositories_hash ON repositories(hash);
CREATE INDEX IF NOT EXISTS idx_repositories_type ON repositories(type);

-- Requirement queries (hash-based lookups and hierarchical traversal)
CREATE INDEX IF NOT EXISTS idx_requirements_hash ON requirements(hash);
CREATE INDEX IF NOT EXISTS idx_requirements_parent ON requirements(parent_id);
CREATE INDEX IF NOT EXISTS idx_requirements_level ON requirements(level);
CREATE INDEX IF NOT EXISTS idx_requirements_source ON requirements(source);
CREATE INDEX IF NOT EXISTS idx_requirements_type ON requirements(type);
CREATE INDEX IF NOT EXISTS idx_requirements_priority ON requirements(priority);

-- Foreign key constraints
PRAGMA foreign_keys = ON;

