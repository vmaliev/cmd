const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');
const dbServices = require('../database/services');
const profileServices = require('../database/profile-services');
const roleServices = require('../database/role-services');

const router = express.Router();

// Apply rate limiting to all user routes
router.use(generalRateLimit);

// ==================== USER CRUD OPERATIONS ====================

/**
 * @route GET /api/users
 * @desc Get all users with pagination and filtering
 * @access Admin, Manager
 */
router.get('/', requireRole(['admin', 'manager']), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().trim(),
  query('role').optional().isString().trim(),
  query('status').optional().isIn(['active', 'inactive']),
  query('sortBy').optional().isIn(['created_at', 'name', 'email', 'role', 'last_login']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
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

    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      status = '',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const users = await dbServices.getUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      role,
      status,
      sortBy,
      sortOrder
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

/**
 * @route POST /api/users
 * @desc Create a new user
 * @access Admin
 */
router.post('/', requireRole(['admin']), [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role').isIn(['admin', 'technician', 'user']).withMessage('Valid role is required'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('department').optional().isString().trim()
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

    const { name, email, role, password, department } = req.body;

    // Check if user already exists
    const existingUser = await dbServices.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Create user
    const user = await dbServices.createUser({
      name,
      email,
      role,
      password,
      department
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        is_active: user.is_active,
        is_verified: user.is_verified,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ==================== USER STATISTICS ====================

/**
 * @route GET /api/users/stats
 * @desc Get user statistics
 * @access Admin, Manager
 */
router.get('/stats', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const stats = await dbServices.getUserStats();
    res.json(stats);
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

/**
 * @route GET /api/users/export
 * @desc Export users to CSV
 * @access Admin, Manager
 */
router.get('/export', requireRole(['admin', 'manager']), [
  query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json')
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

    const { format = 'csv' } = req.query;

    // Get all users
    const users = await dbServices.getAllUsers();

    if (format === 'csv') {
      // Convert to CSV
      const csv = convertUsersToCSV(users);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="users-export.csv"');
      res.send(csv);
    } else {
      res.json(users);
    }
  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({ error: 'Failed to export users' });
  }
});

/**
 * @route POST /api/users/import
 * @desc Import users from CSV file
 * @access Admin
 */
router.post('/import', requireRole(['admin']), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file;
    const skipDuplicates = req.body.skipDuplicates === 'true';
    const sendWelcome = req.body.sendWelcome === 'true';

    // Validate file type
    if (!file.mimetype.includes('text/csv') && !file.name.endsWith('.csv')) {
      return res.status(400).json({ error: 'File must be a CSV' });
    }

    // Parse CSV
    const csvContent = file.data.toString('utf8');
    const users = parseCSVToUsers(csvContent);

    if (users.length === 0) {
      return res.status(400).json({ error: 'No valid users found in CSV' });
    }

    // Import users
    const results = await importUsersFromCSV(users, skipDuplicates, sendWelcome);

    res.json({
      message: 'Import completed successfully',
      imported: results.imported,
      skipped: results.skipped,
      errors: results.errors
    });
  } catch (error) {
    console.error('Import users error:', error);
    res.status(500).json({ error: 'Failed to import users' });
  }
});

/**
 * @route GET /api/users/:id
 * @desc Get user by ID with profile and permissions
 * @access Admin, Manager, Self
 */
router.get('/:id', requireRole(['admin', 'manager']), [
  param('id').isInt({ min: 1 }).withMessage('Valid user ID is required')
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

    const userId = parseInt(req.params.id);

    // Get user details
    const user = await dbServices.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user profile
    const profile = await profileServices.getUserProfile(userId);

    // Get user permissions
    const permissions = await roleServices.getUserPermissions(userId);

    // Get recent activity
    const recentActivity = await profileServices.getUserActivityLog(userId, 10);

    res.json({
      user,
      profile,
      permissions,
      recentActivity
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * @route PUT /api/users/:id
 * @desc Update user
 * @access Admin, Manager
 */
router.put('/:id', requireRole(['admin', 'manager']), [
  param('id').isInt({ min: 1 }).withMessage('Valid user ID is required'),
  body('name').optional().notEmpty().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'technician', 'user']),
  body('department').optional().isString().trim(),
  body('isActive').optional().isBoolean()
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

    const userId = parseInt(req.params.id);
    const updates = req.body;

    // Check if user exists
    const existingUser = await dbServices.getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user
    const updatedUser = await dbServices.updateUser(userId, updates);

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * @route DELETE /api/users/:id
 * @desc Delete user
 * @access Admin
 */
router.delete('/:id', requireRole(['admin']), [
  param('id').isInt({ min: 1 }).withMessage('Valid user ID is required')
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

    const userId = parseInt(req.params.id);

    // Check if user exists
    const existingUser = await dbServices.getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user
    await dbServices.deleteUser(userId);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ==================== BULK OPERATIONS ====================

/**
 * @route POST /api/users/bulk/update
 * @desc Bulk update users
 * @access Admin
 */
router.post('/bulk/update', requireRole(['admin']), [
  body('userIds').isArray({ min: 1 }).withMessage('User IDs array is required'),
  body('updates').isObject().withMessage('Updates object is required')
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

    const { userIds, updates } = req.body;

    // Update users
    const results = await dbServices.bulkUpdateUsers(userIds, updates);

    res.json({
      message: `Updated ${results.updated} users successfully`,
      updated: results.updated,
      failed: results.failed
    });
  } catch (error) {
    console.error('Bulk update users error:', error);
    res.status(500).json({ error: 'Failed to update users' });
  }
});

/**
 * @route POST /api/users/bulk/delete
 * @desc Bulk delete users
 * @access Admin
 */
router.post('/bulk/delete', requireRole(['admin']), [
  body('userIds').isArray({ min: 1 }).withMessage('User IDs array is required')
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

    const { userIds } = req.body;

    // Delete users
    const results = await dbServices.bulkDeleteUsers(userIds);

    res.json({
      message: `Deleted ${results.deleted} users successfully`,
      deleted: results.deleted,
      failed: results.failed
    });
  } catch (error) {
    console.error('Bulk delete users error:', error);
    res.status(500).json({ error: 'Failed to delete users' });
  }
});



// ==================== HELPER FUNCTIONS ====================

function convertUsersToCSV(users) {
  const headers = [
    'ID',
    'Name',
    'Email',
    'Role',
    'Department',
    'Status',
    'Verified',
    'Created',
    'Last Login'
  ];

  const rows = users.map(user => [
    user.id,
    user.name,
    user.email,
    user.role,
    user.department || '',
    user.is_active ? 'Active' : 'Inactive',
    user.is_verified ? 'Yes' : 'No',
    new Date(user.created_at).toLocaleDateString(),
    user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

function parseCSVToUsers(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const dataLines = lines.slice(1);

  // Find column indices
  const nameIndex = headers.findIndex(h => h.toLowerCase() === 'name');
  const emailIndex = headers.findIndex(h => h.toLowerCase() === 'email');
  const roleIndex = headers.findIndex(h => h.toLowerCase() === 'role');
  const departmentIndex = headers.findIndex(h => h.toLowerCase() === 'department');
  const statusIndex = headers.findIndex(h => h.toLowerCase() === 'status');

  if (nameIndex === -1 || emailIndex === -1 || roleIndex === -1) {
    return [];
  }

  return dataLines.map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    
    return {
      name: values[nameIndex] || '',
      email: values[emailIndex] || '',
      role: values[roleIndex] || 'user',
      department: departmentIndex !== -1 ? values[departmentIndex] || '' : '',
      is_active: statusIndex !== -1 ? values[statusIndex].toLowerCase() === 'active' : true
    };
  }).filter(user => user.name && user.email); // Filter out empty rows
}

async function importUsersFromCSV(users, skipDuplicates, sendWelcome) {
  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (const userData of users) {
    try {
      // Check if user already exists
      const existingUser = await dbServices.getUserByEmail(userData.email);
      if (existingUser) {
        if (skipDuplicates) {
          skipped++;
          continue;
        } else {
          errors.push(`User with email ${userData.email} already exists`);
          continue;
        }
      }

      // Validate role
      if (!['admin', 'technician', 'user'].includes(userData.role)) {
        errors.push(`Invalid role '${userData.role}' for user ${userData.email}`);
        continue;
      }

      // Create user
      const user = await dbServices.createUser({
        name: userData.name,
        email: userData.email,
        role: userData.role,
        department: userData.department,
        is_active: userData.is_active
      });

      imported++;

      // Send welcome email if requested
      if (sendWelcome && userData.email) {
        try {
          const emailService = require('../utils/email');
          await emailService.sendWelcomeEmail(userData.email, userData.name);
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail the import for email errors
        }
      }
    } catch (error) {
      console.error('Error importing user:', error);
      errors.push(`Failed to import ${userData.email}: ${error.message}`);
    }
  }

  return { imported, skipped, errors };
}

module.exports = router; 