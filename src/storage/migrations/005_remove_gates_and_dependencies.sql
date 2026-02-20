-- Migration: Formalize Scope Reduction - Remove gates and proposal_dependencies Tables
-- Date: 2026-02-18
-- Rationale: Gates data is stored in project-overview.json (version-controlled, human-readable).
--           Proposal dependencies are derived from proposal references, not a source of truth.
--           Keeping these in the database duplicates file-based storage and violates minimalist design.
-- 
-- DECISION: Gates remain in project-overview.json (file-based, version-controlled).
--          Only proposals table in database (optimized for hash-based lookups in operational commands).
--          Requirements and repositories tables support queryable hierarchies.
--
-- This migration documents the schema consolidation. For fresh databases, 
-- 001_initial_schema.sql should exclude gates and proposal_dependencies tables.
--          For existing databases with these tables, they are simply deprecated 
--          and can be manually dropped if needed during maintenance.

-- Record migration in notes table (if it exists)
INSERT OR IGNORE INTO migration_notes (migration_id, note)
VALUES (5, 'Migration 005: Formalized scope reduction - gates and proposal_dependencies tables deprecated, data in project-overview.json and derived from proposals');

-- No schema changes in this migration; it documents a logical consolidation
-- Consuming code should ignore these tables and use project-overview.json and proposals table instead
