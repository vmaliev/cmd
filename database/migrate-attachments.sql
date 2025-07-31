-- Migration: Add json_ticket_id column to ticket_attachments table
-- This allows storing attachments for JSON-based tickets with string IDs

-- Add json_ticket_id column for string ticket IDs
ALTER TABLE ticket_attachments ADD COLUMN json_ticket_id TEXT;

-- Create index for json_ticket_id queries
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_json_ticket_id ON ticket_attachments(json_ticket_id);

-- Update the foreign key constraint to be optional (allow NULL for json_ticket_id)
-- Note: SQLite doesn't support dropping foreign keys, so we'll work around this
-- The existing constraint will remain but we'll handle it in the application layer 