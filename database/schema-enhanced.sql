-- Enhanced IT Management System Database Schema
-- SQLite database schema with JWT tokens, password auth, and RBAC

-- Enhanced Users table with password authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT, -- For password-based authentication
    role TEXT DEFAULT 'client' CHECK (role IN ('admin', 'client', 'support', 'manager')),
    department TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_verified BOOLEAN DEFAULT 0, -- Email verification status
    email_verification_token TEXT, -- For email verification
    password_reset_token TEXT, -- For password reset
    password_reset_expires DATETIME,
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until DATETIME,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- JWT Refresh Tokens table
CREATE TABLE IF NOT EXISTS jwt_refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    refresh_token TEXT UNIQUE NOT NULL,
    device_id TEXT,
    device_info TEXT, -- JSON string with device information
    is_revoked BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User sessions for backward compatibility (OTP-based auth)
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    device_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Admin sessions for admin authentication (backward compatibility)
CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);

-- OTP store for email authentication (backward compatibility)
CREATE TABLE IF NOT EXISTS otp_store (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);

-- Authentication audit log
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT NOT NULL,
    action TEXT NOT NULL, -- 'login', 'logout', 'password_reset', 'failed_login', 'account_locked'
    ip_address TEXT,
    user_agent TEXT,
    device_id TEXT,
    success BOOLEAN DEFAULT 0,
    details TEXT, -- JSON string with additional details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- User permissions table for fine-grained access control
CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    resource TEXT NOT NULL, -- 'tickets', 'assets', 'users', 'kb', etc.
    action TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'assign', etc.
    granted BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, resource, action)
);

-- Role permissions table for role-based permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    granted BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, resource, action)
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
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_otp_store_email ON otp_store(email);
CREATE INDEX IF NOT EXISTS idx_jwt_refresh_tokens_token ON jwt_refresh_tokens(refresh_token);
CREATE INDEX IF NOT EXISTS idx_jwt_refresh_tokens_user_id ON jwt_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_email ON auth_audit_log(email);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON auth_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
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

-- Insert default role permissions
INSERT OR IGNORE INTO role_permissions (role, resource, action) VALUES 
-- Admin permissions (full access)
('admin', 'tickets', 'create'),
('admin', 'tickets', 'read'),
('admin', 'tickets', 'update'),
('admin', 'tickets', 'delete'),
('admin', 'tickets', 'assign'),
('admin', 'assets', 'create'),
('admin', 'assets', 'read'),
('admin', 'assets', 'update'),
('admin', 'assets', 'delete'),
('admin', 'assets', 'assign'),
('admin', 'users', 'create'),
('admin', 'users', 'read'),
('admin', 'users', 'update'),
('admin', 'users', 'delete'),
('admin', 'kb', 'create'),
('admin', 'kb', 'read'),
('admin', 'kb', 'update'),
('admin', 'kb', 'delete'),
('admin', 'kb', 'publish'),

-- Manager permissions
('manager', 'tickets', 'create'),
('manager', 'tickets', 'read'),
('manager', 'tickets', 'update'),
('manager', 'tickets', 'assign'),
('manager', 'assets', 'create'),
('manager', 'assets', 'read'),
('manager', 'assets', 'update'),
('manager', 'assets', 'assign'),
('manager', 'users', 'read'),
('manager', 'kb', 'create'),
('manager', 'kb', 'read'),
('manager', 'kb', 'update'),

-- Support permissions
('support', 'tickets', 'create'),
('support', 'tickets', 'read'),
('support', 'tickets', 'update'),
('support', 'assets', 'read'),
('support', 'assets', 'update'),
('support', 'kb', 'read'),

-- Client permissions
('client', 'tickets', 'create'),
('client', 'tickets', 'read'),
('client', 'assets', 'read');

-- Create default admin user (password will be set during initialization)
INSERT OR IGNORE INTO users (email, name, role, is_active, is_verified) VALUES 
('admin@system.local', 'System Administrator', 'admin', 1, 1); 