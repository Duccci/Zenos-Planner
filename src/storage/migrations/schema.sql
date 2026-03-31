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
  completion_description TEXT,
  proposal_hashes        TEXT,
  depends_on             TEXT,
  hash                   TEXT      UNIQUE NOT NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at           TIMESTAMP,
  archived_at            TIMESTAMP,
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

CREATE TABLE IF NOT EXISTS requirements (
  id                     TEXT      PRIMARY KEY,
  gate_id                TEXT      REFERENCES gates(id),
  parent_id              TEXT      REFERENCES requirements(id),

  type                   TEXT      NOT NULL
    CHECK (type IN ('functional', 'non_functional', 'constraint')),
  priority               TEXT      NOT NULL
    CHECK (priority IN ('must', 'should', 'could', 'wont')),
  level                  TEXT      NOT NULL DEFAULT 'gate'
    CHECK (level IN ('project', 'gate')),
  source                 TEXT      NOT NULL DEFAULT 'generated'
    CHECK (source IN ('generated', 'inherited', 'transferred', 'defined', 'manual')),
  description            TEXT      NOT NULL,
  acceptance_criteria    TEXT,
  hash                   TEXT      UNIQUE NOT NULL,
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

-- Unified dependency map: tracks which gates and proposals depend on what.
-- Replaces the former proposal_dependencies and gate_dependencies tables.
-- source_type/source_id: the entity that declares the dependency.
-- target_type/target_hash: the entity being depended on (by content-addressable hash).
-- dependency_type: 'requires' (must complete first), 'blocks' (prevents progress), 'relates_to' (informational).
CREATE TABLE IF NOT EXISTS dependency_map (
  id              TEXT      PRIMARY KEY,
  source_type     TEXT      NOT NULL
    CHECK (source_type IN ('gate', 'proposal', 'requirement')),
  source_id       TEXT      NOT NULL,
  target_type     TEXT      NOT NULL
    CHECK (target_type IN ('gate', 'proposal', 'requirement')),
  target_hash     TEXT      NOT NULL,
  dependency_type TEXT      NOT NULL
    CHECK (dependency_type IN ('requires', 'blocks', 'relates_to')),
  description     TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_type, source_id, target_type, target_hash, dependency_type)
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_gates_created_by   ON gates(created_by);
CREATE INDEX IF NOT EXISTS idx_gates_completed_by ON gates(completed_by);

CREATE INDEX IF NOT EXISTS idx_repositories_hash ON repositories(hash);
CREATE INDEX IF NOT EXISTS idx_repositories_type ON repositories(type);

CREATE INDEX IF NOT EXISTS idx_requirements_hash        ON requirements(hash);
CREATE INDEX IF NOT EXISTS idx_requirements_parent      ON requirements(parent_id);
CREATE INDEX IF NOT EXISTS idx_requirements_type        ON requirements(type);
CREATE INDEX IF NOT EXISTS idx_requirements_priority    ON requirements(priority);
CREATE INDEX IF NOT EXISTS idx_requirements_level       ON requirements(level);
CREATE INDEX IF NOT EXISTS idx_requirements_source      ON requirements(source);
CREATE INDEX IF NOT EXISTS idx_requirements_project_id  ON requirements(project_id);

CREATE INDEX IF NOT EXISTS idx_dep_map_source      ON dependency_map(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_dep_map_target      ON dependency_map(target_type, target_hash);
CREATE INDEX IF NOT EXISTS idx_dep_map_type        ON dependency_map(dependency_type);

CREATE INDEX IF NOT EXISTS idx_proposals_hash        ON proposals(hash);
CREATE INDEX IF NOT EXISTS idx_proposals_gate_id     ON proposals(gate_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status      ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_started_by  ON proposals(started_by);
CREATE INDEX IF NOT EXISTS idx_proposals_approved_by ON proposals(approved_by);
CREATE INDEX IF NOT EXISTS idx_proposals_rejected_by ON proposals(rejected_by);
