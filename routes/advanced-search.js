const express = require('express');
const { query, body, validationResult } = require('express-validator');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');
const dbServices = require('../database/services');

const router = express.Router();

// Apply rate limiting to all advanced search routes
router.use(generalRateLimit);

// ==================== ADVANCED TICKET SEARCH ====================

/**
 * @route GET /api/advanced-search/tickets
 * @desc Advanced ticket search with multiple criteria
 * @access Admin, Manager, Technician
 */
router.get('/tickets', requireRole(['admin', 'manager', 'technician']), [
    query('search').optional().isString().trim(),
    query('status').optional().isString().trim(),
    query('priority').optional().isString().trim(),
    query('category').optional().isString().trim(),
    query('assignee').optional().isString().trim(),
    query('requester').optional().isString().trim(),
    query('department').optional().isString().trim(),
    query('createdAfter').optional().isISO8601().toDate(),
    query('createdBefore').optional().isISO8601().toDate(),
    query('updatedAfter').optional().isISO8601().toDate(),
    query('updatedBefore').optional().isISO8601().toDate(),
    query('resolvedAfter').optional().isISO8601().toDate(),
    query('resolvedBefore').optional().isISO8601().toDate(),
    query('orderBy').optional().isIn(['created_at', 'updated_at', 'subject', 'priority', 'status', 'assignee']),
    query('orderDirection').optional().isIn(['ASC', 'DESC']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
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

        // Build filters object
        const filters = {};
        const options = {};

        // Text search
        if (req.query.search) {
            filters.search = req.query.search;
        }

        // Status filter (support multiple values)
        if (req.query.status) {
            filters.status = req.query.status.includes(',') 
                ? req.query.status.split(',').map(s => s.trim())
                : req.query.status;
        }

        // Priority filter (support multiple values)
        if (req.query.priority) {
            filters.priority = req.query.priority.includes(',') 
                ? req.query.priority.split(',').map(p => p.trim())
                : req.query.priority;
        }

        // Category filter (support multiple values)
        if (req.query.category) {
            filters.category = req.query.category.includes(',') 
                ? req.query.category.split(',').map(c => c.trim())
                : req.query.category;
        }

        // Assignee filter
        if (req.query.assignee) {
            filters.assignee = req.query.assignee;
        }

        // Requester filter
        if (req.query.requester) {
            filters.requester = req.query.requester;
        }

        // Department filter
        if (req.query.department) {
            filters.department = req.query.department;
        }

        // Date filters
        if (req.query.createdAfter) {
            filters.createdAfter = req.query.createdAfter;
        }
        if (req.query.createdBefore) {
            filters.createdBefore = req.query.createdBefore;
        }
        if (req.query.updatedAfter) {
            filters.updatedAfter = req.query.updatedAfter;
        }
        if (req.query.updatedBefore) {
            filters.updatedBefore = req.query.updatedBefore;
        }
        if (req.query.resolvedAfter) {
            filters.resolvedAfter = req.query.resolvedAfter;
        }
        if (req.query.resolvedBefore) {
            filters.resolvedBefore = req.query.resolvedBefore;
        }

        // Options
        if (req.query.orderBy) {
            options.orderBy = req.query.orderBy;
        }
        if (req.query.orderDirection) {
            options.orderDirection = req.query.orderDirection;
        }
        if (req.query.limit) {
            options.limit = parseInt(req.query.limit);
        }
        if (req.query.offset) {
            options.offset = parseInt(req.query.offset);
        }

        // Perform search
        const tickets = dbServices.searchTickets(filters, options);
        const stats = dbServices.getTicketSearchStats(filters);

        res.json({
            success: true,
            tickets,
            stats,
            filters,
            options,
            total: stats.total_tickets
        });

    } catch (error) {
        console.error('Advanced ticket search error:', error);
        res.status(500).json({ error: 'Failed to perform advanced search' });
    }
});

/**
 * @route GET /api/advanced-search/filter-options
 * @desc Get available filter options for tickets
 * @access Admin, Manager, Technician
 */
router.get('/filter-options', requireRole(['admin', 'manager', 'technician']), async (req, res) => {
    try {
        const options = dbServices.getTicketFilterOptions();
        
        res.json({
            success: true,
            options
        });

    } catch (error) {
        console.error('Get filter options error:', error);
        res.status(500).json({ error: 'Failed to get filter options' });
    }
});

/**
 * @route POST /api/advanced-search/export
 * @desc Export search results
 * @access Admin, Manager, Technician
 */
router.post('/export', requireRole(['admin', 'manager', 'technician']), [
    body('filters').isObject().withMessage('Filters object is required'),
    body('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv')
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

        const { filters, format = 'json' } = req.body;

        // Perform search without pagination
        const tickets = dbServices.searchTickets(filters, { limit: 10000 });

        if (format === 'csv') {
            // Convert to CSV format
            const csvHeaders = [
                'Ticket ID', 'Subject', 'Description', 'Status', 'Priority', 'Category',
                'Requester', 'Assignee', 'Created At', 'Updated At', 'Resolved At'
            ];
            
            const csvRows = tickets.map(ticket => [
                ticket.ticket_id,
                ticket.subject,
                ticket.description,
                ticket.status_name,
                ticket.priority_name,
                ticket.category_name,
                ticket.requester_name,
                ticket.assignee_name,
                ticket.created_at,
                ticket.updated_at,
                ticket.resolved_at
            ]);
            
            const csvContent = [csvHeaders, ...csvRows]
                .map(row => row.map(cell => `"${cell || ''}"`).join(','))
                .join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="tickets-search-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvContent);
        } else {
            res.json({
                success: true,
                data: tickets,
                total: tickets.length,
                filters
            });
        }

    } catch (error) {
        console.error('Export search results error:', error);
        res.status(500).json({ error: 'Failed to export search results' });
    }
});

// ==================== SAVED SEARCH FILTERS ====================

/**
 * @route GET /api/advanced-search/saved-filters
 * @desc Get saved search filters for user
 * @access Admin, Manager, Technician
 */
router.get('/saved-filters', requireRole(['admin', 'manager', 'technician']), async (req, res) => {
    try {
        const userId = req.user.id;
        const filters = dbServices.getSavedSearchFilters(userId);
        
        // Parse JSON filters
        const parsedFilters = filters.map(filter => ({
            ...filter,
            filters: JSON.parse(filter.filters)
        }));

        res.json({
            success: true,
            filters: parsedFilters
        });

    } catch (error) {
        console.error('Get saved filters error:', error);
        res.status(500).json({ error: 'Failed to get saved filters' });
    }
});

/**
 * @route GET /api/advanced-search/saved-filters/:id
 * @desc Get specific saved search filter
 * @access Admin, Manager, Technician
 */
router.get('/saved-filters/:id', requireRole(['admin', 'manager', 'technician']), [
    query('id').isInt().withMessage('Filter ID must be a valid integer')
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

        const filterId = parseInt(req.params.id);
        const userId = req.user.id;
        
        const filter = dbServices.getSavedSearchFilter(filterId, userId);
        
        if (!filter) {
            return res.status(404).json({ error: 'Saved filter not found' });
        }

        // Parse JSON filters
        filter.filters = JSON.parse(filter.filters);

        res.json({
            success: true,
            filter
        });

    } catch (error) {
        console.error('Get saved filter error:', error);
        res.status(500).json({ error: 'Failed to get saved filter' });
    }
});

/**
 * @route POST /api/advanced-search/saved-filters
 * @desc Save a new search filter
 * @access Admin, Manager, Technician
 */
router.post('/saved-filters', requireRole(['admin', 'manager', 'technician']), [
    body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be 1-100 characters'),
    body('description').optional().isString().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    body('filters').isObject().withMessage('Filters object is required'),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean')
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

        const userId = req.user.id;
        const filterData = {
            name: req.body.name,
            description: req.body.description,
            filters: req.body.filters,
            isPublic: req.body.isPublic || false
        };

        const result = dbServices.saveSearchFilter(userId, filterData);

        res.json({
            success: true,
            message: 'Search filter saved successfully',
            filterId: result.lastInsertRowid
        });

    } catch (error) {
        console.error('Save search filter error:', error);
        res.status(500).json({ error: 'Failed to save search filter' });
    }
});

/**
 * @route PUT /api/advanced-search/saved-filters/:id
 * @desc Update a saved search filter
 * @access Admin, Manager, Technician
 */
router.put('/saved-filters/:id', requireRole(['admin', 'manager', 'technician']), [
    body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be 1-100 characters'),
    body('description').optional().isString().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    body('filters').isObject().withMessage('Filters object is required'),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean')
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

        const filterId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Check if filter exists and user owns it
        const existingFilter = dbServices.getSavedSearchFilter(filterId, userId);
        if (!existingFilter) {
            return res.status(404).json({ error: 'Saved filter not found' });
        }

        const filterData = {
            name: req.body.name,
            description: req.body.description,
            filters: req.body.filters,
            isPublic: req.body.isPublic || false
        };

        const result = dbServices.updateSavedSearchFilter(filterId, userId, filterData);

        res.json({
            success: true,
            message: 'Search filter updated successfully',
            changes: result.changes
        });

    } catch (error) {
        console.error('Update search filter error:', error);
        res.status(500).json({ error: 'Failed to update search filter' });
    }
});

/**
 * @route DELETE /api/advanced-search/saved-filters/:id
 * @desc Delete a saved search filter
 * @access Admin, Manager, Technician
 */
router.delete('/saved-filters/:id', requireRole(['admin', 'manager', 'technician']), async (req, res) => {
    try {
        const filterId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Check if filter exists and user owns it
        const existingFilter = dbServices.getSavedSearchFilter(filterId, userId);
        if (!existingFilter) {
            return res.status(404).json({ error: 'Saved filter not found' });
        }

        const result = dbServices.deleteSavedSearchFilter(filterId, userId);

        res.json({
            success: true,
            message: 'Search filter deleted successfully',
            changes: result.changes
        });

    } catch (error) {
        console.error('Delete search filter error:', error);
        res.status(500).json({ error: 'Failed to delete search filter' });
    }
});

module.exports = router; 