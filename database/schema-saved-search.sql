-- Saved Search Filters Schema
-- SQLite database schema for advanced filtering and search functionality

-- Saved Search Filters table - stores user-defined search filters
CREATE TABLE IF NOT EXISTS saved_search_filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    filters TEXT NOT NULL, -- JSON string containing filter criteria
    is_public BOOLEAN DEFAULT 0, -- Whether the filter is public or private
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_saved_search_filters_user_id ON saved_search_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_search_filters_is_public ON saved_search_filters(is_public);
CREATE INDEX IF NOT EXISTS idx_saved_search_filters_created_at ON saved_search_filters(created_at);

-- Insert some default saved search filters for demonstration
INSERT OR IGNORE INTO saved_search_filters (user_id, name, description, filters, is_public) VALUES
(1, 'My Open Tickets', 'All tickets assigned to me that are still open', '{"assignee": "admin@example.com", "status": ["open", "in-progress"]}', 0),
(1, 'High Priority Issues', 'All high and critical priority tickets', '{"priority": ["high", "critical"]}', 1),
(1, 'Unassigned Tickets', 'All tickets that have not been assigned to anyone', '{"assignee": "unassigned"}', 1),
(1, 'Recently Updated', 'Tickets updated in the last 7 days', '{"updatedAfter": "2025-07-24"}', 1),
(1, 'Resolved This Week', 'Tickets resolved in the last 7 days', '{"status": "resolved", "resolvedAfter": "2025-07-24"}', 1); 