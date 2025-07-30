-- IT Management System Database Schema
-- SQLite database schema for migrating from JSON storage

-- Users table for authentication and user management
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'technician', 'user')),
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT 1
);

-- User sessions for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    device_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Admin sessions for admin authentication
CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);

-- OTP store for email authentication
CREATE TABLE IF NOT EXISTS otp_store (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);

-- Ticket categories
CREATE TABLE IF NOT EXISTS ticket_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ticket priorities
CREATE TABLE IF NOT EXISTS ticket_priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    sla_hours INTEGER NOT NULL,
    color TEXT DEFAULT '#007bff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ticket statuses
CREATE TABLE IF NOT EXISTS ticket_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6c757d',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Main tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT UNIQUE NOT NULL, -- e.g., TKT-001
    subject TEXT NOT NULL,
    description TEXT,
    requester_id INTEGER NOT NULL,
    assignee_id INTEGER,
    category_id INTEGER,
    priority_id INTEGER,
    status_id INTEGER,
    email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (requester_id) REFERENCES users(id),
    FOREIGN KEY (assignee_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES ticket_categories(id),
    FOREIGN KEY (priority_id) REFERENCES ticket_priorities(id),
    FOREIGN KEY (status_id) REFERENCES ticket_statuses(id)
);

-- Ticket timeline entries
CREATE TABLE IF NOT EXISTS ticket_timeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    author_type TEXT DEFAULT 'agent' CHECK (author_type IN ('system', 'agent', 'user')),
    content TEXT NOT NULL,
    entry_type TEXT DEFAULT 'note' CHECK (entry_type IN ('greeting', 'priority-info', 'creation', 'status-change', 'note', 'resolution')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- Asset types
CREATE TABLE IF NOT EXISTS asset_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Asset statuses
CREATE TABLE IF NOT EXISTS asset_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6c757d',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Main assets table
CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_no TEXT UNIQUE NOT NULL,
    asset_tag TEXT,
    type_id INTEGER,
    brand TEXT,
    model TEXT,
    serial_number TEXT,
    imei TEXT,
    hostname TEXT,
    current_user_id INTEGER,
    department TEXT,
    status_id INTEGER,
    purchase_date DATE,
    warranty_end_date DATE,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (type_id) REFERENCES asset_types(id),
    FOREIGN KEY (current_user_id) REFERENCES users(id),
    FOREIGN KEY (status_id) REFERENCES asset_statuses(id)
);

-- Asset history for tracking ownership changes
CREATE TABLE IF NOT EXISTS asset_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    user_id INTEGER,
    action TEXT NOT NULL, -- 'assigned', 'returned', 'maintenance', 'retired'
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Knowledge base categories
CREATE TABLE IF NOT EXISTS kb_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES kb_categories(id)
);

-- Knowledge base articles
CREATE TABLE IF NOT EXISTS kb_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category_id INTEGER,
    author_id INTEGER,
    tags TEXT, -- JSON array of tags
    is_published BOOLEAN DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES kb_categories(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT NOT NULL, -- 'email', 'in_app', 'sms'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_timeline_ticket_id ON ticket_timeline(ticket_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_no ON assets(asset_no);
CREATE INDEX IF NOT EXISTS idx_assets_current_user ON assets(current_user_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_otp_store_email ON otp_store(email);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Insert default data
INSERT OR IGNORE INTO ticket_categories (name, description) VALUES 
('hardware', 'Hardware-related issues'),
('software', 'Software-related issues'),
('network', 'Network connectivity issues'),
('email', 'Email configuration issues'),
('access', 'Access and permissions issues'),
('other', 'Other issues');

INSERT OR IGNORE INTO ticket_priorities (name, description, sla_hours, color) VALUES 
('low', 'Low priority issues', 48, '#28a745'),
('medium', 'Medium priority issues', 8, '#ffc107'),
('high', 'High priority issues', 2, '#dc3545'),
('critical', 'Critical issues requiring immediate attention', 1, '#721c24');

INSERT OR IGNORE INTO ticket_statuses (name, description, color) VALUES 
('open', 'Ticket is open and awaiting assignment', '#007bff'),
('in-progress', 'Ticket is being worked on', '#ffc107'),
('pending', 'Ticket is pending user response', '#6f42c1'),
('resolved', 'Ticket has been resolved', '#28a745'),
('closed', 'Ticket has been closed', '#6c757d'),
('cancelled', 'Ticket has been cancelled', '#dc3545');

INSERT OR IGNORE INTO asset_types (name, description) VALUES 
('laptop', 'Laptop computers'),
('desktop', 'Desktop computers'),
('monitor', 'Computer monitors'),
('printer', 'Printers and scanners'),
('network', 'Network equipment'),
('mobile', 'Mobile devices'),
('software', 'Software licenses'),
('other', 'Other equipment');

INSERT OR IGNORE INTO asset_statuses (name, description, color) VALUES 
('active', 'Asset is currently in use', '#28a745'),
('inactive', 'Asset is not currently in use', '#6c757d'),
('maintenance', 'Asset is under maintenance', '#ffc107'),
('retired', 'Asset has been retired', '#dc3545'),
('lost', 'Asset has been lost or stolen', '#721c24');

-- Create default admin user
INSERT OR IGNORE INTO users (email, name, role) VALUES 
('admin@system.local', 'System Administrator', 'admin'); 