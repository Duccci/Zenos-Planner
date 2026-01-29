-- Zeno Initial Schema Migration
-- Creates all tables, indexes, and constraints for Zeno's Planner

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  git_email TEXT UNIQUE NOT NULL,
  git_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_state TEXT,
  end_state TEXT NOT NULL,
  current_gate_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (current_gate_id) REFERENCES gates(id)
);

-- Gates table
CREATE TABLE IF NOT EXISTS gates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  type TEXT NOT NULL CHECK (type IN ('feature', 'quality', 'rescope')),
  completion_description TEXT,
  proposal_hashes TEXT,
  depends_on TEXT,
  hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Requirements table
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
  status TEXT NOT NULL CHECK (status IN ('pending', 'implemented', 'tested')),
  source_gate_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gate_id) REFERENCES gates(id),
  FOREIGN KEY (parent_id) REFERENCES requirements(id),
  FOREIGN KEY (project_requirement_id) REFERENCES requirements(id),
  FOREIGN KEY (source_gate_id) REFERENCES gates(id)
);

-- Artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  gate_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('prd', 'architecture', 'proposal', 'test', 'agents')),
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  hash TEXT UNIQUE NOT NULL,
  content TEXT,
  metadata TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gate_id) REFERENCES gates(id)
);

-- Dependencies table
CREATE TABLE IF NOT EXISTS dependencies (
  id TEXT PRIMARY KEY,
  source_hash TEXT NOT NULL,
  source_entity_type TEXT NOT NULL CHECK (source_entity_type IN ('gate', 'requirement', 'proposal', 'artifact', 'repository')),
  target_hash TEXT NOT NULL,
  target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('gate', 'requirement', 'proposal', 'artifact', 'repository')),
  type TEXT NOT NULL CHECK (type IN ('requires', 'blocks', 'relates_to')),
  description TEXT,
  confidence_score REAL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_hash, target_hash, type)
);

-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('main', 'service', 'library', 'tool')),
  hash TEXT UNIQUE NOT NULL,
  metadata TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- RequirementRepository junction table
CREATE TABLE IF NOT EXISTS requirement_repository (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  impact_type TEXT NOT NULL CHECK (impact_type IN ('creates', 'modifies', 'depends_on')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(requirement_id, repository_id, impact_type),
  FOREIGN KEY (requirement_id) REFERENCES requirements(id),
  FOREIGN KEY (repository_id) REFERENCES repositories(id)
);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  gate_id TEXT NOT NULL,
  requirement_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  check_results TEXT,
  human_feedback TEXT,
  approved_by TEXT,
  hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  implemented_at TIMESTAMP,
  FOREIGN KEY (gate_id) REFERENCES gates(id),
  FOREIGN KEY (requirement_id) REFERENCES requirements(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- HashRegistry table
CREATE TABLE IF NOT EXISTS hash_registry (
  hash TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('gate', 'requirement', 'proposal', 'artifact', 'repository', 'user')),
  entity_id TEXT NOT NULL,
  content_preview TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- StateHistory table
CREATE TABLE IF NOT EXISTS state_history (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'gate', 'requirement', 'proposal', 'artifact', 'repository')),
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  change_source TEXT NOT NULL CHECK (change_source IN ('system', 'human', 'rescope', 'validation')),
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- Indexes

-- Hash-based lookups (primary access pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hash_registry_hash ON hash_registry(hash);

-- Gate queries
CREATE INDEX IF NOT EXISTS idx_gates_project ON gates(project_id);
CREATE INDEX IF NOT EXISTS idx_gates_status ON gates(status);
CREATE INDEX IF NOT EXISTS idx_gates_hash ON gates(hash);

-- Requirement queries
CREATE INDEX IF NOT EXISTS idx_requirements_gate ON requirements(gate_id);
CREATE INDEX IF NOT EXISTS idx_requirements_hash ON requirements(hash);
CREATE INDEX IF NOT EXISTS idx_requirements_parent ON requirements(parent_id);
CREATE INDEX IF NOT EXISTS idx_requirements_project_req ON requirements(project_requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);
CREATE INDEX IF NOT EXISTS idx_requirements_level ON requirements(level);
CREATE INDEX IF NOT EXISTS idx_requirements_source ON requirements(source);

-- Dependency graph traversal
CREATE INDEX IF NOT EXISTS idx_dependencies_source ON dependencies(source_hash);
CREATE INDEX IF NOT EXISTS idx_dependencies_target ON dependencies(target_hash);
CREATE INDEX IF NOT EXISTS idx_dependencies_source_type ON dependencies(source_entity_type);
CREATE INDEX IF NOT EXISTS idx_dependencies_target_type ON dependencies(target_entity_type);

-- Proposal queries
CREATE INDEX IF NOT EXISTS idx_proposals_gate ON proposals(gate_id);
CREATE INDEX IF NOT EXISTS idx_proposals_requirement ON proposals(requirement_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_hash ON proposals(hash);

-- Artifact queries
CREATE INDEX IF NOT EXISTS idx_artifacts_gate ON artifacts(gate_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_hash ON artifacts(hash);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);

-- Repository queries
CREATE INDEX IF NOT EXISTS idx_repositories_project ON repositories(project_id);
CREATE INDEX IF NOT EXISTS idx_repositories_hash ON repositories(hash);

-- RequirementRepository junction
CREATE INDEX IF NOT EXISTS idx_req_repo_requirement ON requirement_repository(requirement_id);
CREATE INDEX IF NOT EXISTS idx_req_repo_repository ON requirement_repository(repository_id);

-- StateHistory queries
CREATE INDEX IF NOT EXISTS idx_state_history_entity ON state_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_state_history_changed_by ON state_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_state_history_changed_at ON state_history(changed_at);

