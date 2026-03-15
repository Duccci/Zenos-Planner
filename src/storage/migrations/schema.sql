-- Zeno's Planner — Canonical Schema
--
-- Single source of truth for the database schema.
-- All statements are idempotent (CREATE TABLE/INDEX IF NOT EXISTS),
-- so this file can be applied to a fresh or existing database safely.

-- ─────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gates (
  id                     TEXT      PRIMARY KEY,
  project_id             TEXT      DEFAULT 'default-project',
  sequence               INTEGER   NOT NULL,
  name                   TEXT      NOT NULL,
  description            TEXT,
  status                 TEXT      NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'validated', 'in_progress', 'completed', 'rejected')),
  type                   TEXT      NOT NULL DEFAULT 'feature'
    CHECK (type IN ('feature', 'quality', 'rescope')),
  completion_description TEXT,
  proposal_hashes        TEXT,
  depends_on             TEXT,
  hash                   TEXT      UNIQUE NOT NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at           TIMESTAMP,
  created_by             TEXT,
  completed_by           TEXT,
  prd_generated_at       TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repositories (
  id         TEXT      PRIMARY KEY,
  name       TEXT      NOT NULL,
  path       TEXT      NOT NULL,
  type       TEXT      NOT NULL
    CHECK (type IN ('main', 'service', 'library', 'tool', 'app')),
  hash       TEXT      UNIQUE NOT NULL,
  metadata   TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repo_dependencies (
  id                  TEXT      PRIMARY KEY,
  source_repo_hash    TEXT      NOT NULL REFERENCES repositories(hash),
  target_repo_hash    TEXT      NOT NULL REFERENCES repositories(hash),
  dependency_type     TEXT      NOT NULL
    CHECK (dependency_type IN ('imports', 'extends', 'references')),
  metadata            TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_repo_hash, target_repo_hash, dependency_type)
);

CREATE TABLE IF NOT EXISTS requirements (
  id                     TEXT      PRIMARY KEY,
  gate_id                TEXT      REFERENCES gates(id),
  parent_id              TEXT      REFERENCES requirements(id),
  project_requirement_id TEXT,
  type                   TEXT      NOT NULL
    CHECK (type IN ('functional', 'non_functional', 'constraint')),
  priority               TEXT      NOT NULL
    CHECK (priority IN ('must', 'should', 'could', 'wont')),
  level                  TEXT      NOT NULL DEFAULT 'gate'
    CHECK (level IN ('project', 'gate')),
  source                 TEXT      NOT NULL DEFAULT 'generated'
    CHECK (source IN ('generated', 'inherited', 'transferred')),
  description            TEXT      NOT NULL,
  acceptance_criteria    TEXT,
  hash                   TEXT      UNIQUE NOT NULL,
  source_gate_id         TEXT      REFERENCES gates(id),
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  project_id             TEXT      NOT NULL DEFAULT 'default-project'
);

CREATE TABLE IF NOT EXISTS proposals (
  id               TEXT      PRIMARY KEY,
  gate_id          TEXT      REFERENCES gates(id),
  requirement_id   TEXT      REFERENCES requirements(id),
  title            TEXT      NOT NULL,
  status           TEXT      NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'validated', 'approved', 'rejected', 'in_progress', 'completed')),
  hash             TEXT      UNIQUE NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at      TIMESTAMP,
  started_by       TEXT,
  started_at       TIMESTAMP,
  approved_by      TEXT,
  rejected_by      TEXT,
  rejected_at      TIMESTAMP,
  implemented_at   TIMESTAMP,
  parallel_set_index INTEGER
);

CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id                  INTEGER   PRIMARY KEY AUTOINCREMENT,
  gate_id             TEXT      NOT NULL REFERENCES gates(id),
  file_count          INTEGER   NOT NULL DEFAULT 0,
  total_loc           INTEGER   NOT NULL DEFAULT 0,
  code_lines          INTEGER   NOT NULL DEFAULT 0,
  blank_lines         INTEGER   NOT NULL DEFAULT 0,
  comment_lines       INTEGER   NOT NULL DEFAULT 0,
  avg_instability     REAL      NOT NULL DEFAULT 0,
  high_coupling_count INTEGER   NOT NULL DEFAULT 0,
  max_complexity      INTEGER   NOT NULL DEFAULT 0,
  avg_complexity      REAL      NOT NULL DEFAULT 0,
  graph_nodes         INTEGER   NOT NULL DEFAULT 0,
  graph_edges         INTEGER   NOT NULL DEFAULT 0,
  cycle_count         INTEGER   NOT NULL DEFAULT 0,
  max_depth           INTEGER   NOT NULL DEFAULT 0,
  scan_duration_ms    INTEGER   NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proposal_dependencies (
  id                   TEXT      PRIMARY KEY,
  source_proposal_id   TEXT      NOT NULL REFERENCES proposals(id),
  target_proposal_hash TEXT      NOT NULL,
  dependency_type      TEXT      NOT NULL
    CHECK (dependency_type IN ('requires', 'blocks')),
  description          TEXT,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_proposal_id, target_proposal_hash, dependency_type)
);

-- Cross-gate requirement reuse links (many-to-many)
CREATE TABLE IF NOT EXISTS requirement_gate_links (
  requirement_id TEXT      NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  gate_id        TEXT      NOT NULL REFERENCES gates(id)        ON DELETE CASCADE,
  linked_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (requirement_id, gate_id)
);

-- Legacy bookkeeping tables (kept for compatibility with existing databases)
CREATE TABLE IF NOT EXISTS migration_notes (
  migration_id INTEGER   PRIMARY KEY,
  note         TEXT      NOT NULL,
  applied_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS migrations (
  id         INTEGER   PRIMARY KEY,
  name       TEXT      NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_gates_created_by   ON gates(created_by);
CREATE INDEX IF NOT EXISTS idx_gates_completed_by ON gates(completed_by);

CREATE INDEX IF NOT EXISTS idx_repositories_hash ON repositories(hash);
CREATE INDEX IF NOT EXISTS idx_repositories_type ON repositories(type);

CREATE INDEX IF NOT EXISTS idx_repo_deps_source ON repo_dependencies(source_repo_hash);
CREATE INDEX IF NOT EXISTS idx_repo_deps_target ON repo_dependencies(target_repo_hash);
CREATE INDEX IF NOT EXISTS idx_repo_deps_type   ON repo_dependencies(dependency_type);

CREATE INDEX IF NOT EXISTS idx_requirements_hash        ON requirements(hash);
CREATE INDEX IF NOT EXISTS idx_requirements_parent      ON requirements(parent_id);
CREATE INDEX IF NOT EXISTS idx_requirements_type        ON requirements(type);
CREATE INDEX IF NOT EXISTS idx_requirements_priority    ON requirements(priority);
CREATE INDEX IF NOT EXISTS idx_requirements_level       ON requirements(level);
CREATE INDEX IF NOT EXISTS idx_requirements_source      ON requirements(source);
CREATE INDEX IF NOT EXISTS idx_requirements_source_gate ON requirements(source_gate_id);
CREATE INDEX IF NOT EXISTS idx_requirements_project_id  ON requirements(project_id);

CREATE INDEX IF NOT EXISTS idx_req_gate_links_gate ON requirement_gate_links(gate_id);
CREATE INDEX IF NOT EXISTS idx_req_gate_links_req  ON requirement_gate_links(requirement_id);

CREATE INDEX IF NOT EXISTS idx_proposals_hash        ON proposals(hash);
CREATE INDEX IF NOT EXISTS idx_proposals_gate_id     ON proposals(gate_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status      ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_started_by  ON proposals(started_by);
CREATE INDEX IF NOT EXISTS idx_proposals_approved_by ON proposals(approved_by);
CREATE INDEX IF NOT EXISTS idx_proposals_rejected_by ON proposals(rejected_by);

CREATE INDEX IF NOT EXISTS idx_proposal_deps_source ON proposal_dependencies(source_proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_deps_target ON proposal_dependencies(target_proposal_hash);
CREATE INDEX IF NOT EXISTS idx_proposal_deps_type   ON proposal_dependencies(dependency_type);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_gate_id ON metrics_snapshots(gate_id);
