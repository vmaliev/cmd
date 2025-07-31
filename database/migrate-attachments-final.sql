-- Final migration: Make ticket_id nullable and add proper constraints
-- This allows storing attachments for both database tickets (integer ID) and JSON tickets (string ID)

-- First, create a new table with the correct structure
CREATE TABLE ticket_attachments_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER,
    json_ticket_id TEXT,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    uploaded_by INTEGER NOT NULL DEFAULT 1,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT 0,
    deleted_at DATETIME,
    deleted_by INTEGER,
    CHECK ((ticket_id IS NOT NULL) OR (json_ticket_id IS NOT NULL))
);

-- Copy existing data
INSERT INTO ticket_attachments_new 
SELECT id, ticket_id, json_ticket_id, filename, original_filename, file_path, file_size, mime_type, uploaded_by, uploaded_at, is_deleted, deleted_at, deleted_by
FROM ticket_attachments;

-- Drop the old table
DROP TABLE ticket_attachments;

-- Rename the new table
ALTER TABLE ticket_attachments_new RENAME TO ticket_attachments;

-- Recreate indexes
CREATE INDEX idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
CREATE INDEX idx_ticket_attachments_json_ticket_id ON ticket_attachments(json_ticket_id);
CREATE INDEX idx_ticket_attachments_uploaded_by ON ticket_attachments(uploaded_by);
CREATE INDEX idx_ticket_attachments_is_deleted ON ticket_attachments(is_deleted); 