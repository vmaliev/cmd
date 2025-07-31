const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');
const dbServices = require('../database/services');

const router = express.Router();

// Apply rate limiting to all bulk operations
router.use(generalRateLimit);

// ==================== BULK TICKET OPERATIONS ====================

/**
 * @route POST /api/bulk/tickets/update
 * @desc Bulk update multiple tickets
 * @access Admin, Manager
 */
router.post('/tickets/update', requireRole(['admin', 'manager']), [
    body('ticketIds').isArray({ min: 1 }).withMessage('At least one ticket ID is required'),
    body('ticketIds.*').isInt().withMessage('All ticket IDs must be valid integers'),
    body('updates').isObject().withMessage('Updates object is required'),
    body('updates.status').optional().isIn(['open', 'in-progress', 'resolved', 'closed', 'cancelled']),
    body('updates.priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('updates.category').optional().isString(),
    body('updates.assignee').optional().isEmail().withMessage('Assignee must be a valid email')
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

        const { ticketIds, updates } = req.body;
        const userId = req.user.id;

        // Check if tickets exist
        const existingTickets = [];
        for (const ticketId of ticketIds) {
            const ticket = dbServices.getTicketById(ticketId);
            if (!ticket) {
                return res.status(404).json({ 
                    error: `Ticket with ID ${ticketId} not found` 
                });
            }
            existingTickets.push(ticket);
        }

        // Perform bulk update
        const result = await dbServices.bulkUpdateTickets(ticketIds, updates, userId);

        res.json({
            success: true,
            message: `Successfully updated ${result.changes} tickets`,
            changes: result.changes,
            updatedTickets: result.updatedTickets
        });

    } catch (error) {
        console.error('Bulk update tickets error:', error);
        res.status(500).json({ error: 'Failed to perform bulk update' });
    }
});

/**
 * @route POST /api/bulk/tickets/delete
 * @desc Bulk delete multiple tickets
 * @access Admin
 */
router.post('/tickets/delete', requireRole(['admin']), [
    body('ticketIds').isArray({ min: 1 }).withMessage('At least one ticket ID is required'),
    body('ticketIds.*').isInt().withMessage('All ticket IDs must be valid integers'),
    body('confirm').isBoolean().withMessage('Confirmation is required')
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

        const { ticketIds, confirm } = req.body;
        const userId = req.user.id;

        if (!confirm) {
            return res.status(400).json({ 
                error: 'Confirmation is required for bulk deletion' 
            });
        }

        // Check if tickets exist
        const existingTickets = [];
        for (const ticketId of ticketIds) {
            const ticket = dbServices.getTicketById(ticketId);
            if (!ticket) {
                return res.status(404).json({ 
                    error: `Ticket with ID ${ticketId} not found` 
                });
            }
            existingTickets.push(ticket);
        }

        // Perform bulk deletion
        const result = await dbServices.bulkDeleteTickets(ticketIds, userId);

        res.json({
            success: true,
            message: `Successfully deleted ${result.changes} tickets`,
            changes: result.changes,
            deletedTickets: result.deletedTickets
        });

    } catch (error) {
        console.error('Bulk delete tickets error:', error);
        res.status(500).json({ error: 'Failed to perform bulk deletion' });
    }
});

/**
 * @route POST /api/bulk/tickets/export
 * @desc Bulk export multiple tickets
 * @access Admin, Manager
 */
router.post('/tickets/export', requireRole(['admin', 'manager']), [
    body('ticketIds').isArray({ min: 1 }).withMessage('At least one ticket ID is required'),
    body('ticketIds.*').isInt().withMessage('All ticket IDs must be valid integers'),
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

        const { ticketIds, format = 'json' } = req.body;

        // Check if tickets exist
        const existingTickets = [];
        for (const ticketId of ticketIds) {
            const ticket = dbServices.getTicketById(ticketId);
            if (!ticket) {
                return res.status(404).json({ 
                    error: `Ticket with ID ${ticketId} not found` 
                });
            }
            existingTickets.push(ticket);
        }

        // Perform bulk export
        const result = await dbServices.bulkExportTickets(ticketIds, format);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.send(result.data);
        } else {
            res.json({
                success: true,
                message: `Successfully exported ${existingTickets.length} tickets`,
                data: result.data,
                filename: result.filename
            });
        }

    } catch (error) {
        console.error('Bulk export tickets error:', error);
        res.status(500).json({ error: 'Failed to perform bulk export' });
    }
});

/**
 * @route POST /api/bulk/tickets/apply-template
 * @desc Bulk apply template to multiple tickets
 * @access Admin, Manager
 */
router.post('/tickets/apply-template', requireRole(['admin', 'manager']), [
    body('ticketIds').isArray({ min: 1 }).withMessage('At least one ticket ID is required'),
    body('ticketIds.*').isInt().withMessage('All ticket IDs must be valid integers'),
    body('templateId').isInt().withMessage('Template ID is required')
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

        const { ticketIds, templateId } = req.body;
        const userId = req.user.id;

        // Check if tickets exist
        const existingTickets = [];
        for (const ticketId of ticketIds) {
            const ticket = dbServices.getTicketById(ticketId);
            if (!ticket) {
                return res.status(404).json({ 
                    error: `Ticket with ID ${ticketId} not found` 
                });
            }
            existingTickets.push(ticket);
        }

        // Perform bulk template application
        const result = await dbServices.bulkApplyTemplate(ticketIds, templateId, userId);

        res.json({
            success: true,
            message: `Successfully applied template to ${result.changes} tickets`,
            changes: result.changes,
            updatedTickets: result.updatedTickets
        });

    } catch (error) {
        console.error('Bulk apply template error:', error);
        if (error.message === 'Template not found') {
            res.status(404).json({ error: 'Template not found' });
        } else {
            res.status(500).json({ error: 'Failed to apply template' });
        }
    }
});

/**
 * @route GET /api/bulk/tickets/preview
 * @desc Preview bulk operation results without executing
 * @access Admin, Manager
 */
router.get('/tickets/preview', requireRole(['admin', 'manager']), [
    query('ticketIds').isArray({ min: 1 }).withMessage('At least one ticket ID is required'),
    query('operation').isIn(['update', 'delete', 'export', 'apply-template']).withMessage('Valid operation is required'),
    query('templateId').optional().isInt().withMessage('Template ID must be valid integer')
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

        const { ticketIds, operation, templateId } = req.query;

        // Check if tickets exist
        const existingTickets = [];
        const missingTickets = [];
        
        for (const ticketId of ticketIds) {
            const ticket = dbServices.getTicketById(parseInt(ticketId));
            if (ticket) {
                existingTickets.push(ticket);
            } else {
                missingTickets.push(ticketId);
            }
        }

        let preview = {
            operation,
            totalTickets: ticketIds.length,
            existingTickets: existingTickets.length,
            missingTickets: missingTickets.length,
            tickets: existingTickets
        };

        // Add operation-specific preview information
        if (operation === 'delete') {
            preview.warning = `This will permanently delete ${existingTickets.length} tickets and all associated data.`;
        } else if (operation === 'apply-template' && templateId) {
            const template = dbServices.db.prepare('SELECT * FROM ticket_templates WHERE id = ?').get(templateId);
            if (template) {
                preview.template = template;
                preview.changes = `Will apply template "${template.name}" to ${existingTickets.length} tickets`;
            } else {
                return res.status(404).json({ error: 'Template not found' });
            }
        }

        res.json({
            success: true,
            preview
        });

    } catch (error) {
        console.error('Bulk preview error:', error);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

module.exports = router; 