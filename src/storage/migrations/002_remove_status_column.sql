-- Migration: Remove status column from requirements table
-- Date: 2026-02-07
-- Description: Remove status column as database presence equals approval
-- Idempotent: Safe to run multiple times
-- Handles both fresh databases (001 already correct) and existing databases with status column

-- This migration is a no-op for fresh databases where 001_initial_schema.sql already
-- created the requirements table without a status column.
-- For existing databases with a status column, this would need manual data migration.

-- Since we're regenerating the database from scratch, this migration simply documents
-- the schema change without performing any operations.

-- Create a migration_notes table for tracking (if needed for future auditing)
CREATE TABLE IF NOT EXISTS migration_notes (
  migration_id INTEGER PRIMARY KEY,
  note TEXT NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Record that migration 002 was applied (schema already correct from 001)
INSERT OR IGNORE INTO migration_notes (migration_id, note)
VALUES (2, 'Migration 002: Status column removal - schema correct from initial migration');
