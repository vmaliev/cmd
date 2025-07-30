-- Advanced Role and Permission Management Schema
-- This extends the existing RBAC system with custom roles and granular permissions

-- Custom Roles table for user-defined roles
CREATE TABLE IF NOT EXISTS custom_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name VARCHAR(100) NOT NULL UNIQUE,
    role_description TEXT,
    is_system_role BOOLEAN DEFAULT 0, -- System roles cannot be deleted
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Permissions table for granular permissions
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    permission_name VARCHAR(100) NOT NULL UNIQUE,
    permission_description TEXT,
    resource_type VARCHAR(50) NOT NULL, -- users, tickets, assets, etc.
    action_type VARCHAR(50) NOT NULL, -- create, read, update, delete, etc.
    is_system_permission BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Role Permissions mapping table
CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted_by INTEGER,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES custom_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(role_id, permission_id)
);

-- User Role Assignments table
CREATE TABLE IF NOT EXISTS user_role_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    assigned_by INTEGER,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES custom_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id, role_id)
);

-- Permission Inheritance table for role hierarchy
CREATE TABLE IF NOT EXISTS role_inheritance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_role_id INTEGER NOT NULL,
    parent_role_id INTEGER NOT NULL,
    inheritance_level INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_role_id) REFERENCES custom_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_role_id) REFERENCES custom_roles(id) ON DELETE CASCADE,
    UNIQUE(child_role_id, parent_role_id)
);

-- Permission Audit Log for tracking permission changes
CREATE TABLE IF NOT EXISTS permission_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- grant, revoke, create_role, delete_role, etc.
    target_type VARCHAR(50) NOT NULL, -- role, permission, user, etc.
    target_id INTEGER,
    target_name VARCHAR(100),
    details TEXT, -- JSON string for additional details
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(role_name);
CREATE INDEX IF NOT EXISTS idx_custom_roles_active ON custom_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(permission_name);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource_type);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role ON user_role_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_role_inheritance_child ON role_inheritance(child_role_id);
CREATE INDEX IF NOT EXISTS idx_role_inheritance_parent ON role_inheritance(parent_role_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_user ON permission_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_created ON permission_audit_log(created_at);

-- Insert default system roles
INSERT OR IGNORE INTO custom_roles (role_name, role_description, is_system_role) VALUES
('admin', 'System Administrator with full access', 1),
('manager', 'Manager with elevated permissions', 1),
('support', 'Support staff with ticket management access', 1),
('client', 'Client with limited access to their own data', 1);

-- Insert default permissions
INSERT OR IGNORE INTO permissions (permission_name, permission_description, resource_type, action_type, is_system_permission) VALUES
-- User Management Permissions
('users.create', 'Create new users', 'users', 'create', 1),
('users.read', 'View user information', 'users', 'read', 1),
('users.update', 'Update user information', 'users', 'update', 1),
('users.delete', 'Delete users', 'users', 'delete', 1),
('users.manage_roles', 'Assign and manage user roles', 'users', 'manage_roles', 1),

-- Ticket Management Permissions
('tickets.create', 'Create new tickets', 'tickets', 'create', 1),
('tickets.read', 'View tickets', 'tickets', 'read', 1),
('tickets.update', 'Update tickets', 'tickets', 'update', 1),
('tickets.delete', 'Delete tickets', 'tickets', 'delete', 1),
('tickets.assign', 'Assign tickets to users', 'tickets', 'assign', 1),
('tickets.close', 'Close tickets', 'tickets', 'close', 1),

-- Asset Management Permissions
('assets.create', 'Create new assets', 'assets', 'create', 1),
('assets.read', 'View assets', 'assets', 'read', 1),
('assets.update', 'Update assets', 'assets', 'update', 1),
('assets.delete', 'Delete assets', 'assets', 'delete', 1),
('assets.assign', 'Assign assets to users', 'assets', 'assign', 1),

-- System Management Permissions
('system.settings', 'Manage system settings', 'system', 'settings', 1),
('system.logs', 'View system logs', 'system', 'logs', 1),
('system.backup', 'Create and manage backups', 'system', 'backup', 1),
('system.users', 'Manage user accounts', 'system', 'users', 1),

-- Role Management Permissions
('roles.create', 'Create new roles', 'roles', 'create', 1),
('roles.read', 'View roles', 'roles', 'read', 1),
('roles.update', 'Update roles', 'roles', 'update', 1),
('roles.delete', 'Delete roles', 'roles', 'delete', 1),
('roles.assign', 'Assign roles to users', 'roles', 'assign', 1),

-- Permission Management Permissions
('permissions.grant', 'Grant permissions to roles', 'permissions', 'grant', 1),
('permissions.revoke', 'Revoke permissions from roles', 'permissions', 'revoke', 1),
('permissions.read', 'View permissions', 'permissions', 'read', 1),

-- Profile Management Permissions
('profiles.read', 'View user profiles', 'profiles', 'read', 1),
('profiles.update', 'Update user profiles', 'profiles', 'update', 1),
('profiles.manage_privacy', 'Manage profile privacy settings', 'profiles', 'manage_privacy', 1),

-- Analytics and Reporting Permissions
('analytics.view', 'View analytics and reports', 'analytics', 'view', 1),
('analytics.export', 'Export reports', 'analytics', 'export', 1),
('analytics.manage', 'Manage analytics settings', 'analytics', 'manage', 1);

-- Assign default permissions to system roles
-- Admin role gets all permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    cr.id as role_id,
    p.id as permission_id
FROM custom_roles cr
CROSS JOIN permissions p
WHERE cr.role_name = 'admin';

-- Manager role gets most permissions except system management
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    cr.id as role_id,
    p.id as permission_id
FROM custom_roles cr
JOIN permissions p ON p.resource_type != 'system' OR p.action_type = 'read'
WHERE cr.role_name = 'manager';

-- Support role gets ticket and asset management permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    cr.id as role_id,
    p.id as permission_id
FROM custom_roles cr
JOIN permissions p ON p.resource_type IN ('tickets', 'assets') OR 
                     (p.resource_type = 'users' AND p.action_type = 'read')
WHERE cr.role_name = 'support';

-- Client role gets limited permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    cr.id as role_id,
    p.id as permission_id
FROM custom_roles cr
JOIN permissions p ON (p.resource_type = 'tickets' AND p.action_type IN ('create', 'read', 'update')) OR
                     (p.resource_type = 'assets' AND p.action_type = 'read') OR
                     (p.resource_type = 'profiles' AND p.action_type IN ('read', 'update'))
WHERE cr.role_name = 'client';

-- Assign default roles to existing users based on their current role
INSERT OR IGNORE INTO user_role_assignments (user_id, role_id)
SELECT 
    u.id as user_id,
    cr.id as role_id
FROM users u
JOIN custom_roles cr ON cr.role_name = u.role
WHERE u.role IS NOT NULL; 