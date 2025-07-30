const Database = require('better-sqlite3');
const path = require('path');

class AnalyticsServices {
    constructor(dbPath = path.join(__dirname, 'it_support.db')) {
        this.db = new Database(dbPath);
    }

    // ==================== USER REGISTRATION ANALYTICS ====================

    /**
     * Get user registration statistics
     */
    getUserRegistrationStats(timeRange = '30d') {
        try {
            let dateFilter;
            switch (timeRange) {
                case '7d':
                    dateFilter = "datetime('now', '-7 days')";
                    break;
                case '30d':
                    dateFilter = "datetime('now', '-30 days')";
                    break;
                case '90d':
                    dateFilter = "datetime('now', '-90 days')";
                    break;
                case '1y':
                    dateFilter = "datetime('now', '-1 year')";
                    break;
                default:
                    dateFilter = "datetime('now', '-30 days')";
            }

            const stats = {
                totalRegistrations: this.db.prepare(`
                    SELECT COUNT(*) as count FROM users 
                    WHERE created_at >= ${dateFilter}
                `).get().count,
                
                registrationsByRole: this.db.prepare(`
                    SELECT role, COUNT(*) as count 
                    FROM users 
                    WHERE created_at >= ${dateFilter}
                    GROUP BY role
                    ORDER BY count DESC
                `).all(),
                
                registrationsByDay: this.db.prepare(`
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as count
                    FROM users 
                    WHERE created_at >= ${dateFilter}
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                `).all(),
                
                registrationsByMonth: this.db.prepare(`
                    SELECT 
                        strftime('%Y-%m', created_at) as month,
                        COUNT(*) as count
                    FROM users 
                    WHERE created_at >= ${dateFilter}
                    GROUP BY strftime('%Y-%m', created_at)
                    ORDER BY month DESC
                `).all(),
                
                verificationRate: this.db.prepare(`
                    SELECT 
                        COUNT(CASE WHEN is_verified = 1 THEN 1 END) as verified,
                        COUNT(*) as total
                    FROM users 
                    WHERE created_at >= ${dateFilter}
                `).get()
            };

            stats.verificationRate.percentage = stats.verificationRate.total > 0 
                ? (stats.verificationRate.verified / stats.verificationRate.total * 100).toFixed(2)
                : 0;

            return stats;
        } catch (error) {
            console.error('Error getting user registration stats:', error);
            return {
                totalRegistrations: 0,
                registrationsByRole: [],
                registrationsByDay: [],
                registrationsByMonth: [],
                verificationRate: { verified: 0, total: 0, percentage: 0 }
            };
        }
    }

    // ==================== USER ACTIVITY ANALYTICS ====================

    /**
     * Get user activity statistics
     */
    getUserActivityStats(timeRange = '30d') {
        try {
            let dateFilter;
            switch (timeRange) {
                case '7d':
                    dateFilter = "datetime('now', '-7 days')";
                    break;
                case '30d':
                    dateFilter = "datetime('now', '-30 days')";
                    break;
                case '90d':
                    dateFilter = "datetime('now', '-90 days')";
                    break;
                case '1y':
                    dateFilter = "datetime('now', '-1 year')";
                    break;
                default:
                    dateFilter = "datetime('now', '-30 days')";
            }

            const stats = {
                totalLogins: this.db.prepare(`
                    SELECT COUNT(*) as count 
                    FROM auth_audit_log 
                    WHERE action = 'login' AND success = 1 
                    AND created_at >= ${dateFilter}
                `).get().count,
                
                loginsByDay: this.db.prepare(`
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as count
                    FROM auth_audit_log 
                    WHERE action = 'login' AND success = 1 
                    AND created_at >= ${dateFilter}
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                `).all(),
                
                loginsByRole: this.db.prepare(`
                    SELECT 
                        u.role,
                        COUNT(*) as count
                    FROM auth_audit_log aal
                    JOIN users u ON aal.user_id = u.id
                    WHERE aal.action = 'login' AND aal.success = 1 
                    AND aal.created_at >= ${dateFilter}
                    GROUP BY u.role
                    ORDER BY count DESC
                `).all(),
                
                failedLogins: this.db.prepare(`
                    SELECT COUNT(*) as count 
                    FROM auth_audit_log 
                    WHERE action = 'login' AND success = 0 
                    AND created_at >= ${dateFilter}
                `).get().count,
                
                uniqueActiveUsers: this.db.prepare(`
                    SELECT COUNT(DISTINCT user_id) as count 
                    FROM auth_audit_log 
                    WHERE created_at >= ${dateFilter}
                `).get().count,
                
                averageSessionDuration: this.db.prepare(`
                    SELECT AVG(
                        CAST(
                            (julianday(logout_time) - julianday(login_time)) * 24 * 60 
                            AS INTEGER
                        )
                    ) as avg_minutes
                    FROM (
                        SELECT 
                            user_id,
                            created_at as login_time,
                            LEAD(created_at) OVER (
                                PARTITION BY user_id 
                                ORDER BY created_at
                            ) as logout_time
                        FROM auth_audit_log 
                        WHERE action IN ('login', 'logout')
                        AND created_at >= ${dateFilter}
                    ) sessions
                    WHERE logout_time IS NOT NULL
                `).get().avg_minutes || 0
            };

            return stats;
        } catch (error) {
            console.error('Error getting user activity stats:', error);
            return {
                totalLogins: 0,
                loginsByDay: [],
                loginsByRole: [],
                failedLogins: 0,
                uniqueActiveUsers: 0,
                averageSessionDuration: 0
            };
        }
    }

    // ==================== USER ENGAGEMENT METRICS ====================

    /**
     * Get user engagement metrics
     */
    getUserEngagementMetrics(timeRange = '30d') {
        try {
            let dateFilter;
            switch (timeRange) {
                case '7d':
                    dateFilter = "datetime('now', '-7 days')";
                    break;
                case '30d':
                    dateFilter = "datetime('now', '-30 days')";
                    break;
                case '90d':
                    dateFilter = "datetime('now', '-90 days')";
                    break;
                case '1y':
                    dateFilter = "datetime('now', '-1 year')";
                    break;
                default:
                    dateFilter = "datetime('now', '-30 days')";
            }

            const metrics = {
                dailyActiveUsers: this.db.prepare(`
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(DISTINCT user_id) as count
                    FROM auth_audit_log 
                    WHERE created_at >= ${dateFilter}
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                `).all(),
                
                weeklyActiveUsers: this.db.prepare(`
                    SELECT 
                        strftime('%Y-W%W', created_at) as week,
                        COUNT(DISTINCT user_id) as count
                    FROM auth_audit_log 
                    WHERE created_at >= ${dateFilter}
                    GROUP BY strftime('%Y-W%W', created_at)
                    ORDER BY week DESC
                `).all(),
                
                monthlyActiveUsers: this.db.prepare(`
                    SELECT 
                        strftime('%Y-%m', created_at) as month,
                        COUNT(DISTINCT user_id) as count
                    FROM auth_audit_log 
                    WHERE created_at >= ${dateFilter}
                    GROUP BY strftime('%Y-%m', created_at)
                    ORDER BY month DESC
                `).all(),
                
                userRetention: this.calculateUserRetention(dateFilter),
                
                mostActiveUsers: this.db.prepare(`
                    SELECT 
                        u.id,
                        u.name,
                        u.email,
                        u.role,
                        COUNT(*) as activity_count
                    FROM auth_audit_log aal
                    JOIN users u ON aal.user_id = u.id
                    WHERE aal.created_at >= ${dateFilter}
                    GROUP BY u.id, u.name, u.email, u.role
                    ORDER BY activity_count DESC
                    LIMIT 10
                `).all(),
                
                inactiveUsers: this.db.prepare(`
                    SELECT 
                        u.id,
                        u.name,
                        u.email,
                        u.role,
                        u.last_login,
                        u.created_at
                    FROM users u
                    WHERE u.is_active = 1
                    AND (u.last_login IS NULL OR u.last_login < ${dateFilter})
                    ORDER BY u.last_login DESC NULLS LAST
                `).all()
            };

            return metrics;
        } catch (error) {
            console.error('Error getting user engagement metrics:', error);
            return {
                dailyActiveUsers: [],
                weeklyActiveUsers: [],
                monthlyActiveUsers: [],
                userRetention: {},
                mostActiveUsers: [],
                inactiveUsers: []
            };
        }
    }

    /**
     * Calculate user retention rates
     */
    calculateUserRetention(dateFilter) {
        try {
            // This is a simplified retention calculation
            // In a real system, you'd want more sophisticated cohort analysis
            const totalUsers = this.db.prepare(`
                SELECT COUNT(*) as count FROM users 
                WHERE created_at >= ${dateFilter}
            `).get().count;

            const activeUsers = this.db.prepare(`
                SELECT COUNT(DISTINCT user_id) as count 
                FROM auth_audit_log 
                WHERE created_at >= ${dateFilter}
            `).get().count;

            const retentionRate = totalUsers > 0 ? (activeUsers / totalUsers * 100).toFixed(2) : 0;

            return {
                totalUsers,
                activeUsers,
                retentionRate: parseFloat(retentionRate)
            };
        } catch (error) {
            console.error('Error calculating user retention:', error);
            return { totalUsers: 0, activeUsers: 0, retentionRate: 0 };
        }
    }

    // ==================== ROLE-BASED USAGE REPORTS ====================

    /**
     * Get role-based usage statistics
     */
    getRoleBasedUsageStats(timeRange = '30d') {
        try {
            let dateFilter;
            switch (timeRange) {
                case '7d':
                    dateFilter = "datetime('now', '-7 days')";
                    break;
                case '30d':
                    dateFilter = "datetime('now', '-30 days')";
                    break;
                case '90d':
                    dateFilter = "datetime('now', '-90 days')";
                    break;
                case '1y':
                    dateFilter = "datetime('now', '-1 year')";
                    break;
                default:
                    dateFilter = "datetime('now', '-30 days')";
            }

            const stats = {
                roleDistribution: this.db.prepare(`
                    SELECT 
                        role,
                        COUNT(*) as count,
                        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users), 2) as percentage
                    FROM users 
                    WHERE created_at >= ${dateFilter}
                    GROUP BY role
                    ORDER BY count DESC
                `).all(),
                
                roleActivity: this.db.prepare(`
                    SELECT 
                        u.role,
                        COUNT(*) as total_actions,
                        COUNT(DISTINCT aal.user_id) as active_users,
                        AVG(actions_per_user.count) as avg_actions_per_user
                    FROM auth_audit_log aal
                    JOIN users u ON aal.user_id = u.id
                    JOIN (
                        SELECT user_id, COUNT(*) as count
                        FROM auth_audit_log
                        WHERE created_at >= ${dateFilter}
                        GROUP BY user_id
                    ) actions_per_user ON aal.user_id = actions_per_user.user_id
                    WHERE aal.created_at >= ${dateFilter}
                    GROUP BY u.role
                    ORDER BY total_actions DESC
                `).all(),
                
                roleLoginStats: this.db.prepare(`
                    SELECT 
                        u.role,
                        COUNT(*) as total_logins,
                        COUNT(DISTINCT aal.user_id) as unique_users,
                        AVG(logins_per_user.count) as avg_logins_per_user
                    FROM auth_audit_log aal
                    JOIN users u ON aal.user_id = u.id
                    JOIN (
                        SELECT user_id, COUNT(*) as count
                        FROM auth_audit_log
                        WHERE action = 'login' AND success = 1
                        AND created_at >= ${dateFilter}
                        GROUP BY user_id
                    ) logins_per_user ON aal.user_id = logins_per_user.user_id
                    WHERE aal.action = 'login' AND aal.success = 1
                    AND aal.created_at >= ${dateFilter}
                    GROUP BY u.role
                    ORDER BY total_logins DESC
                `).all()
            };

            return stats;
        } catch (error) {
            console.error('Error getting role-based usage stats:', error);
            return {
                roleDistribution: [],
                roleActivity: [],
                roleLoginStats: []
            };
        }
    }

    // ==================== USER PERFORMANCE TRACKING ====================

    /**
     * Get user performance metrics
     */
    getUserPerformanceMetrics(timeRange = '30d') {
        try {
            let dateFilter;
            switch (timeRange) {
                case '7d':
                    dateFilter = "datetime('now', '-7 days')";
                    break;
                case '30d':
                    dateFilter = "datetime('now', '-30 days')";
                    break;
                case '90d':
                    dateFilter = "datetime('now', '-90 days')";
                    break;
                case '1y':
                    dateFilter = "datetime('now', '-1 year')";
                    break;
                default:
                    dateFilter = "datetime('now', '-30 days')";
            }

            const metrics = {
                topPerformers: this.db.prepare(`
                    SELECT 
                        u.id,
                        u.name,
                        u.email,
                        u.role,
                        COUNT(*) as total_actions,
                        COUNT(DISTINCT DATE(aal.created_at)) as active_days,
                        AVG(actions_per_day.count) as avg_actions_per_day
                    FROM auth_audit_log aal
                    JOIN users u ON aal.user_id = u.id
                    JOIN (
                        SELECT 
                            user_id,
                            DATE(created_at) as date,
                            COUNT(*) as count
                        FROM auth_audit_log
                        WHERE created_at >= ${dateFilter}
                        GROUP BY user_id, DATE(created_at)
                    ) actions_per_day ON aal.user_id = actions_per_day.user_id
                    WHERE aal.created_at >= ${dateFilter}
                    GROUP BY u.id, u.name, u.email, u.role
                    ORDER BY total_actions DESC
                    LIMIT 20
                `).all(),
                
                userEfficiency: this.db.prepare(`
                    SELECT 
                        u.id,
                        u.name,
                        u.email,
                        u.role,
                        COUNT(*) as total_actions,
                        COUNT(DISTINCT DATE(aal.created_at)) as active_days,
                        ROUND(
                            CAST(COUNT(*) AS FLOAT) / 
                            NULLIF(COUNT(DISTINCT DATE(aal.created_at)), 0), 2
                        ) as efficiency_score
                    FROM auth_audit_log aal
                    JOIN users u ON aal.user_id = u.id
                    WHERE aal.created_at >= ${dateFilter}
                    GROUP BY u.id, u.name, u.email, u.role
                    HAVING active_days > 0
                    ORDER BY efficiency_score DESC
                    LIMIT 20
                `).all(),
                
                userGrowth: this.db.prepare(`
                    SELECT 
                        u.id,
                        u.name,
                        u.email,
                        u.role,
                        u.created_at,
                        COUNT(aal.id) as total_actions,
                        MAX(aal.created_at) as last_activity
                    FROM users u
                    LEFT JOIN auth_audit_log aal ON u.id = aal.user_id
                    WHERE u.created_at >= ${dateFilter}
                    GROUP BY u.id, u.name, u.email, u.role, u.created_at
                    ORDER BY u.created_at DESC
                `).all()
            };

            return metrics;
        } catch (error) {
            console.error('Error getting user performance metrics:', error);
            return {
                topPerformers: [],
                userEfficiency: [],
                userGrowth: []
            };
        }
    }

    // ==================== SYSTEM HEALTH METRICS ====================

    /**
     * Get system health metrics
     */
    getSystemHealthMetrics() {
        try {
            const metrics = {
                databaseStats: {
                    totalUsers: this.db.prepare('SELECT COUNT(*) as count FROM users').get().count,
                    activeUsers: this.db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count,
                    totalSessions: this.db.prepare('SELECT COUNT(*) as count FROM user_sessions').get().count,
                    totalAuditLogs: this.db.prepare('SELECT COUNT(*) as count FROM auth_audit_log').get().count
                },
                
                recentActivity: this.db.prepare(`
                    SELECT 
                        action,
                        COUNT(*) as count,
                        COUNT(CASE WHEN success = 1 THEN 1 END) as successful,
                        COUNT(CASE WHEN success = 0 THEN 1 END) as failed
                    FROM auth_audit_log 
                    WHERE created_at >= datetime('now', '-24 hours')
                    GROUP BY action
                    ORDER BY count DESC
                `).all(),
                
                errorRates: this.db.prepare(`
                    SELECT 
                        action,
                        COUNT(*) as total,
                        COUNT(CASE WHEN success = 0 THEN 1 END) as failed,
                        ROUND(
                            CAST(COUNT(CASE WHEN success = 0 THEN 1 END) AS FLOAT) / 
                            COUNT(*) * 100, 2
                        ) as error_rate
                    FROM auth_audit_log 
                    WHERE created_at >= datetime('now', '-7 days')
                    GROUP BY action
                    HAVING total > 10
                    ORDER BY error_rate DESC
                `).all(),
                
                systemLoad: {
                    recentLogins: this.db.prepare(`
                        SELECT COUNT(*) as count 
                        FROM auth_audit_log 
                        WHERE action = 'login' 
                        AND created_at >= datetime('now', '-1 hour')
                    `).get().count,
                    
                    activeSessions: this.db.prepare(`
                        SELECT COUNT(*) as count 
                        FROM user_sessions 
                        WHERE expires_at > datetime('now')
                    `).get().count,
                    
                    failedAttempts: this.db.prepare(`
                        SELECT COUNT(*) as count 
                        FROM auth_audit_log 
                        WHERE action = 'login' AND success = 0
                        AND created_at >= datetime('now', '-1 hour')
                    `).get().count
                }
            };

            return metrics;
        } catch (error) {
            console.error('Error getting system health metrics:', error);
            return {
                databaseStats: { totalUsers: 0, activeUsers: 0, totalSessions: 0, totalAuditLogs: 0 },
                recentActivity: [],
                errorRates: [],
                systemLoad: { recentLogins: 0, activeSessions: 0, failedAttempts: 0 }
            };
        }
    }

    // ==================== EXPORT FUNCTIONS ====================

    /**
     * Export user analytics data
     */
    exportUserAnalytics(timeRange = '30d', format = 'json') {
        try {
            const data = {
                registrationStats: this.getUserRegistrationStats(timeRange),
                activityStats: this.getUserActivityStats(timeRange),
                engagementMetrics: this.getUserEngagementMetrics(timeRange),
                roleBasedUsage: this.getRoleBasedUsageStats(timeRange),
                performanceMetrics: this.getUserPerformanceMetrics(timeRange),
                systemHealth: this.getSystemHealthMetrics(),
                exportDate: new Date().toISOString(),
                timeRange: timeRange
            };

            if (format === 'csv') {
                return this.convertToCSV(data);
            }

            return data;
        } catch (error) {
            console.error('Error exporting user analytics:', error);
            throw error;
        }
    }

    /**
     * Convert analytics data to CSV format
     */
    convertToCSV(data) {
        const csvData = [];
        
        // Registration stats
        csvData.push(['User Registration Statistics']);
        csvData.push(['Metric', 'Value']);
        csvData.push(['Total Registrations', data.registrationStats.totalRegistrations]);
        csvData.push(['Verification Rate (%)', data.registrationStats.verificationRate.percentage]);
        csvData.push([]);
        
        // Role distribution
        csvData.push(['Role Distribution']);
        csvData.push(['Role', 'Count', 'Percentage']);
        data.registrationStats.registrationsByRole.forEach(role => {
            csvData.push([role.role, role.count, 'N/A']);
        });
        csvData.push([]);
        
        // Activity stats
        csvData.push(['User Activity Statistics']);
        csvData.push(['Metric', 'Value']);
        csvData.push(['Total Logins', data.activityStats.totalLogins]);
        csvData.push(['Failed Logins', data.activityStats.failedLogins]);
        csvData.push(['Unique Active Users', data.activityStats.uniqueActiveUsers]);
        csvData.push(['Average Session Duration (minutes)', data.activityStats.averageSessionDuration]);
        csvData.push([]);
        
        // Top performers
        csvData.push(['Top Performers']);
        csvData.push(['Name', 'Email', 'Role', 'Total Actions', 'Active Days', 'Avg Actions/Day']);
        data.performanceMetrics.topPerformers.forEach(user => {
            csvData.push([
                user.name,
                user.email,
                user.role,
                user.total_actions,
                user.active_days,
                user.avg_actions_per_day
            ]);
        });

        return csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Clean up old analytics data
     */
    cleanupOldData(daysToKeep = 365) {
        try {
            const cutoffDate = `datetime('now', '-${daysToKeep} days')`;
            
            // Clean up old audit logs
            const auditResult = this.db.prepare(`
                DELETE FROM auth_audit_log 
                WHERE created_at < ${cutoffDate}
            `).run();
            
            // Clean up old sessions
            const sessionResult = this.db.prepare(`
                DELETE FROM user_sessions 
                WHERE expires_at < datetime('now')
            `).run();
            
            return {
                auditLogsDeleted: auditResult.changes,
                sessionsDeleted: sessionResult.changes
            };
        } catch (error) {
            console.error('Error cleaning up old data:', error);
            throw error;
        }
    }

    /**
     * Get analytics summary for dashboard
     */
    getDashboardSummary() {
        try {
            return {
                today: {
                    registrations: this.db.prepare(`
                        SELECT COUNT(*) as count FROM users 
                        WHERE DATE(created_at) = DATE('now')
                    `).get().count,
                    logins: this.db.prepare(`
                        SELECT COUNT(*) as count FROM auth_audit_log 
                        WHERE action = 'login' AND success = 1 
                        AND DATE(created_at) = DATE('now')
                    `).get().count,
                    activeUsers: this.db.prepare(`
                        SELECT COUNT(DISTINCT user_id) as count 
                        FROM auth_audit_log 
                        WHERE DATE(created_at) = DATE('now')
                    `).get().count
                },
                thisWeek: {
                    registrations: this.db.prepare(`
                        SELECT COUNT(*) as count FROM users 
                        WHERE created_at >= datetime('now', '-7 days')
                    `).get().count,
                    logins: this.db.prepare(`
                        SELECT COUNT(*) as count FROM auth_audit_log 
                        WHERE action = 'login' AND success = 1 
                        AND created_at >= datetime('now', '-7 days')
                    `).get().count,
                    activeUsers: this.db.prepare(`
                        SELECT COUNT(DISTINCT user_id) as count 
                        FROM auth_audit_log 
                        WHERE created_at >= datetime('now', '-7 days')
                    `).get().count
                },
                thisMonth: {
                    registrations: this.db.prepare(`
                        SELECT COUNT(*) as count FROM users 
                        WHERE created_at >= datetime('now', '-30 days')
                    `).get().count,
                    logins: this.db.prepare(`
                        SELECT COUNT(*) as count FROM auth_audit_log 
                        WHERE action = 'login' AND success = 1 
                        AND created_at >= datetime('now', '-30 days')
                    `).get().count,
                    activeUsers: this.db.prepare(`
                        SELECT COUNT(DISTINCT user_id) as count 
                        FROM auth_audit_log 
                        WHERE created_at >= datetime('now', '-30 days')
                    `).get().count
                }
            };
        } catch (error) {
            console.error('Error getting dashboard summary:', error);
            return {
                today: { registrations: 0, logins: 0, activeUsers: 0 },
                thisWeek: { registrations: 0, logins: 0, activeUsers: 0 },
                thisMonth: { registrations: 0, logins: 0, activeUsers: 0 }
            };
        }
    }
}

module.exports = AnalyticsServices; 