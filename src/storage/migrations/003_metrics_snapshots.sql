-- Metrics Snapshots: Lightweight aggregate metrics captured at gate archive time
-- Each row stores ~227 bytes of scalar aggregates; no per-module detail.
-- Per-module breakdowns can be recomputed from the git-tagged codebase on demand.

CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gate_id TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  total_loc INTEGER NOT NULL DEFAULT 0,
  code_lines INTEGER NOT NULL DEFAULT 0,
  blank_lines INTEGER NOT NULL DEFAULT 0,
  comment_lines INTEGER NOT NULL DEFAULT 0,
  avg_instability REAL NOT NULL DEFAULT 0,
  high_coupling_count INTEGER NOT NULL DEFAULT 0,
  max_complexity INTEGER NOT NULL DEFAULT 0,
  avg_complexity REAL NOT NULL DEFAULT 0,
  graph_nodes INTEGER NOT NULL DEFAULT 0,
  graph_edges INTEGER NOT NULL DEFAULT 0,
  cycle_count INTEGER NOT NULL DEFAULT 0,
  max_depth INTEGER NOT NULL DEFAULT 0,
  scan_duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gate_id) REFERENCES gates(id)
);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_gate_id ON metrics_snapshots(gate_id);
