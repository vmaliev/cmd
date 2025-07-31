const express = require('express');
const { query, validationResult } = require('express-validator');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');
const dbServices = require('../database/services');

const router = express.Router();

// Apply rate limiting to all enhanced reports routes
router.use(generalRateLimit);

// ==================== ENHANCED REPORTING AND ANALYTICS ====================

/**
 * @route GET /api/enhanced-reports/ticket-volume
 * @desc Get ticket volume and trend reports
 * @access Admin, Manager
 */
router.get('/ticket-volume', requireRole(['admin', 'manager']), [
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Time range must be 7d, 30d, or 90d'),
    query('groupBy').optional().isIn(['day', 'week', 'month']).withMessage('Group by must be day, week, or month')
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

        const timeRange = req.query.timeRange || '30d';
        const groupBy = req.query.groupBy || 'day';

        const report = dbServices.getTicketVolumeReport(timeRange, groupBy);

        res.json({
            success: true,
            report,
            timeRange,
            groupBy
        });

    } catch (error) {
        console.error('Ticket volume report error:', error);
        res.status(500).json({ error: 'Failed to generate ticket volume report' });
    }
});

/**
 * @route GET /api/enhanced-reports/sla-compliance
 * @desc Get SLA compliance reporting
 * @access Admin, Manager
 */
router.get('/sla-compliance', requireRole(['admin', 'manager']), [
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Time range must be 7d, 30d, or 90d')
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

        const timeRange = req.query.timeRange || '30d';
        const report = dbServices.getSLAComplianceReport(timeRange);

        // Calculate compliance percentages
        const enhancedReport = report.map(item => ({
            ...item,
            compliance_rate: item.total_tickets > 0 ? 
                Math.round((item.sla_compliant / item.total_tickets) * 100) : 0,
            resolution_rate: item.total_tickets > 0 ? 
                Math.round((item.resolved_tickets / item.total_tickets) * 100) : 0
        }));

        res.json({
            success: true,
            report: enhancedReport,
            timeRange
        });

    } catch (error) {
        console.error('SLA compliance report error:', error);
        res.status(500).json({ error: 'Failed to generate SLA compliance report' });
    }
});

/**
 * @route GET /api/enhanced-reports/technician-performance
 * @desc Get technician performance metrics
 * @access Admin, Manager
 */
router.get('/technician-performance', requireRole(['admin', 'manager']), [
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Time range must be 7d, 30d, or 90d')
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

        const timeRange = req.query.timeRange || '30d';
        const report = dbServices.getTechnicianPerformanceReport(timeRange);

        // Calculate performance metrics
        const enhancedReport = report.map(item => ({
            ...item,
            resolution_rate: item.total_assigned > 0 ? 
                Math.round((item.resolved_tickets / item.total_assigned) * 100) : 0,
            sla_compliance_rate: item.resolved_tickets > 0 ? 
                Math.round((item.sla_compliant_tickets / item.resolved_tickets) * 100) : 0,
            avg_resolution_hours: item.avg_resolution_hours ? 
                Math.round(item.avg_resolution_hours * 100) / 100 : 0
        }));

        res.json({
            success: true,
            report: enhancedReport,
            timeRange
        });

    } catch (error) {
        console.error('Technician performance report error:', error);
        res.status(500).json({ error: 'Failed to generate technician performance report' });
    }
});

/**
 * @route GET /api/enhanced-reports/category-priority-distribution
 * @desc Get category and priority distribution reports
 * @access Admin, Manager
 */
router.get('/category-priority-distribution', requireRole(['admin', 'manager']), [
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Time range must be 7d, 30d, or 90d')
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

        const timeRange = req.query.timeRange || '30d';
        const report = dbServices.getCategoryPriorityDistribution(timeRange);

        // Group by category for easier frontend consumption
        const groupedReport = {};
        report.forEach(item => {
            if (!groupedReport[item.category]) {
                groupedReport[item.category] = [];
            }
            groupedReport[item.category].push({
                priority: item.priority,
                ticket_count: item.ticket_count,
                open_count: item.open_count,
                resolved_count: item.resolved_count,
                avg_resolution_hours: item.avg_resolution_hours ? 
                    Math.round(item.avg_resolution_hours * 100) / 100 : 0
            });
        });

        res.json({
            success: true,
            report: groupedReport,
            rawData: report,
            timeRange
        });

    } catch (error) {
        console.error('Category priority distribution report error:', error);
        res.status(500).json({ error: 'Failed to generate category priority distribution report' });
    }
});

/**
 * @route GET /api/enhanced-reports/resolution-time-analytics
 * @desc Get resolution time analytics
 * @access Admin, Manager
 */
router.get('/resolution-time-analytics', requireRole(['admin', 'manager']), [
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Time range must be 7d, 30d, or 90d')
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

        const timeRange = req.query.timeRange || '30d';
        const report = dbServices.getResolutionTimeAnalytics(timeRange);

        // Calculate additional metrics
        const enhancedReport = report.map(item => ({
            ...item,
            avg_resolution_hours: item.avg_resolution_hours ? 
                Math.round(item.avg_resolution_hours * 100) / 100 : 0,
            min_resolution_hours: item.min_resolution_hours ? 
                Math.round(item.min_resolution_hours * 100) / 100 : 0,
            max_resolution_hours: item.max_resolution_hours ? 
                Math.round(item.max_resolution_hours * 100) / 100 : 0,
            resolved_within_1h_rate: item.total_resolved > 0 ? 
                Math.round((item.resolved_within_1h / item.total_resolved) * 100) : 0,
            resolved_within_4h_rate: item.total_resolved > 0 ? 
                Math.round((item.resolved_within_4h / item.total_resolved) * 100) : 0,
            resolved_within_24h_rate: item.total_resolved > 0 ? 
                Math.round((item.resolved_within_24h / item.total_resolved) * 100) : 0
        }));

        res.json({
            success: true,
            report: enhancedReport,
            timeRange
        });

    } catch (error) {
        console.error('Resolution time analytics error:', error);
        res.status(500).json({ error: 'Failed to generate resolution time analytics' });
    }
});

/**
 * @route GET /api/enhanced-reports/customer-satisfaction
 * @desc Get customer satisfaction tracking
 * @access Admin, Manager
 */
router.get('/customer-satisfaction', requireRole(['admin', 'manager']), [
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Time range must be 7d, 30d, or 90d')
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

        const timeRange = req.query.timeRange || '30d';
        const report = dbServices.getCustomerSatisfactionReport(timeRange);

        // Calculate satisfaction metrics
        const enhancedReport = {
            ...report,
            avg_resolution_time: report.avg_resolution_time ? 
                Math.round(report.avg_resolution_time * 100) / 100 : 0,
            sla_compliance_rate: report.tickets_with_resolution > 0 ? 
                Math.round((report.sla_compliant_tickets / report.tickets_with_resolution) * 100) : 0,
            resolution_rate: report.total_resolved_tickets > 0 ? 
                Math.round((report.tickets_with_resolution / report.total_resolved_tickets) * 100) : 0
        };

        res.json({
            success: true,
            report: enhancedReport,
            timeRange
        });

    } catch (error) {
        console.error('Customer satisfaction report error:', error);
        res.status(500).json({ error: 'Failed to generate customer satisfaction report' });
    }
});

/**
 * @route GET /api/enhanced-reports/real-time-dashboard
 * @desc Get real-time dashboard metrics
 * @access Admin, Manager
 */
router.get('/real-time-dashboard', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const metrics = dbServices.getRealTimeDashboardMetrics();
        const trendAnalysis = dbServices.getTrendAnalysis(7);
        const topTechnicians = dbServices.getTopPerformingTechnicians(5, '30d');
        const systemHealth = dbServices.getSystemHealthMetrics();

        res.json({
            success: true,
            metrics,
            trendAnalysis,
            topTechnicians,
            systemHealth,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Real-time dashboard error:', error);
        res.status(500).json({ error: 'Failed to get real-time dashboard metrics' });
    }
});

/**
 * @route GET /api/enhanced-reports/trend-analysis
 * @desc Get trend analysis for dashboard
 * @access Admin, Manager
 */
router.get('/trend-analysis', requireRole(['admin', 'manager']), [
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
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

        const days = parseInt(req.query.days) || 7;
        const trendData = dbServices.getTrendAnalysis(days);

        res.json({
            success: true,
            trendData,
            days
        });

    } catch (error) {
        console.error('Trend analysis error:', error);
        res.status(500).json({ error: 'Failed to get trend analysis' });
    }
});

/**
 * @route GET /api/enhanced-reports/top-technicians
 * @desc Get top performing technicians
 * @access Admin, Manager
 */
router.get('/top-technicians', requireRole(['admin', 'manager']), [
    query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20'),
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Time range must be 7d, 30d, or 90d')
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

        const limit = parseInt(req.query.limit) || 5;
        const timeRange = req.query.timeRange || '30d';
        const technicians = dbServices.getTopPerformingTechnicians(limit, timeRange);

        // Calculate performance scores
        const enhancedTechnicians = technicians.map(tech => ({
            ...tech,
            avg_resolution_hours: tech.avg_resolution_hours ? 
                Math.round(tech.avg_resolution_hours * 100) / 100 : 0,
            sla_compliance_rate: tech.total_resolved > 0 ? 
                Math.round((tech.sla_compliant_count / tech.total_resolved) * 100) : 0,
            performance_score: tech.total_resolved > 0 ? 
                Math.round((tech.sla_compliant_count / tech.total_resolved) * 100) : 0
        }));

        res.json({
            success: true,
            technicians: enhancedTechnicians,
            limit,
            timeRange
        });

    } catch (error) {
        console.error('Top technicians report error:', error);
        res.status(500).json({ error: 'Failed to get top technicians report' });
    }
});

/**
 * @route GET /api/enhanced-reports/system-health
 * @desc Get system health metrics
 * @access Admin, Manager
 */
router.get('/system-health', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const health = dbServices.getSystemHealthMetrics();

        // Calculate health indicators
        const healthIndicators = {
            ...health,
            system_load: health.active_tickets > 0 ? 
                Math.round((health.active_tickets / health.total_tickets) * 100) : 0,
            daily_activity: health.tickets_last_24h,
            resolution_efficiency: health.resolved_last_24h > 0 && health.tickets_last_24h > 0 ? 
                Math.round((health.resolved_last_24h / health.tickets_last_24h) * 100) : 0
        };

        res.json({
            success: true,
            health: healthIndicators,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('System health error:', error);
        res.status(500).json({ error: 'Failed to get system health metrics' });
    }
});

/**
 * @route POST /api/enhanced-reports/export
 * @desc Export reports in various formats
 * @access Admin, Manager
 */
router.post('/export', requireRole(['admin', 'manager']), [
    query('reportType').isIn(['ticket-volume', 'sla-compliance', 'technician-performance', 'category-priority', 'resolution-time']).withMessage('Invalid report type'),
    query('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv'),
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Time range must be 7d, 30d, or 90d')
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

        const { reportType, format = 'json', timeRange = '30d' } = req.query;
        let reportData;

        // Generate report based on type
        switch (reportType) {
            case 'ticket-volume':
                reportData = dbServices.getTicketVolumeReport(timeRange, 'day');
                break;
            case 'sla-compliance':
                reportData = dbServices.getSLAComplianceReport(timeRange);
                break;
            case 'technician-performance':
                reportData = dbServices.getTechnicianPerformanceReport(timeRange);
                break;
            case 'category-priority':
                reportData = dbServices.getCategoryPriorityDistribution(timeRange);
                break;
            case 'resolution-time':
                reportData = dbServices.getResolutionTimeAnalytics(timeRange);
                break;
            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }

        if (format === 'csv') {
            // Convert to CSV format
            const headers = Object.keys(reportData[0] || {});
            const csvRows = reportData.map(row => 
                headers.map(header => `"${row[header] || ''}"`).join(',')
            );
            
            const csvContent = [headers.join(','), ...csvRows].join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${reportType}-${timeRange}-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvContent);
        } else {
            res.json({
                success: true,
                reportType,
                timeRange,
                data: reportData,
                totalRecords: reportData.length
            });
        }

    } catch (error) {
        console.error('Export report error:', error);
        res.status(500).json({ error: 'Failed to export report' });
    }
});

/**
 * @route GET /api/enhanced-reports/summary
 * @desc Get comprehensive summary of all reports
 * @access Admin, Manager
 */
router.get('/summary', requireRole(['admin', 'manager']), [
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Time range must be 7d, 30d, or 90d')
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

        const timeRange = req.query.timeRange || '30d';

        // Get all reports
        const summary = {
            ticketVolume: dbServices.getTicketVolumeReport(timeRange, 'day'),
            slaCompliance: dbServices.getSLAComplianceReport(timeRange),
            technicianPerformance: dbServices.getTechnicianPerformanceReport(timeRange),
            categoryPriority: dbServices.getCategoryPriorityDistribution(timeRange),
            resolutionTime: dbServices.getResolutionTimeAnalytics(timeRange),
            customerSatisfaction: dbServices.getCustomerSatisfactionReport(timeRange),
            realTimeMetrics: dbServices.getRealTimeDashboardMetrics(),
            systemHealth: dbServices.getSystemHealthMetrics(),
            topTechnicians: dbServices.getTopPerformingTechnicians(5, timeRange)
        };

        res.json({
            success: true,
            summary,
            timeRange,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Summary report error:', error);
        res.status(500).json({ error: 'Failed to generate summary report' });
    }
});

module.exports = router; 