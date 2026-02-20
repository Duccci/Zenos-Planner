-- Proposal Dependencies Table
-- Tracks relationships between proposals (requires, blocks)
-- Enables querying proposal dependency chains and detecting circular dependencies

CREATE TABLE IF NOT EXISTS proposal_dependencies (
  id TEXT PRIMARY KEY,
  source_proposal_id TEXT NOT NULL,
  target_proposal_hash TEXT NOT NULL,
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('requires', 'blocks')),
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_proposal_id) REFERENCES proposals(id),
  UNIQUE(source_proposal_id, target_proposal_hash, dependency_type)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_proposal_deps_source ON proposal_dependencies(source_proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_deps_target ON proposal_dependencies(target_proposal_hash);
CREATE INDEX IF NOT EXISTS idx_proposal_deps_type ON proposal_dependencies(dependency_type);

-- Foreign key constraints
PRAGMA foreign_keys = ON;
