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

-- Requirements table: Hierarchical requirements across projects
-- Organized by project, gate, and parent/child relationships
-- Database presence = approved. Implementation tracked via Git, not in database.
CREATE TABLE IF NOT EXISTS requirements (
  id TEXT PRIMARY KEY,
  project_id TEXT DEFAULT 'default-project',
  gate_id TEXT,
  parent_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('functional', 'non_functional', 'constraint')),
  priority TEXT NOT NULL CHECK (priority IN ('must', 'should', 'could', 'wont')),
  description TEXT NOT NULL,
  acceptance_criteria TEXT,
  hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES requirements(id),
  FOREIGN KEY (gate_id) REFERENCES gates(id)
);

-- Proposals table: Implementation proposals for gates
-- Tracks proposals as they move through approval workflow
-- Proposal content is stored as Markdown files; this table tracks metadata and status
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  gate_id TEXT,
  requirement_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_progress', 'completed')),
  hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  FOREIGN KEY (gate_id) REFERENCES gates(id),
  FOREIGN KEY (requirement_id) REFERENCES requirements(id)
);

-- Indexes

-- Repository queries
CREATE INDEX IF NOT EXISTS idx_repositories_hash ON repositories(hash);
CREATE INDEX IF NOT EXISTS idx_repositories_type ON repositories(type);

-- Proposal queries
CREATE INDEX IF NOT EXISTS idx_proposals_hash ON proposals(hash);
CREATE INDEX IF NOT EXISTS idx_proposals_gate_id ON proposals(gate_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

-- Requirement queries (hash-based lookups and hierarchical traversal)
CREATE INDEX IF NOT EXISTS idx_requirements_hash ON requirements(hash);
CREATE INDEX IF NOT EXISTS idx_requirements_parent ON requirements(parent_id);
CREATE INDEX IF NOT EXISTS idx_requirements_gate_id ON requirements(gate_id);
CREATE INDEX IF NOT EXISTS idx_requirements_project_id ON requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_requirements_type ON requirements(type);
CREATE INDEX IF NOT EXISTS idx_requirements_priority ON requirements(priority);

-- Foreign key constraints
PRAGMA foreign_keys = ON;

