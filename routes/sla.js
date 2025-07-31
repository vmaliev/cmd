const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');
const SLAServices = require('../database/sla-services');

const router = express.Router();
const slaServices = new SLAServices();

// ==================== SLA RULES MANAGEMENT ====================

/**
 * @route GET /api/sla/rules
 * @desc Get all SLA rules
 * @access Admin, Technician
 */
router.get('/rules', requireRole(['admin', 'technician']), generalRateLimit, async (req, res) => {
    try {
        const rules = slaServices.getAllSLARules();
        res.json(rules);
    } catch (error) {
        console.error('Get SLA rules error:', error);
        res.status(500).json({ error: 'Failed to get SLA rules' });
    }
});

/**
 * @route GET /api/sla/rules/:id
 * @desc Get SLA rule by ID
 * @access Admin, Technician
 */
router.get('/rules/:id', requireRole(['admin', 'technician']), generalRateLimit, async (req, res) => {
    try {
        const rule = slaServices.getSLARuleById(req.params.id);
        if (!rule) {
            return res.status(404).json({ error: 'SLA rule not found' });
        }
        res.json(rule);
    } catch (error) {
        console.error('Get SLA rule error:', error);
        res.status(500).json({ error: 'Failed to get SLA rule' });
    }
});

/**
 * @route POST /api/sla/rules
 * @desc Create new SLA rule
 * @access Admin
 */
router.post('/rules', requireRole(['admin']), generalRateLimit, [
    body('priority_id').isInt().withMessage('Priority ID must be an integer'),
    body('name').notEmpty().withMessage('Name is required'),
    body('initial_response_hours').isFloat({ min: 0 }).withMessage('Initial response hours must be positive'),
    body('resolution_hours').isFloat({ min: 0 }).withMessage('Resolution hours must be positive'),
    body('escalation_levels').optional().isInt({ min: 1 }).withMessage('Escalation levels must be at least 1'),
    body('escalation_interval_hours').optional().isFloat({ min: 0 }).withMessage('Escalation interval must be positive')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const rule = slaServices.createSLARule(req.body);
        res.status(201).json(rule);
    } catch (error) {
        console.error('Create SLA rule error:', error);
        res.status(500).json({ error: 'Failed to create SLA rule' });
    }
});

/**
 * @route PUT /api/sla/rules/:id
 * @desc Update SLA rule
 * @access Admin
 */
router.put('/rules/:id', requireRole(['admin']), generalRateLimit, [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('initial_response_hours').optional().isFloat({ min: 0 }).withMessage('Initial response hours must be positive'),
    body('resolution_hours').optional().isFloat({ min: 0 }).withMessage('Resolution hours must be positive'),
    body('escalation_levels').optional().isInt({ min: 1 }).withMessage('Escalation levels must be at least 1'),
    body('escalation_interval_hours').optional().isFloat({ min: 0 }).withMessage('Escalation interval must be positive')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const rule = slaServices.updateSLARule(req.params.id, req.body);
        if (!rule) {
            return res.status(404).json({ error: 'SLA rule not found' });
        }
        res.json(rule);
    } catch (error) {
        console.error('Update SLA rule error:', error);
        res.status(500).json({ error: 'Failed to update SLA rule' });
    }
});

/**
 * @route DELETE /api/sla/rules/:id
 * @desc Delete SLA rule
 * @access Admin
 */
router.delete('/rules/:id', requireRole(['admin']), generalRateLimit, async (req, res) => {
    try {
        const result = slaServices.deleteSLARule(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'SLA rule not found' });
        }
        res.json({ message: 'SLA rule deleted successfully' });
    } catch (error) {
        console.error('Delete SLA rule error:', error);
        res.status(500).json({ error: 'Failed to delete SLA rule' });
    }
});

// ==================== SLA VIOLATIONS ====================

/**
 * @route GET /api/sla/violations
 * @desc Get all SLA violations
 * @access Admin, Technician
 */
router.get('/violations', requireRole(['admin', 'technician']), generalRateLimit, [
    query('is_resolved').optional().isBoolean().withMessage('is_resolved must be boolean'),
    query('violation_type').optional().isIn(['response', 'resolution']).withMessage('Invalid violation type'),
    query('ticket_id').optional().isInt().withMessage('Ticket ID must be integer')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const filters = {};
        if (req.query.is_resolved !== undefined) {
            filters.is_resolved = req.query.is_resolved === 'true';
        }
        if (req.query.violation_type) {
            filters.violation_type = req.query.violation_type;
        }
        if (req.query.ticket_id) {
            filters.ticket_id = parseInt(req.query.ticket_id);
        }

        const violations = slaServices.getAllSLAViolations(filters);
        res.json(violations);
    } catch (error) {
        console.error('Get SLA violations error:', error);
        res.status(500).json({ error: 'Failed to get SLA violations' });
    }
});

/**
 * @route GET /api/sla/violations/:id
 * @desc Get SLA violation by ID
 * @access Admin, Technician
 */
router.get('/violations/:id', requireRole(['admin', 'technician']), generalRateLimit, async (req, res) => {
    try {
        const violation = slaServices.getSLAViolationById(req.params.id);
        if (!violation) {
            return res.status(404).json({ error: 'SLA violation not found' });
        }
        res.json(violation);
    } catch (error) {
        console.error('Get SLA violation error:', error);
        res.status(500).json({ error: 'Failed to get SLA violation' });
    }
});

/**
 * @route POST /api/sla/violations/:id/resolve
 * @desc Resolve SLA violation
 * @access Admin, Technician
 */
router.post('/violations/:id/resolve', requireRole(['admin', 'technician']), generalRateLimit, async (req, res) => {
    try {
        const violation = slaServices.resolveSLAViolation(req.params.id, req.user.id);
        if (!violation) {
            return res.status(404).json({ error: 'SLA violation not found' });
        }
        res.json(violation);
    } catch (error) {
        console.error('Resolve SLA violation error:', error);
        res.status(500).json({ error: 'Failed to resolve SLA violation' });
    }
});

// ==================== ESCALATIONS ====================

/**
 * @route GET /api/sla/escalations
 * @desc Get all escalations
 * @access Admin, Technician
 */
router.get('/escalations', requireRole(['admin', 'technician']), generalRateLimit, [
    query('is_resolved').optional().isBoolean().withMessage('is_resolved must be boolean'),
    query('ticket_id').optional().isInt().withMessage('Ticket ID must be integer')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const filters = {};
        if (req.query.is_resolved !== undefined) {
            filters.is_resolved = req.query.is_resolved === 'true';
        }
        if (req.query.ticket_id) {
            filters.ticket_id = parseInt(req.query.ticket_id);
        }

        const escalations = slaServices.getAllEscalations(filters);
        res.json(escalations);
    } catch (error) {
        console.error('Get escalations error:', error);
        res.status(500).json({ error: 'Failed to get escalations' });
    }
});

/**
 * @route GET /api/sla/escalations/:id
 * @desc Get escalation by ID
 * @access Admin, Technician
 */
router.get('/escalations/:id', requireRole(['admin', 'technician']), generalRateLimit, async (req, res) => {
    try {
        const escalation = slaServices.getEscalationById(req.params.id);
        if (!escalation) {
            return res.status(404).json({ error: 'Escalation not found' });
        }
        res.json(escalation);
    } catch (error) {
        console.error('Get escalation error:', error);
        res.status(500).json({ error: 'Failed to get escalation' });
    }
});

/**
 * @route POST /api/sla/escalations/:id/resolve
 * @desc Resolve escalation
 * @access Admin, Technician
 */
router.post('/escalations/:id/resolve', requireRole(['admin', 'technician']), generalRateLimit, async (req, res) => {
    try {
        const escalation = slaServices.resolveEscalation(req.params.id, req.user.id);
        if (!escalation) {
            return res.status(404).json({ error: 'Escalation not found' });
        }
        res.json(escalation);
    } catch (error) {
        console.error('Resolve escalation error:', error);
        res.status(500).json({ error: 'Failed to resolve escalation' });
    }
});

// ==================== SLA NOTIFICATIONS ====================

/**
 * @route GET /api/sla/notifications
 * @desc Get all SLA notifications
 * @access Admin, Technician
 */
router.get('/notifications', requireRole(['admin', 'technician']), generalRateLimit, [
    query('is_read').optional().isBoolean().withMessage('is_read must be boolean'),
    query('notification_type').optional().isIn(['warning', 'breach', 'escalation']).withMessage('Invalid notification type'),
    query('sent_to_user_id').optional().isInt().withMessage('User ID must be integer')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const filters = {};
        if (req.query.is_read !== undefined) {
            filters.is_read = req.query.is_read === 'true';
        }
        if (req.query.notification_type) {
            filters.notification_type = req.query.notification_type;
        }
        if (req.query.sent_to_user_id) {
            filters.sent_to_user_id = parseInt(req.query.sent_to_user_id);
        }

        const notifications = slaServices.getAllSLANotifications(filters);
        res.json(notifications);
    } catch (error) {
        console.error('Get SLA notifications error:', error);
        res.status(500).json({ error: 'Failed to get SLA notifications' });
    }
});

/**
 * @route POST /api/sla/notifications/:id/read
 * @desc Mark notification as read
 * @access Admin, Technician
 */
router.post('/notifications/:id/read', requireRole(['admin', 'technician']), generalRateLimit, async (req, res) => {
    try {
        const notification = slaServices.markNotificationAsRead(req.params.id);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json(notification);
    } catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// ==================== SLA REPORTS ====================

/**
 * @route GET /api/sla/reports/compliance
 * @desc Get SLA compliance report
 * @access Admin
 */
router.get('/reports/compliance', requireRole(['admin']), generalRateLimit, [
    query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid time range')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const timeRange = req.query.timeRange || '30d';
        const report = slaServices.getSLAComplianceReport(timeRange);
        res.json(report);
    } catch (error) {
        console.error('Get SLA compliance report error:', error);
        res.status(500).json({ error: 'Failed to get SLA compliance report' });
    }
});

// ==================== AUTOMATION ENDPOINTS ====================

/**
 * @route POST /api/sla/check-violations
 * @desc Check for SLA violations (automated)
 * @access Admin
 */
router.post('/check-violations', requireRole(['admin']), generalRateLimit, async (req, res) => {
    try {
        const violations = slaServices.checkSLAViolations();
        res.json({ 
            message: 'SLA violation check completed',
            violationsFound: violations.length,
            violations: violations
        });
    } catch (error) {
        console.error('Check SLA violations error:', error);
        res.status(500).json({ error: 'Failed to check SLA violations' });
    }
});

/**
 * @route POST /api/sla/check-escalations
 * @desc Check for escalations (automated)
 * @access Admin
 */
router.post('/check-escalations', requireRole(['admin']), generalRateLimit, async (req, res) => {
    try {
        const escalations = slaServices.checkEscalations();
        res.json({ 
            message: 'Escalation check completed',
            escalationsTriggered: escalations.length,
            escalations: escalations
        });
    } catch (error) {
        console.error('Check escalations error:', error);
        res.status(500).json({ error: 'Failed to check escalations' });
    }
});

// ==================== MAINTENANCE ENDPOINTS ====================

/**
 * @route POST /api/sla/initialize
 * @desc Initialize SLA tables
 * @access Admin
 */
router.post('/initialize', requireRole(['admin']), generalRateLimit, async (req, res) => {
    try {
        const success = slaServices.initializeSLATables();
        if (success) {
            res.json({ message: 'SLA tables initialized successfully' });
        } else {
            res.status(500).json({ error: 'Failed to initialize SLA tables' });
        }
    } catch (error) {
        console.error('Initialize SLA tables error:', error);
        res.status(500).json({ error: 'Failed to initialize SLA tables' });
    }
});

/**
 * @route POST /api/sla/cleanup
 * @desc Clean up old SLA data
 * @access Admin
 */
router.post('/cleanup', requireRole(['admin']), generalRateLimit, [
    body('daysToKeep').optional().isInt({ min: 1 }).withMessage('Days to keep must be at least 1')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const daysToKeep = req.body.daysToKeep || 90;
        const deletedCount = slaServices.cleanupOldSLAData(daysToKeep);
        res.json({ 
            message: 'SLA data cleanup completed',
            deletedRecords: deletedCount,
            daysKept: daysToKeep
        });
    } catch (error) {
        console.error('Cleanup SLA data error:', error);
        res.status(500).json({ error: 'Failed to cleanup SLA data' });
    }
});

module.exports = router; 