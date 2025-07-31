const express = require('express');
const { query, validationResult } = require('express-validator');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');
const AnalyticsServices = require('../database/analytics-services');

const router = express.Router();
const analyticsServices = new AnalyticsServices();

// Apply rate limiting to all analytics routes
router.use(generalRateLimit);

// ==================== DASHBOARD SUMMARY ====================

/**
 * @route GET /api/analytics/dashboard
 * @desc Get dashboard summary statistics
 * @access Admin, Manager
 */
router.get('/dashboard', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const summary = analyticsServices.getDashboardSummary();
    res.json(summary);
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to get dashboard summary' });
  }
});

// ==================== USER REGISTRATION ANALYTICS ====================

/**
 * @route GET /api/analytics/registrations
 * @desc Get user registration statistics
 * @access Admin, Manager
 */
router.get('/registrations', requireRole(['admin', 'manager']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
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

    const { timeRange = '30d' } = req.query;
    const stats = analyticsServices.getUserRegistrationStats(timeRange);
    res.json(stats);
  } catch (error) {
    console.error('Get registration stats error:', error);
    res.status(500).json({ error: 'Failed to get registration statistics' });
  }
});

/**
 * @route GET /api/analytics/registrations/daily
 * @desc Get daily registration trends
 * @access Admin, Manager
 */
router.get('/registrations/daily', requireRole(['admin', 'manager']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
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

    const { timeRange = '30d' } = req.query;
    const stats = analyticsServices.getUserRegistrationStats(timeRange);
    res.json({
      daily: stats.registrationsByDay,
      monthly: stats.registrationsByMonth,
      byRole: stats.registrationsByRole
    });
  } catch (error) {
    console.error('Get daily registration trends error:', error);
    res.status(500).json({ error: 'Failed to get daily registration trends' });
  }
});

// ==================== USER ACTIVITY ANALYTICS ====================

/**
 * @route GET /api/analytics/activity
 * @desc Get user activity statistics
 * @access Admin, Manager
 */
router.get('/activity', requireRole(['admin', 'manager']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
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

    const { timeRange = '30d' } = req.query;
    const stats = analyticsServices.getUserActivityStats(timeRange);
    res.json(stats);
  } catch (error) {
    console.error('Get activity stats error:', error);
    res.status(500).json({ error: 'Failed to get activity statistics' });
  }
});

/**
 * @route GET /api/analytics/activity/daily
 * @desc Get daily activity trends
 * @access Admin, Manager
 */
router.get('/activity/daily', requireRole(['admin', 'manager']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
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

    const { timeRange = '30d' } = req.query;
    const stats = analyticsServices.getUserActivityStats(timeRange);
    res.json({
      daily: stats.loginsByDay,
      byRole: stats.loginsByRole,
      failedLogins: stats.failedLogins,
      uniqueActiveUsers: stats.uniqueActiveUsers
    });
  } catch (error) {
    console.error('Get daily activity trends error:', error);
    res.status(500).json({ error: 'Failed to get daily activity trends' });
  }
});

// ==================== USER ENGAGEMENT METRICS ====================

/**
 * @route GET /api/analytics/engagement
 * @desc Get user engagement metrics
 * @access Admin, Manager
 */
router.get('/engagement', requireRole(['admin', 'manager']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
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

    const { timeRange = '30d' } = req.query;
    const metrics = analyticsServices.getUserEngagementMetrics(timeRange);
    res.json(metrics);
  } catch (error) {
    console.error('Get engagement metrics error:', error);
    res.status(500).json({ error: 'Failed to get engagement metrics' });
  }
});

/**
 * @route GET /api/analytics/engagement/retention
 * @desc Get user retention metrics
 * @access Admin, Manager
 */
router.get('/engagement/retention', requireRole(['admin', 'manager']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
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

    const { timeRange = '30d' } = req.query;
    const metrics = analyticsServices.getUserEngagementMetrics(timeRange);
    res.json({
      retention: metrics.userRetention,
      dailyActiveUsers: metrics.dailyActiveUsers,
      weeklyActiveUsers: metrics.weeklyActiveUsers,
      monthlyActiveUsers: metrics.monthlyActiveUsers
    });
  } catch (error) {
    console.error('Get retention metrics error:', error);
    res.status(500).json({ error: 'Failed to get retention metrics' });
  }
});

/**
 * @route GET /api/analytics/engagement/top-users
 * @desc Get most active users
 * @access Admin, Manager
 */
router.get('/engagement/top-users', requireRole(['admin', 'manager']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
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

    const { timeRange = '30d' } = req.query;
    const metrics = analyticsServices.getUserEngagementMetrics(timeRange);
    res.json({
      mostActiveUsers: metrics.mostActiveUsers,
      inactiveUsers: metrics.inactiveUsers
    });
  } catch (error) {
    console.error('Get top users error:', error);
    res.status(500).json({ error: 'Failed to get top users' });
  }
});

// ==================== ROLE-BASED USAGE REPORTS ====================

/**
 * @route GET /api/analytics/roles
 * @desc Get role-based usage statistics
 * @access Admin, Manager
 */
router.get('/roles', requireRole(['admin', 'manager']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
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

    const { timeRange = '30d' } = req.query;
    const stats = analyticsServices.getRoleBasedUsageStats(timeRange);
    res.json(stats);
  } catch (error) {
    console.error('Get role-based usage stats error:', error);
    res.status(500).json({ error: 'Failed to get role-based usage statistics' });
  }
});

/**
 * @route GET /api/analytics/roles/:roleName
 * @desc Get specific role usage statistics
 * @access Admin, Manager
 */
router.get('/roles/:roleName', requireRole(['admin', 'manager']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
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

    const { roleName } = req.params;
    const { timeRange = '30d' } = req.query;
    
    // Get general stats and filter by role
    const stats = analyticsServices.getRoleBasedUsageStats(timeRange);
    const roleStats = stats.roleActivity.find(role => role.role === roleName);
    const roleLogins = stats.roleLoginStats.find(role => role.role === roleName);
    
    if (!roleStats) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    res.json({
      role: roleName,
      activity: roleStats,
      logins: roleLogins,
      distribution: stats.roleDistribution.find(role => role.role === roleName)
    });
  } catch (error) {
    console.error('Get role stats error:', error);
    res.status(500).json({ error: 'Failed to get role statistics' });
  }
});

// ==================== USER PERFORMANCE TRACKING ====================

/**
 * @route GET /api/analytics/performance
 * @desc Get user performance metrics
 * @access Admin, Manager
 */
router.get('/performance', requireRole(['admin', 'manager']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
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

    const { timeRange = '30d' } = req.query;
    const metrics = analyticsServices.getUserPerformanceMetrics(timeRange);
    res.json(metrics);
  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

/**
 * @route GET /api/analytics/performance/top-performers
 * @desc Get top performing users
 * @access Admin, Manager
 */
router.get('/performance/top-performers', requireRole(['admin', 'manager']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
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

    const { timeRange = '30d' } = req.query;
    const metrics = analyticsServices.getUserPerformanceMetrics(timeRange);
    res.json({
      topPerformers: metrics.topPerformers,
      userEfficiency: metrics.userEfficiency
    });
  } catch (error) {
    console.error('Get top performers error:', error);
    res.status(500).json({ error: 'Failed to get top performers' });
  }
});

/**
 * @route GET /api/analytics/performance/user/:userId
 * @desc Get specific user performance metrics
 * @access Admin, Manager
 */
router.get('/performance/user/:userId', requireRole(['admin', 'manager']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
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

    const { userId } = req.params;
    const { timeRange = '30d' } = req.query;
    
    // Get performance metrics and filter for specific user
    const metrics = analyticsServices.getUserPerformanceMetrics(timeRange);
    const userPerformance = metrics.topPerformers.find(user => user.id === parseInt(userId));
    const userEfficiency = metrics.userEfficiency.find(user => user.id === parseInt(userId));
    
    if (!userPerformance) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      user: userPerformance,
      efficiency: userEfficiency,
      growth: metrics.userGrowth.find(user => user.id === parseInt(userId))
    });
  } catch (error) {
    console.error('Get user performance error:', error);
    res.status(500).json({ error: 'Failed to get user performance' });
  }
});

// ==================== SYSTEM HEALTH METRICS ====================

/**
 * @route GET /api/analytics/system-health
 * @desc Get system health metrics
 * @access Admin
 */
router.get('/system-health', requireRole(['admin']), async (req, res) => {
  try {
    const metrics = analyticsServices.getSystemHealthMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Get system health metrics error:', error);
    res.status(500).json({ error: 'Failed to get system health metrics' });
  }
});

/**
 * @route GET /api/analytics/system-health/recent
 * @desc Get recent system activity
 * @access Admin
 */
router.get('/system-health/recent', requireRole(['admin']), async (req, res) => {
  try {
    const metrics = analyticsServices.getSystemHealthMetrics();
    res.json({
      recentActivity: metrics.recentActivity,
      systemLoad: metrics.systemLoad,
      errorRates: metrics.errorRates
    });
  } catch (error) {
    console.error('Get recent system activity error:', error);
    res.status(500).json({ error: 'Failed to get recent system activity' });
  }
});

// ==================== EXPORT FUNCTIONS ====================

/**
 * @route GET /api/analytics/export
 * @desc Export analytics data
 * @access Admin
 */
router.get('/export', requireRole(['admin']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']),
  query('format').optional().isIn(['json', 'csv'])
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

    const { timeRange = '30d', format = 'json' } = req.query;
    const data = analyticsServices.exportUserAnalytics(timeRange, format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(data);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({ error: 'Failed to export analytics data' });
  }
});

/**
 * @route GET /api/analytics/export/registrations
 * @desc Export registration analytics
 * @access Admin
 */
router.get('/export/registrations', requireRole(['admin']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']),
  query('format').optional().isIn(['json', 'csv'])
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

    const { timeRange = '30d', format = 'json' } = req.query;
    const data = analyticsServices.getUserRegistrationStats(timeRange);
    
    if (format === 'csv') {
      const csvData = [
        ['Registration Statistics'],
        ['Metric', 'Value'],
        ['Total Registrations', data.totalRegistrations],
        ['Verification Rate (%)', data.verificationRate.percentage],
        [],
        ['Registrations by Role'],
        ['Role', 'Count'],
        ...data.registrationsByRole.map(role => [role.role, role.count]),
        [],
        ['Daily Registrations'],
        ['Date', 'Count'],
        ...data.registrationsByDay.map(day => [day.date, day.count])
      ];
      
      const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="registrations-${timeRange}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Export registration analytics error:', error);
    res.status(500).json({ error: 'Failed to export registration analytics' });
  }
});

/**
 * @route GET /api/analytics/export/activity
 * @desc Export activity analytics
 * @access Admin
 */
router.get('/export/activity', requireRole(['admin']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']),
  query('format').optional().isIn(['json', 'csv'])
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

    const { timeRange = '30d', format = 'json' } = req.query;
    const data = analyticsServices.getUserActivityStats(timeRange);
    
    if (format === 'csv') {
      const csvData = [
        ['Activity Statistics'],
        ['Metric', 'Value'],
        ['Total Logins', data.totalLogins],
        ['Failed Logins', data.failedLogins],
        ['Unique Active Users', data.uniqueActiveUsers],
        ['Average Session Duration (minutes)', data.averageSessionDuration],
        [],
        ['Logins by Role'],
        ['Role', 'Count'],
        ...data.loginsByRole.map(role => [role.role, role.count]),
        [],
        ['Daily Logins'],
        ['Date', 'Count'],
        ...data.loginsByDay.map(day => [day.date, day.count])
      ];
      
      const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="activity-${timeRange}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Export activity analytics error:', error);
    res.status(500).json({ error: 'Failed to export activity analytics' });
  }
});

/**
 * @route GET /api/analytics/export/engagement
 * @desc Export engagement analytics
 * @access Admin
 */
router.get('/export/engagement', requireRole(['admin']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']),
  query('format').optional().isIn(['json', 'csv'])
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

    const { timeRange = '30d', format = 'json' } = req.query;
    const data = analyticsServices.getUserEngagementMetrics(timeRange);
    
    if (format === 'csv') {
      const csvData = [
        ['Engagement Analytics'],
        ['Metric', 'Value'],
        ['Daily Active Users', data.dailyActiveUsers],
        ['Weekly Active Users', data.weeklyActiveUsers],
        ['Monthly Active Users', data.monthlyActiveUsers],
        ['User Retention Rate (%)', data.retentionRate],
        ['Average Session Duration (minutes)', data.averageSessionDuration],
        ['Top Active Users', data.topActiveUsers.length],
        [],
        ['Daily Active Users Trend'],
        ['Date', 'Count'],
        ...data.dailyActiveTrend.map(day => [day.date, day.count]),
        [],
        ['Top Active Users'],
        ['Name', 'Email', 'Role', 'Total Actions', 'Active Days', 'Avg Actions/Day'],
        ...data.topActiveUsers.map(user => [
          user.name, 
          user.email, 
          user.role, 
          user.total_actions, 
          user.active_days, 
          user.avg_actions_per_day || 0
        ]),
        [],
        ['User Retention Data'],
        ['Period', 'Retained Users', 'Total Users', 'Retention Rate (%)'],
        ['7 Days', data.retentionData.sevenDay.retained, data.retentionData.sevenDay.total, data.retentionData.sevenDay.rate],
        ['30 Days', data.retentionData.thirtyDay.retained, data.retentionData.thirtyDay.total, data.retentionData.thirtyDay.rate],
        ['90 Days', data.retentionData.ninetyDay.retained, data.retentionData.ninetyDay.total, data.retentionData.ninetyDay.rate]
      ];
      
      const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="engagement-${timeRange}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Export engagement analytics error:', error);
    res.status(500).json({ error: 'Failed to export engagement analytics' });
  }
});

/**
 * @route GET /api/analytics/export/performance
 * @desc Export performance analytics
 * @access Admin
 */
router.get('/export/performance', requireRole(['admin']), [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']),
  query('format').optional().isIn(['json', 'csv'])
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

    const { timeRange = '30d', format = 'json' } = req.query;
    const data = analyticsServices.getUserPerformanceMetrics(timeRange);
    
    if (format === 'csv') {
      const csvData = [
        ['Performance Analytics'],
        ['Metric', 'Value'],
        ['Total Actions Performed', data.totalActions],
        ['Average Actions Per User', data.averageActionsPerUser],
        ['Top Performers Count', data.topPerformers.length],
        ['Most Efficient Users Count', data.mostEfficientUsers.length],
        [],
        ['Top Performers'],
        ['Name', 'Email', 'Role', 'Total Actions', 'Active Days', 'Avg Actions/Day'],
        ...data.topPerformers.map(user => [
          user.name, 
          user.email, 
          user.role, 
          user.total_actions, 
          user.active_days, 
          user.avg_actions_per_day || 0
        ]),
        [],
        ['Most Efficient Users'],
        ['Name', 'Email', 'Role', 'Total Actions', 'Active Days', 'Efficiency Score'],
        ...data.mostEfficientUsers.map(user => [
          user.name, 
          user.email, 
          user.role, 
          user.total_actions, 
          user.active_days, 
          user.efficiency_score
        ]),
        [],
        ['Performance by Role'],
        ['Role', 'Total Actions', 'Average Actions', 'Active Users'],
        ...data.performanceByRole.map(role => [
          role.role, 
          role.total_actions, 
          role.average_actions, 
          role.active_users
        ])
      ];
      
      const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="performance-${timeRange}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Export performance analytics error:', error);
    res.status(500).json({ error: 'Failed to export performance analytics' });
  }
});

// ==================== MAINTENANCE FUNCTIONS ====================

/**
 * @route POST /api/analytics/cleanup
 * @desc Clean up old analytics data
 * @access Admin
 */
router.post('/cleanup', requireRole(['admin']), [
  query('daysToKeep').optional().isInt({ min: 30, max: 1095 }) // 30 days to 3 years
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

    const { daysToKeep = 365 } = req.query;
    const result = analyticsServices.cleanupOldData(parseInt(daysToKeep));
    
    res.json({
      message: 'Data cleanup completed successfully',
      result
    });
  } catch (error) {
    console.error('Data cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup old data' });
  }
});

// ==================== REAL-TIME METRICS ====================

/**
 * @route GET /api/analytics/realtime
 * @desc Get real-time system metrics
 * @access Admin
 */
router.get('/realtime', requireRole(['admin']), async (req, res) => {
  try {
    const metrics = analyticsServices.getSystemHealthMetrics();
    const dashboard = analyticsServices.getDashboardSummary();
    
    res.json({
      systemLoad: metrics.systemLoad,
      recentActivity: metrics.recentActivity.slice(0, 10), // Last 10 activities
      today: dashboard.today,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get real-time metrics error:', error);
    res.status(500).json({ error: 'Failed to get real-time metrics' });
  }
});

module.exports = router; 