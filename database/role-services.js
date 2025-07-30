const Database = require('better-sqlite3');
const path = require('path');

class RoleServices {
    constructor(dbPath = path.join(__dirname, 'it_support.db')) {
        this.db = new Database(dbPath);
        this.initializeRoleTables();
    }

    /**
     * Initialize role and permission tables
     */
    initializeRoleTables() {
        try {
            const fs = require('fs');
            const roleSchemaPath = path.join(__dirname, 'schema-roles-permissions.sql');
            
            if (fs.existsSync(roleSchemaPath)) {
                const schema = fs.readFileSync(roleSchemaPath, 'utf8');
                this.db.exec(schema);
                console.log('Role and permission tables initialized successfully');
            } else {
                console.warn('Role schema file not found, creating basic tables...');
                this.createBasicRoleTables();
            }
        } catch (error) {
            console.error('Error initializing role tables:', error);
            this.createBasicRoleTables();
        }
    }

    /**
     * Create basic role tables if schema file is not available
     */
    createBasicRoleTables() {
        const basicSchema = `
            CREATE TABLE IF NOT EXISTS custom_roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_name VARCHAR(100) NOT NULL UNIQUE,
                role_description TEXT,
                is_system_role BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                permission_name VARCHAR(100) NOT NULL UNIQUE,
                permission_description TEXT,
                resource_type VARCHAR(50) NOT NULL,
                action_type VARCHAR(50) NOT NULL,
                is_system_permission BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS role_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                granted_by INTEGER,
                granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(role_id, permission_id)
            );

            CREATE TABLE IF NOT EXISTS user_role_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                role_id INTEGER NOT NULL,
                assigned_by INTEGER,
                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                is_active BOOLEAN DEFAULT 1,
                UNIQUE(user_id, role_id)
            );

            CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(role_name);
            CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(permission_name);
            CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
            CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(user_id);
        `;
        
        this.db.exec(basicSchema);
    }

    // ==================== ROLE MANAGEMENT ====================

    /**
     * Get all roles
     */
    getAllRoles() {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM custom_roles 
                ORDER BY is_system_role DESC, role_name
            `);
            return stmt.all();
        } catch (error) {
            console.error('Error getting all roles:', error);
            return [];
        }
    }

    /**
     * Get active roles only
     */
    getActiveRoles() {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM custom_roles 
                WHERE is_active = 1
                ORDER BY is_system_role DESC, role_name
            `);
            return stmt.all();
        } catch (error) {
            console.error('Error getting active roles:', error);
            return [];
        }
    }

    /**
     * Get role by ID
     */
    getRoleById(roleId) {
        try {
            const stmt = this.db.prepare('SELECT * FROM custom_roles WHERE id = ?');
            return stmt.get(roleId);
        } catch (error) {
            console.error('Error getting role by ID:', error);
            return null;
        }
    }

    /**
     * Get role by name
     */
    getRoleByName(roleName) {
        try {
            const stmt = this.db.prepare('SELECT * FROM custom_roles WHERE role_name = ?');
            return stmt.get(roleName);
        } catch (error) {
            console.error('Error getting role by name:', error);
            return null;
        }
    }

    /**
     * Create new role
     */
    createRole(roleData, createdBy) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO custom_roles (role_name, role_description, created_by)
                VALUES (?, ?, ?)
            `);
            
            const result = stmt.run(roleData.role_name, roleData.role_description, createdBy);
            return this.getRoleById(result.lastInsertRowid);
        } catch (error) {
            console.error('Error creating role:', error);
            throw error;
        }
    }

    /**
     * Update role
     */
    updateRole(roleId, roleData) {
        try {
            const stmt = this.db.prepare(`
                UPDATE custom_roles 
                SET role_name = ?, role_description = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND is_system_role = 0
            `);
            
            const result = stmt.run(roleData.role_name, roleData.role_description, roleId);
            return result.changes > 0 ? this.getRoleById(roleId) : null;
        } catch (error) {
            console.error('Error updating role:', error);
            throw error;
        }
    }

    /**
     * Delete role (soft delete for system roles, hard delete for custom roles)
     */
    deleteRole(roleId) {
        try {
            const role = this.getRoleById(roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            if (role.is_system_role) {
                // Soft delete for system roles
                const stmt = this.db.prepare(`
                    UPDATE custom_roles 
                    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `);
                return stmt.run(roleId);
            } else {
                // Hard delete for custom roles
                const stmt = this.db.prepare('DELETE FROM custom_roles WHERE id = ?');
                return stmt.run(roleId);
            }
        } catch (error) {
            console.error('Error deleting role:', error);
            throw error;
        }
    }

    // ==================== PERMISSION MANAGEMENT ====================

    /**
     * Get all permissions
     */
    getAllPermissions() {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM permissions 
                ORDER BY resource_type, action_type
            `);
            return stmt.all();
        } catch (error) {
            console.error('Error getting all permissions:', error);
            return [];
        }
    }

    /**
     * Get permissions by resource type
     */
    getPermissionsByResource(resourceType) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM permissions 
                WHERE resource_type = ?
                ORDER BY action_type
            `);
            return stmt.all(resourceType);
        } catch (error) {
            console.error('Error getting permissions by resource:', error);
            return [];
        }
    }

    /**
     * Get permission by ID
     */
    getPermissionById(permissionId) {
        try {
            const stmt = this.db.prepare('SELECT * FROM permissions WHERE id = ?');
            return stmt.get(permissionId);
        } catch (error) {
            console.error('Error getting permission by ID:', error);
            return null;
        }
    }

    /**
     * Get permission by name
     */
    getPermissionByName(permissionName) {
        try {
            const stmt = this.db.prepare('SELECT * FROM permissions WHERE permission_name = ?');
            return stmt.get(permissionName);
        } catch (error) {
            console.error('Error getting permission by name:', error);
            return null;
        }
    }

    /**
     * Create new permission
     */
    createPermission(permissionData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO permissions (permission_name, permission_description, resource_type, action_type)
                VALUES (?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                permissionData.permission_name,
                permissionData.permission_description,
                permissionData.resource_type,
                permissionData.action_type
            );
            return this.getPermissionById(result.lastInsertRowid);
        } catch (error) {
            console.error('Error creating permission:', error);
            throw error;
        }
    }

    // ==================== ROLE-PERMISSION ASSIGNMENTS ====================

    /**
     * Get permissions for a role
     */
    getRolePermissions(roleId) {
        try {
            const stmt = this.db.prepare(`
                SELECT p.*, rp.granted_at, rp.granted_by
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                WHERE rp.role_id = ?
                ORDER BY p.resource_type, p.action_type
            `);
            return stmt.all(roleId);
        } catch (error) {
            console.error('Error getting role permissions:', error);
            return [];
        }
    }

    /**
     * Grant permission to role
     */
    grantPermissionToRole(roleId, permissionId, grantedBy) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted_by)
                VALUES (?, ?, ?)
            `);
            return stmt.run(roleId, permissionId, grantedBy);
        } catch (error) {
            console.error('Error granting permission to role:', error);
            throw error;
        }
    }

    /**
     * Revoke permission from role
     */
    revokePermissionFromRole(roleId, permissionId) {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM role_permissions 
                WHERE role_id = ? AND permission_id = ?
            `);
            return stmt.run(roleId, permissionId);
        } catch (error) {
            console.error('Error revoking permission from role:', error);
            throw error;
        }
    }

    /**
     * Grant multiple permissions to role
     */
    grantPermissionsToRole(roleId, permissionIds, grantedBy) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted_by)
                VALUES (?, ?, ?)
            `);
            
            const results = [];
            for (const permissionId of permissionIds) {
                results.push(stmt.run(roleId, permissionId, grantedBy));
            }
            return results;
        } catch (error) {
            console.error('Error granting multiple permissions to role:', error);
            throw error;
        }
    }

    /**
     * Revoke multiple permissions from role
     */
    revokePermissionsFromRole(roleId, permissionIds) {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM role_permissions 
                WHERE role_id = ? AND permission_id = ?
            `);
            
            const results = [];
            for (const permissionId of permissionIds) {
                results.push(stmt.run(roleId, permissionId));
            }
            return results;
        } catch (error) {
            console.error('Error revoking multiple permissions from role:', error);
            throw error;
        }
    }

    // ==================== USER-ROLE ASSIGNMENTS ====================

    /**
     * Get roles for a user
     */
    getUserRoles(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT cr.*, ura.assigned_at, ura.expires_at, ura.is_active
                FROM custom_roles cr
                JOIN user_role_assignments ura ON cr.id = ura.role_id
                WHERE ura.user_id = ? AND ura.is_active = 1
                ORDER BY cr.is_system_role DESC, cr.role_name
            `);
            return stmt.all(userId);
        } catch (error) {
            console.error('Error getting user roles:', error);
            return [];
        }
    }

    /**
     * Get users for a role
     */
    getRoleUsers(roleId) {
        try {
            const stmt = this.db.prepare(`
                SELECT u.*, ura.assigned_at, ura.expires_at, ura.is_active
                FROM users u
                JOIN user_role_assignments ura ON u.id = ura.user_id
                WHERE ura.role_id = ? AND ura.is_active = 1
                ORDER BY u.name
            `);
            return stmt.all(roleId);
        } catch (error) {
            console.error('Error getting role users:', error);
            return [];
        }
    }

    /**
     * Assign role to user
     */
    assignRoleToUser(userId, roleId, assignedBy, expiresAt = null) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO user_role_assignments (user_id, role_id, assigned_by, expires_at)
                VALUES (?, ?, ?, ?)
            `);
            return stmt.run(userId, roleId, assignedBy, expiresAt);
        } catch (error) {
            console.error('Error assigning role to user:', error);
            throw error;
        }
    }

    /**
     * Remove role from user
     */
    removeRoleFromUser(userId, roleId) {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM user_role_assignments 
                WHERE user_id = ? AND role_id = ?
            `);
            return stmt.run(userId, roleId);
        } catch (error) {
            console.error('Error removing role from user:', error);
            throw error;
        }
    }

    /**
     * Deactivate role assignment (soft delete)
     */
    deactivateRoleAssignment(userId, roleId) {
        try {
            const stmt = this.db.prepare(`
                UPDATE user_role_assignments 
                SET is_active = 0
                WHERE user_id = ? AND role_id = ?
            `);
            return stmt.run(userId, roleId);
        } catch (error) {
            console.error('Error deactivating role assignment:', error);
            throw error;
        }
    }

    // ==================== PERMISSION CHECKING ====================

    /**
     * Check if user has specific permission
     */
    userHasPermission(userId, permissionName) {
        try {
            const stmt = this.db.prepare(`
                SELECT COUNT(*) as count
                FROM user_role_assignments ura
                JOIN role_permissions rp ON ura.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ura.user_id = ? 
                AND ura.is_active = 1 
                AND p.permission_name = ?
                AND (ura.expires_at IS NULL OR ura.expires_at > datetime('now'))
            `);
            
            const result = stmt.get(userId, permissionName);
            return result.count > 0;
        } catch (error) {
            console.error('Error checking user permission:', error);
            return false;
        }
    }

    /**
     * Check if user has any permission for a resource
     */
    userHasResourcePermission(userId, resourceType, actionType = null) {
        try {
            let query = `
                SELECT COUNT(*) as count
                FROM user_role_assignments ura
                JOIN role_permissions rp ON ura.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ura.user_id = ? 
                AND ura.is_active = 1 
                AND p.resource_type = ?
                AND (ura.expires_at IS NULL OR ura.expires_at > datetime('now'))
            `;
            
            const params = [userId, resourceType];
            
            if (actionType) {
                query += ' AND p.action_type = ?';
                params.push(actionType);
            }
            
            const stmt = this.db.prepare(query);
            const result = stmt.get(...params);
            return result.count > 0;
        } catch (error) {
            console.error('Error checking user resource permission:', error);
            return false;
        }
    }

    /**
     * Get all permissions for a user
     */
    getUserPermissions(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT DISTINCT p.*
                FROM user_role_assignments ura
                JOIN role_permissions rp ON ura.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ura.user_id = ? 
                AND ura.is_active = 1 
                AND (ura.expires_at IS NULL OR ura.expires_at > datetime('now'))
                ORDER BY p.resource_type, p.action_type
            `);
            return stmt.all(userId);
        } catch (error) {
            console.error('Error getting user permissions:', error);
            return [];
        }
    }

    /**
     * Get user permissions grouped by resource
     */
    getUserPermissionsByResource(userId) {
        try {
            const permissions = this.getUserPermissions(userId);
            const grouped = {};
            
            permissions.forEach(permission => {
                if (!grouped[permission.resource_type]) {
                    grouped[permission.resource_type] = [];
                }
                grouped[permission.resource_type].push(permission);
            });
            
            return grouped;
        } catch (error) {
            console.error('Error getting user permissions by resource:', error);
            return {};
        }
    }

    // ==================== ROLE INHERITANCE ====================

    /**
     * Set role inheritance
     */
    setRoleInheritance(childRoleId, parentRoleId) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR IGNORE INTO role_inheritance (child_role_id, parent_role_id)
                VALUES (?, ?)
            `);
            return stmt.run(childRoleId, parentRoleId);
        } catch (error) {
            console.error('Error setting role inheritance:', error);
            throw error;
        }
    }

    /**
     * Remove role inheritance
     */
    removeRoleInheritance(childRoleId, parentRoleId) {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM role_inheritance 
                WHERE child_role_id = ? AND parent_role_id = ?
            `);
            return stmt.run(childRoleId, parentRoleId);
        } catch (error) {
            console.error('Error removing role inheritance:', error);
            throw error;
        }
    }

    /**
     * Get inherited permissions for a role
     */
    getInheritedPermissions(roleId) {
        try {
            const stmt = this.db.prepare(`
                SELECT DISTINCT p.*
                FROM role_inheritance ri
                JOIN role_permissions rp ON ri.parent_role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ri.child_role_id = ?
                ORDER BY p.resource_type, p.action_type
            `);
            return stmt.all(roleId);
        } catch (error) {
            console.error('Error getting inherited permissions:', error);
            return [];
        }
    }

    // ==================== AUDIT LOGGING ====================

    /**
     * Log permission action
     */
    logPermissionAction(userId, actionType, targetType, targetId, targetName, details, ipAddress, userAgent) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO permission_audit_log 
                (user_id, action_type, target_type, target_id, target_name, details, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const detailsJson = details ? JSON.stringify(details) : null;
            return stmt.run(userId, actionType, targetType, targetId, targetName, detailsJson, ipAddress, userAgent);
        } catch (error) {
            console.error('Error logging permission action:', error);
            throw error;
        }
    }

    /**
     * Get permission audit log
     */
    getPermissionAuditLog(limit = 100, offset = 0) {
        try {
            const stmt = this.db.prepare(`
                SELECT pal.*, u.name as user_name, u.email as user_email
                FROM permission_audit_log pal
                JOIN users u ON pal.user_id = u.id
                ORDER BY pal.created_at DESC
                LIMIT ? OFFSET ?
            `);
            return stmt.all(limit, offset);
        } catch (error) {
            console.error('Error getting permission audit log:', error);
            return [];
        }
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Get role statistics
     */
    getRoleStatistics() {
        try {
            const stats = {
                totalRoles: this.db.prepare('SELECT COUNT(*) as count FROM custom_roles').get().count,
                activeRoles: this.db.prepare('SELECT COUNT(*) as count FROM custom_roles WHERE is_active = 1').get().count,
                systemRoles: this.db.prepare('SELECT COUNT(*) as count FROM custom_roles WHERE is_system_role = 1').get().count,
                customRoles: this.db.prepare('SELECT COUNT(*) as count FROM custom_roles WHERE is_system_role = 0').get().count,
                totalPermissions: this.db.prepare('SELECT COUNT(*) as count FROM permissions').get().count,
                totalAssignments: this.db.prepare('SELECT COUNT(*) as count FROM user_role_assignments WHERE is_active = 1').get().count,
                rolesByUsage: this.db.prepare(`
                    SELECT cr.role_name, COUNT(ura.user_id) as user_count
                    FROM custom_roles cr
                    LEFT JOIN user_role_assignments ura ON cr.id = ura.role_id AND ura.is_active = 1
                    GROUP BY cr.id, cr.role_name
                    ORDER BY user_count DESC
                `).all()
            };
            
            return stats;
        } catch (error) {
            console.error('Error getting role statistics:', error);
            return {
                totalRoles: 0,
                activeRoles: 0,
                systemRoles: 0,
                customRoles: 0,
                totalPermissions: 0,
                totalAssignments: 0,
                rolesByUsage: []
            };
        }
    }

    /**
     * Clean up expired role assignments
     */
    cleanupExpiredAssignments() {
        try {
            const stmt = this.db.prepare(`
                UPDATE user_role_assignments 
                SET is_active = 0
                WHERE expires_at IS NOT NULL 
                AND expires_at <= datetime('now')
                AND is_active = 1
            `);
            return stmt.run();
        } catch (error) {
            console.error('Error cleaning up expired assignments:', error);
            throw error;
        }
    }

    /**
     * Get role hierarchy tree
     */
    getRoleHierarchy() {
        try {
            const roles = this.getAllRoles();
            const inheritance = this.db.prepare(`
                SELECT child_role_id, parent_role_id 
                FROM role_inheritance
            `).all();
            
            const hierarchy = {};
            roles.forEach(role => {
                hierarchy[role.id] = {
                    role: role,
                    children: [],
                    parents: []
                };
            });
            
            inheritance.forEach(rel => {
                if (hierarchy[rel.child_role_id]) {
                    hierarchy[rel.child_role_id].parents.push(rel.parent_role_id);
                }
                if (hierarchy[rel.parent_role_id]) {
                    hierarchy[rel.parent_role_id].children.push(rel.child_role_id);
                }
            });
            
            return hierarchy;
        } catch (error) {
            console.error('Error getting role hierarchy:', error);
            return {};
        }
    }
}

module.exports = RoleServices; 