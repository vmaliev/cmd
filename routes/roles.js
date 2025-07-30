const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');
const RoleServices = require('../database/role-services');

const router = express.Router();
const roleServices = new RoleServices();

// Apply rate limiting to all role management routes
router.use(generalRateLimit);

// ==================== ROLE MANAGEMENT ====================

/**
 * @route GET /api/roles
 * @desc Get all roles with optional filtering
 * @access Admin, Manager
 */
router.get('/', requireRole(['admin', 'manager']), [
  query('active').optional().isBoolean(),
  query('system').optional().isBoolean()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { active, system } = req.query;
    let roles;

    if (active !== undefined) {
      if (active === 'true') {
        roles = roleServices.getActiveRoles();
      } else {
        roles = roleServices.getAllRoles().filter(role => !role.is_active);
      }
    } else {
      roles = roleServices.getAllRoles();
    }

    if (system !== undefined) {
      roles = roles.filter(role => role.is_system_role === (system === 'true'));
    }

    res.json(roles);

  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to get roles' });
  }
});

/**
 * @route GET /api/roles/:id
 * @desc Get role by ID with permissions
 * @access Admin, Manager
 */
router.get('/:id', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);
    
    const role = roleServices.getRoleById(roleId);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const permissions = roleServices.getRolePermissions(roleId);
    const users = roleServices.getRoleUsers(roleId);
    const inheritedPermissions = roleServices.getInheritedPermissions(roleId);

    res.json({
      role,
      permissions,
      users,
      inheritedPermissions
    });

  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ error: 'Failed to get role' });
  }
});

/**
 * @route POST /api/roles
 * @desc Create new role
 * @access Admin
 */
router.post('/', requireRole(['admin']), [
  body('role_name').isLength({ min: 2, max: 100 }).matches(/^[a-zA-Z0-9_-]+$/),
  body('role_description').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { role_name, role_description } = req.body;

    // Check if role already exists
    const existingRole = roleServices.getRoleByName(role_name);
    if (existingRole) {
      return res.status(409).json({ error: 'Role with this name already exists' });
    }

    const roleData = { role_name, role_description };
    const newRole = roleServices.createRole(roleData, req.user.id);

    // Log the action
    roleServices.logPermissionAction(
      req.user.id,
      'create_role',
      'role',
      newRole.id,
      newRole.role_name,
      { roleData },
      req.ip,
      req.get('User-Agent')
    );

    res.status(201).json({
      message: 'Role created successfully',
      role: newRole
    });

  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

/**
 * @route PUT /api/roles/:id
 * @desc Update role
 * @access Admin
 */
router.put('/:id', requireRole(['admin']), [
  body('role_name').optional().isLength({ min: 2, max: 100 }).matches(/^[a-zA-Z0-9_-]+$/),
  body('role_description').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const roleId = parseInt(req.params.id);
    const roleData = req.body;

    const existingRole = roleServices.getRoleById(roleId);
    if (!existingRole) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (existingRole.is_system_role) {
      return res.status(403).json({ error: 'Cannot modify system roles' });
    }

    const updatedRole = roleServices.updateRole(roleId, roleData);
    if (!updatedRole) {
      return res.status(400).json({ error: 'Failed to update role' });
    }

    // Log the action
    roleServices.logPermissionAction(
      req.user.id,
      'update_role',
      'role',
      roleId,
      updatedRole.role_name,
      { changes: roleData },
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      message: 'Role updated successfully',
      role: updatedRole
    });

  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/**
 * @route DELETE /api/roles/:id
 * @desc Delete role
 * @access Admin
 */
router.delete('/:id', requireRole(['admin']), async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);

    const existingRole = roleServices.getRoleById(roleId);
    if (!existingRole) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (existingRole.is_system_role) {
      return res.status(403).json({ error: 'Cannot delete system roles' });
    }

    // Check if role is assigned to any users
    const roleUsers = roleServices.getRoleUsers(roleId);
    if (roleUsers.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete role that is assigned to users',
        userCount: roleUsers.length
      });
    }

    roleServices.deleteRole(roleId);

    // Log the action
    roleServices.logPermissionAction(
      req.user.id,
      'delete_role',
      'role',
      roleId,
      existingRole.role_name,
      { roleName: existingRole.role_name },
      req.ip,
      req.get('User-Agent')
    );

    res.json({ message: 'Role deleted successfully' });

  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// ==================== PERMISSION MANAGEMENT ====================

/**
 * @route GET /api/permissions
 * @desc Get all permissions with optional filtering
 * @access Admin, Manager
 */
router.get('/permissions', requireRole(['admin', 'manager']), [
  query('resource').optional().isString(),
  query('action').optional().isString()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { resource, action } = req.query;
    let permissions = roleServices.getAllPermissions();

    if (resource) {
      permissions = permissions.filter(p => p.resource_type === resource);
    }

    if (action) {
      permissions = permissions.filter(p => p.action_type === action);
    }

    res.json(permissions);

  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

/**
 * @route GET /api/permissions/resources
 * @desc Get all resource types
 * @access Admin, Manager
 */
router.get('/permissions/resources', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const permissions = roleServices.getAllPermissions();
    const resources = [...new Set(permissions.map(p => p.resource_type))];
    res.json(resources);

  } catch (error) {
    console.error('Get resource types error:', error);
    res.status(500).json({ error: 'Failed to get resource types' });
  }
});

/**
 * @route POST /api/permissions
 * @desc Create new permission
 * @access Admin
 */
router.post('/permissions', requireRole(['admin']), [
  body('permission_name').isLength({ min: 3, max: 100 }).matches(/^[a-z]+\.[a-z]+$/),
  body('permission_description').optional().isLength({ max: 500 }),
  body('resource_type').isLength({ min: 1, max: 50 }),
  body('action_type').isLength({ min: 1, max: 50 })
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const permissionData = req.body;

    // Check if permission already exists
    const existingPermission = roleServices.getPermissionByName(permissionData.permission_name);
    if (existingPermission) {
      return res.status(409).json({ error: 'Permission with this name already exists' });
    }

    const newPermission = roleServices.createPermission(permissionData);

    // Log the action
    roleServices.logPermissionAction(
      req.user.id,
      'create_permission',
      'permission',
      newPermission.id,
      newPermission.permission_name,
      { permissionData },
      req.ip,
      req.get('User-Agent')
    );

    res.status(201).json({
      message: 'Permission created successfully',
      permission: newPermission
    });

  } catch (error) {
    console.error('Create permission error:', error);
    res.status(500).json({ error: 'Failed to create permission' });
  }
});

// ==================== ROLE-PERMISSION ASSIGNMENTS ====================

/**
 * @route GET /api/roles/:id/permissions
 * @desc Get permissions for a role
 * @access Admin, Manager
 */
router.get('/:id/permissions', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);
    
    const role = roleServices.getRoleById(roleId);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const permissions = roleServices.getRolePermissions(roleId);
    res.json(permissions);

  } catch (error) {
    console.error('Get role permissions error:', error);
    res.status(500).json({ error: 'Failed to get role permissions' });
  }
});

/**
 * @route POST /api/roles/:id/permissions
 * @desc Grant permissions to role
 * @access Admin
 */
router.post('/:id/permissions', requireRole(['admin']), [
  body('permission_ids').isArray({ min: 1 }),
  body('permission_ids.*').isInt()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const roleId = parseInt(req.params.id);
    const { permission_ids } = req.body;

    const role = roleServices.getRoleById(roleId);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    roleServices.grantPermissionsToRole(roleId, permission_ids, req.user.id);

    // Log the action
    roleServices.logPermissionAction(
      req.user.id,
      'grant_permissions',
      'role',
      roleId,
      role.role_name,
      { permissionIds: permission_ids },
      req.ip,
      req.get('User-Agent')
    );

    res.json({ message: 'Permissions granted successfully' });

  } catch (error) {
    console.error('Grant permissions error:', error);
    res.status(500).json({ error: 'Failed to grant permissions' });
  }
});

/**
 * @route DELETE /api/roles/:id/permissions
 * @desc Revoke permissions from role
 * @access Admin
 */
router.delete('/:id/permissions', requireRole(['admin']), [
  body('permission_ids').isArray({ min: 1 }),
  body('permission_ids.*').isInt()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const roleId = parseInt(req.params.id);
    const { permission_ids } = req.body;

    const role = roleServices.getRoleById(roleId);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    roleServices.revokePermissionsFromRole(roleId, permission_ids);

    // Log the action
    roleServices.logPermissionAction(
      req.user.id,
      'revoke_permissions',
      'role',
      roleId,
      role.role_name,
      { permissionIds: permission_ids },
      req.ip,
      req.get('User-Agent')
    );

    res.json({ message: 'Permissions revoked successfully' });

  } catch (error) {
    console.error('Revoke permissions error:', error);
    res.status(500).json({ error: 'Failed to revoke permissions' });
  }
});

// ==================== USER-ROLE ASSIGNMENTS ====================

/**
 * @route GET /api/roles/:id/users
 * @desc Get users assigned to a role
 * @access Admin, Manager
 */
router.get('/:id/users', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);
    
    const role = roleServices.getRoleById(roleId);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const users = roleServices.getRoleUsers(roleId);
    res.json(users);

  } catch (error) {
    console.error('Get role users error:', error);
    res.status(500).json({ error: 'Failed to get role users' });
  }
});

/**
 * @route POST /api/roles/:id/users
 * @desc Assign role to users
 * @access Admin
 */
router.post('/:id/users', requireRole(['admin']), [
  body('user_ids').isArray({ min: 1 }),
  body('user_ids.*').isInt(),
  body('expires_at').optional().isISO8601()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const roleId = parseInt(req.params.id);
    const { user_ids, expires_at } = req.body;

    const role = roleServices.getRoleById(roleId);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const results = [];
    for (const userId of user_ids) {
      try {
        roleServices.assignRoleToUser(userId, roleId, req.user.id, expires_at);
        results.push({ userId, success: true });
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }

    // Log the action
    roleServices.logPermissionAction(
      req.user.id,
      'assign_role',
      'role',
      roleId,
      role.role_name,
      { userIds: user_ids, expiresAt: expires_at, results },
      req.ip,
      req.get('User-Agent')
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      message: `Role assignment completed: ${successCount} successful, ${failureCount} failed`,
      results
    });

  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

/**
 * @route DELETE /api/roles/:id/users
 * @desc Remove role from users
 * @access Admin
 */
router.delete('/:id/users', requireRole(['admin']), [
  body('user_ids').isArray({ min: 1 }),
  body('user_ids.*').isInt()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const roleId = parseInt(req.params.id);
    const { user_ids } = req.body;

    const role = roleServices.getRoleById(roleId);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const results = [];
    for (const userId of user_ids) {
      try {
        roleServices.removeRoleFromUser(userId, roleId);
        results.push({ userId, success: true });
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }

    // Log the action
    roleServices.logPermissionAction(
      req.user.id,
      'remove_role',
      'role',
      roleId,
      role.role_name,
      { userIds: user_ids, results },
      req.ip,
      req.get('User-Agent')
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      message: `Role removal completed: ${successCount} successful, ${failureCount} failed`,
      results
    });

  } catch (error) {
    console.error('Remove role error:', error);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

// ==================== PERMISSION CHECKING ====================

/**
 * @route POST /api/roles/check-permission
 * @desc Check if user has specific permission
 * @access Admin, Manager
 */
router.post('/check-permission', requireRole(['admin', 'manager']), [
  body('user_id').isInt(),
  body('permission_name').isString()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { user_id, permission_name } = req.body;

    const hasPermission = roleServices.userHasPermission(user_id, permission_name);
    res.json({ hasPermission });

  } catch (error) {
    console.error('Check permission error:', error);
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

/**
 * @route POST /api/roles/check-resource-permission
 * @desc Check if user has permission for a resource
 * @access Admin, Manager
 */
router.post('/check-resource-permission', requireRole(['admin', 'manager']), [
  body('user_id').isInt(),
  body('resource_type').isString(),
  body('action_type').optional().isString()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { user_id, resource_type, action_type } = req.body;

    const hasPermission = roleServices.userHasResourcePermission(user_id, resource_type, action_type);
    res.json({ hasPermission });

  } catch (error) {
    console.error('Check resource permission error:', error);
    res.status(500).json({ error: 'Failed to check resource permission' });
  }
});

// ==================== ROLE INHERITANCE ====================

/**
 * @route POST /api/roles/:id/inherit
 * @desc Set role inheritance
 * @access Admin
 */
router.post('/:id/inherit', requireRole(['admin']), [
  body('parent_role_id').isInt()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const childRoleId = parseInt(req.params.id);
    const { parent_role_id } = req.body;

    const childRole = roleServices.getRoleById(childRoleId);
    const parentRole = roleServices.getRoleById(parent_role_id);

    if (!childRole || !parentRole) {
      return res.status(404).json({ error: 'Role not found' });
    }

    roleServices.setRoleInheritance(childRoleId, parent_role_id);

    // Log the action
    roleServices.logPermissionAction(
      req.user.id,
      'set_inheritance',
      'role',
      childRoleId,
      childRole.role_name,
      { parentRoleId: parent_role_id, parentRoleName: parentRole.role_name },
      req.ip,
      req.get('User-Agent')
    );

    res.json({ message: 'Role inheritance set successfully' });

  } catch (error) {
    console.error('Set role inheritance error:', error);
    res.status(500).json({ error: 'Failed to set role inheritance' });
  }
});

/**
 * @route DELETE /api/roles/:id/inherit/:parentId
 * @desc Remove role inheritance
 * @access Admin
 */
router.delete('/:id/inherit/:parentId', requireRole(['admin']), async (req, res) => {
  try {
    const childRoleId = parseInt(req.params.id);
    const parentRoleId = parseInt(req.params.parentId);

    const childRole = roleServices.getRoleById(childRoleId);
    const parentRole = roleServices.getRoleById(parentRoleId);

    if (!childRole || !parentRole) {
      return res.status(404).json({ error: 'Role not found' });
    }

    roleServices.removeRoleInheritance(childRoleId, parentRoleId);

    // Log the action
    roleServices.logPermissionAction(
      req.user.id,
      'remove_inheritance',
      'role',
      childRoleId,
      childRole.role_name,
      { parentRoleId, parentRoleName: parentRole.role_name },
      req.ip,
      req.get('User-Agent')
    );

    res.json({ message: 'Role inheritance removed successfully' });

  } catch (error) {
    console.error('Remove role inheritance error:', error);
    res.status(500).json({ error: 'Failed to remove role inheritance' });
  }
});

// ==================== AUDIT LOGGING ====================

/**
 * @route GET /api/roles/audit-log
 * @desc Get permission audit log
 * @access Admin
 */
router.get('/audit-log', requireRole(['admin']), [
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { limit = 100, offset = 0 } = req.query;
    const auditLog = roleServices.getPermissionAuditLog(parseInt(limit), parseInt(offset));

    res.json({
      auditLog,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

// ==================== STATISTICS ====================

/**
 * @route GET /api/roles/stats
 * @desc Get role and permission statistics
 * @access Admin, Manager
 */
router.get('/stats', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const stats = roleServices.getRoleStatistics();
    res.json(stats);

  } catch (error) {
    console.error('Get role stats error:', error);
    res.status(500).json({ error: 'Failed to get role statistics' });
  }
});

/**
 * @route GET /api/roles/hierarchy
 * @desc Get role hierarchy tree
 * @access Admin, Manager
 */
router.get('/hierarchy', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const hierarchy = roleServices.getRoleHierarchy();
    res.json(hierarchy);

  } catch (error) {
    console.error('Get role hierarchy error:', error);
    res.status(500).json({ error: 'Failed to get role hierarchy' });
  }
});

module.exports = router; 