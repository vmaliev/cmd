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

    // ==================== ADVANCED ANALYTICS & INSIGHTS ====================

    /**
     * Get predictive analytics and forecasting
     */
    getPredictiveAnalytics(timeRange = '90d') {
        try {
            let dateFilter;
            switch (timeRange) {
                case '30d':
                    dateFilter = "datetime('now', '-30 days')";
                    break;
                case '90d':
                    dateFilter = "datetime('now', '-90 days')";
                    break;
                case '180d':
                    dateFilter = "datetime('now', '-180 days')";
                    break;
                case '1y':
                    dateFilter = "datetime('now', '-1 year')";
                    break;
                default:
                    dateFilter = "datetime('now', '-90 days')";
            }

            // Get historical data for analysis
            const userGrowthData = this.db.prepare(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as new_users
                FROM users 
                WHERE created_at >= ${dateFilter}
                GROUP BY DATE(created_at)
                ORDER BY date
            `).all();

            const loginData = this.db.prepare(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as logins
                FROM auth_audit_log 
                WHERE action = 'login' AND success = 1 
                AND created_at >= ${dateFilter}
                GROUP BY DATE(created_at)
                ORDER BY date
            `).all();

            // Calculate trend analysis
            const userGrowthTrend = this.calculateTrend(userGrowthData, 'new_users');
            const loginTrend = this.calculateTrend(loginData, 'logins');

            // Generate forecasts
            const userGrowthForecast = this.generateForecast(userGrowthData, 'new_users', 30);
            const loginForecast = this.generateForecast(loginData, 'logins', 30);

            // Calculate seasonal patterns
            const userSeasonality = this.calculateSeasonality(userGrowthData, 'new_users');
            const loginSeasonality = this.calculateSeasonality(loginData, 'logins');

            return {
                userGrowth: {
                    trend: userGrowthTrend,
                    forecast: userGrowthForecast,
                    seasonality: userSeasonality,
                    confidence: this.calculateConfidenceInterval(userGrowthData, 'new_users')
                },
                loginActivity: {
                    trend: loginTrend,
                    forecast: loginForecast,
                    seasonality: loginSeasonality,
                    confidence: this.calculateConfidenceInterval(loginData, 'logins')
                },
                predictions: {
                    nextWeekUsers: Math.round(userGrowthForecast.nextWeek),
                    nextMonthUsers: Math.round(userGrowthForecast.nextMonth),
                    nextWeekLogins: Math.round(loginForecast.nextWeek),
                    nextMonthLogins: Math.round(loginForecast.nextMonth)
                }
            };
        } catch (error) {
            console.error('Error getting predictive analytics:', error);
            return {
                userGrowth: { trend: 0, forecast: {}, seasonality: {}, confidence: {} },
                loginActivity: { trend: 0, forecast: {}, seasonality: {}, confidence: {} },
                predictions: { nextWeekUsers: 0, nextMonthUsers: 0, nextWeekLogins: 0, nextMonthLogins: 0 }
            };
        }
    }

    /**
     * Get anomaly detection results
     */
    getAnomalyDetection(timeRange = '30d') {
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
                default:
                    dateFilter = "datetime('now', '-30 days')";
            }

            // Get data for anomaly detection
            const dailyLogins = this.db.prepare(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as login_count
                FROM auth_audit_log 
                WHERE action = 'login' AND success = 1 
                AND created_at >= ${dateFilter}
                GROUP BY DATE(created_at)
                ORDER BY date
            `).all();

            const dailyRegistrations = this.db.prepare(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as registration_count
                FROM users 
                WHERE created_at >= ${dateFilter}
                GROUP BY DATE(created_at)
                ORDER BY date
            `).all();

            const failedLogins = this.db.prepare(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as failed_count
                FROM auth_audit_log 
                WHERE action = 'login' AND success = 0 
                AND created_at >= ${dateFilter}
                GROUP BY DATE(created_at)
                ORDER BY date
            `).all();

            // Detect anomalies using multiple methods
            const loginAnomalies = this.detectAnomalies(dailyLogins, 'login_count');
            const registrationAnomalies = this.detectAnomalies(dailyRegistrations, 'registration_count');
            const failedLoginAnomalies = this.detectAnomalies(failedLogins, 'failed_count');

            return {
                loginAnomalies,
                registrationAnomalies,
                failedLoginAnomalies,
                summary: {
                    totalAnomalies: loginAnomalies.length + registrationAnomalies.length + failedLoginAnomalies.length,
                    criticalAnomalies: this.countCriticalAnomalies([...loginAnomalies, ...registrationAnomalies, ...failedLoginAnomalies]),
                    lastAnomaly: this.getLastAnomaly([...loginAnomalies, ...registrationAnomalies, ...failedLoginAnomalies])
                }
            };
        } catch (error) {
            console.error('Error getting anomaly detection:', error);
            return {
                loginAnomalies: [],
                registrationAnomalies: [],
                failedLoginAnomalies: [],
                summary: { totalAnomalies: 0, criticalAnomalies: 0, lastAnomaly: null }
            };
        }
    }

    /**
     * Get correlation analysis
     */
    getCorrelationAnalysis(timeRange = '90d') {
        try {
            let dateFilter;
            switch (timeRange) {
                case '30d':
                    dateFilter = "datetime('now', '-30 days')";
                    break;
                case '90d':
                    dateFilter = "datetime('now', '-90 days')";
                    break;
                case '180d':
                    dateFilter = "datetime('now', '-180 days')";
                    break;
                default:
                    dateFilter = "datetime('now', '-90 days')";
            }

            // Get daily metrics for correlation analysis
            const dailyMetrics = this.db.prepare(`
                SELECT 
                    DATE(u.created_at) as date,
                    COUNT(DISTINCT u.id) as new_users,
                    COUNT(DISTINCT a.user_id) as active_users,
                    COUNT(CASE WHEN a.action = 'login' AND a.success = 1 THEN 1 END) as successful_logins,
                    COUNT(CASE WHEN a.action = 'login' AND a.success = 0 THEN 1 END) as failed_logins,
                    COUNT(DISTINCT CASE WHEN a.action = 'login' THEN a.user_id END) as unique_logins
                FROM users u
                LEFT JOIN auth_audit_log a ON DATE(u.created_at) = DATE(a.created_at)
                WHERE u.created_at >= ${dateFilter} OR a.created_at >= ${dateFilter}
                GROUP BY DATE(u.created_at)
                ORDER BY date
            `).all();

            // Calculate correlations
            const correlations = {
                userActivityVsLogins: this.calculateCorrelation(dailyMetrics, 'new_users', 'successful_logins'),
                failedLoginsVsActivity: this.calculateCorrelation(dailyMetrics, 'new_users', 'failed_logins'),
                activeUsersVsLogins: this.calculateCorrelation(dailyMetrics, 'active_users', 'successful_logins'),
                uniqueLoginsVsTotal: this.calculateCorrelation(dailyMetrics, 'unique_logins', 'successful_logins')
            };

            // Get role-based correlations
            const roleCorrelations = this.getRoleBasedCorrelations(dateFilter);

            return {
                dailyCorrelations: correlations,
                roleCorrelations,
                insights: this.generateCorrelationInsights(correlations, roleCorrelations)
            };
        } catch (error) {
            console.error('Error getting correlation analysis:', error);
            return {
                dailyCorrelations: {},
                roleCorrelations: {},
                insights: []
            };
        }
    }

    /**
     * Get actionable insights and recommendations
     */
    getActionableInsights(timeRange = '90d') {
        try {
            const predictiveAnalytics = this.getPredictiveAnalytics(timeRange);
            const anomalyDetection = this.getAnomalyDetection(timeRange);
            const correlationAnalysis = this.getCorrelationAnalysis(timeRange);
            const performanceMetrics = this.getUserPerformanceMetrics(timeRange);

            const insights = [];

            // Growth insights
            if (predictiveAnalytics.userGrowth.trend > 0.1) {
                insights.push({
                    type: 'growth',
                    priority: 'high',
                    title: 'Strong User Growth Detected',
                    description: `User growth is trending upward at ${(predictiveAnalytics.userGrowth.trend * 100).toFixed(1)}% per day`,
                    recommendation: 'Consider scaling infrastructure and adding more support resources',
                    impact: 'high',
                    confidence: predictiveAnalytics.userGrowth.confidence.level
                });
            }

            // Anomaly insights
            if (anomalyDetection.summary.criticalAnomalies > 0) {
                insights.push({
                    type: 'anomaly',
                    priority: 'critical',
                    title: 'Critical Anomalies Detected',
                    description: `${anomalyDetection.summary.criticalAnomalies} critical anomalies found in system behavior`,
                    recommendation: 'Investigate recent system changes and monitor for security issues',
                    impact: 'critical',
                    confidence: 'high'
                });
            }

            // Performance insights
            const avgEfficiency = performanceMetrics.averageEfficiency || 0;
            if (avgEfficiency < 0.7) {
                insights.push({
                    type: 'performance',
                    priority: 'medium',
                    title: 'Low User Efficiency Detected',
                    description: `Average user efficiency is ${(avgEfficiency * 100).toFixed(1)}%`,
                    recommendation: 'Consider user training programs and interface improvements',
                    impact: 'medium',
                    confidence: 'medium'
                });
            }

            // Correlation insights
            if (correlationAnalysis.dailyCorrelations.failedLoginsVsActivity > 0.5) {
                insights.push({
                    type: 'security',
                    priority: 'high',
                    title: 'High Failed Login Correlation',
                    description: 'Failed logins strongly correlate with user activity',
                    recommendation: 'Review authentication system and consider additional security measures',
                    impact: 'high',
                    confidence: 'medium'
                });
            }

            // Resource optimization insights
            const predictedGrowth = predictiveAnalytics.predictions.nextMonthUsers;
            if (predictedGrowth > 100) {
                insights.push({
                    type: 'resource',
                    priority: 'medium',
                    title: 'Resource Planning Required',
                    description: `Expected ${predictedGrowth} new users in the next month`,
                    recommendation: 'Plan for infrastructure scaling and additional support staff',
                    impact: 'medium',
                    confidence: predictiveAnalytics.userGrowth.confidence.level
                });
            }

            return {
                insights,
                summary: {
                    totalInsights: insights.length,
                    criticalInsights: insights.filter(i => i.priority === 'critical').length,
                    highPriorityInsights: insights.filter(i => i.priority === 'high').length,
                    averageConfidence: insights.length > 0 ? 
                        (insights.reduce((sum, i) => sum + (i.confidence === 'high' ? 1 : i.confidence === 'medium' ? 0.5 : 0), 0) / insights.length) : 0
                }
            };
        } catch (error) {
            console.error('Error getting actionable insights:', error);
            return {
                insights: [],
                summary: { totalInsights: 0, criticalInsights: 0, highPriorityInsights: 0, averageConfidence: 0 }
            };
        }
    }

    // ==================== STATISTICAL HELPER METHODS ====================

    /**
     * Calculate linear trend from time series data
     */
    calculateTrend(data, valueKey) {
        if (data.length < 2) return 0;

        const n = data.length;
        const xValues = Array.from({ length: n }, (_, i) => i);
        const yValues = data.map(item => item[valueKey] || 0);

        const sumX = xValues.reduce((sum, x) => sum + x, 0);
        const sumY = yValues.reduce((sum, y) => sum + y, 0);
        const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
        const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        return slope;
    }

    /**
     * Generate forecast using linear regression
     */
    generateForecast(data, valueKey, daysAhead) {
        if (data.length < 2) return { nextWeek: 0, nextMonth: 0 };

        const trend = this.calculateTrend(data, valueKey);
        const recentValues = data.slice(-7).map(item => item[valueKey] || 0);
        const averageRecent = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;

        return {
            nextWeek: averageRecent + (trend * 7),
            nextMonth: averageRecent + (trend * 30),
            trend: trend,
            confidence: this.calculateForecastConfidence(data, valueKey)
        };
    }

    /**
     * Calculate seasonality patterns
     */
    calculateSeasonality(data, valueKey) {
        if (data.length < 7) return { weekly: {}, monthly: {} };

        const weeklyPattern = {};
        const monthlyPattern = {};

        // Weekly pattern (day of week)
        for (let i = 0; i < 7; i++) {
            const dayData = data.filter(item => new Date(item.date).getDay() === i);
            weeklyPattern[i] = dayData.length > 0 ? 
                dayData.reduce((sum, item) => sum + (item[valueKey] || 0), 0) / dayData.length : 0;
        }

        // Monthly pattern (day of month)
        for (let i = 1; i <= 31; i++) {
            const dayData = data.filter(item => new Date(item.date).getDate() === i);
            monthlyPattern[i] = dayData.length > 0 ? 
                dayData.reduce((sum, item) => sum + (item[valueKey] || 0), 0) / dayData.length : 0;
        }

        return { weekly: weeklyPattern, monthly: monthlyPattern };
    }

    /**
     * Detect anomalies using statistical methods
     */
    detectAnomalies(data, valueKey) {
        if (data.length < 3) return [];

        const values = data.map(item => item[valueKey] || 0);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        const anomalies = [];
        data.forEach((item, index) => {
            const value = item[valueKey] || 0;
            const zScore = Math.abs((value - mean) / stdDev);
            
            if (zScore > 2.5) { // 2.5 standard deviations
                anomalies.push({
                    date: item.date,
                    value: value,
                    zScore: zScore,
                    severity: zScore > 3.5 ? 'critical' : zScore > 2.5 ? 'high' : 'medium',
                    type: value > mean ? 'spike' : 'drop',
                    expectedRange: [mean - 2 * stdDev, mean + 2 * stdDev]
                });
            }
        });

        return anomalies;
    }

    /**
     * Calculate correlation coefficient between two variables
     */
    calculateCorrelation(data, key1, key2) {
        if (data.length < 2) return 0;

        const values1 = data.map(item => item[key1] || 0);
        const values2 = data.map(item => item[key2] || 0);

        const mean1 = values1.reduce((sum, val) => sum + val, 0) / values1.length;
        const mean2 = values2.reduce((sum, val) => sum + val, 0) / values2.length;

        const numerator = values1.reduce((sum, val, i) => sum + (val - mean1) * (values2[i] - mean2), 0);
        const denominator1 = Math.sqrt(values1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0));
        const denominator2 = Math.sqrt(values2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0));

        return denominator1 * denominator2 !== 0 ? numerator / (denominator1 * denominator2) : 0;
    }

    /**
     * Calculate confidence interval for predictions
     */
    calculateConfidenceInterval(data, valueKey) {
        if (data.length < 2) return { level: 'low', interval: [0, 0] };

        const values = data.map(item => item[valueKey] || 0);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
        const marginOfError = 1.96 * stdDev / Math.sqrt(values.length); // 95% confidence

        return {
            level: values.length > 30 ? 'high' : values.length > 10 ? 'medium' : 'low',
            interval: [Math.max(0, mean - marginOfError), mean + marginOfError],
            marginOfError: marginOfError
        };
    }

    /**
     * Calculate forecast confidence
     */
    calculateForecastConfidence(data, valueKey) {
        const confidence = this.calculateConfidenceInterval(data, valueKey);
        return confidence.level;
    }

    /**
     * Get role-based correlations
     */
    getRoleBasedCorrelations(dateFilter) {
        try {
            const roleData = this.db.prepare(`
                SELECT 
                    u.role,
                    COUNT(DISTINCT u.id) as user_count,
                    COUNT(DISTINCT a.user_id) as active_users,
                    COUNT(CASE WHEN a.action = 'login' AND a.success = 1 THEN 1 END) as successful_logins,
                    AVG(CASE WHEN a.action = 'login' THEN 1 ELSE 0 END) as login_rate
                FROM users u
                LEFT JOIN auth_audit_log a ON u.id = a.user_id AND a.created_at >= ${dateFilter}
                WHERE u.created_at >= ${dateFilter}
                GROUP BY u.role
            `).all();

            return roleData.map(role => ({
                role: role.role,
                userCount: role.user_count,
                activeRate: role.user_count > 0 ? role.active_users / role.user_count : 0,
                loginRate: role.login_rate || 0,
                engagementScore: role.user_count > 0 ? (role.active_users / role.user_count) * role.login_rate : 0
            }));
        } catch (error) {
            console.error('Error getting role-based correlations:', error);
            return [];
        }
    }

    /**
     * Generate correlation insights
     */
    generateCorrelationInsights(correlations, roleCorrelations) {
        const insights = [];

        if (Math.abs(correlations.userActivityVsLogins) > 0.7) {
            insights.push('Strong correlation between new user registrations and login activity');
        }

        if (correlations.failedLoginsVsActivity > 0.5) {
            insights.push('Failed logins correlate with user activity - potential security concern');
        }

        const highEngagementRoles = roleCorrelations.filter(r => r.engagementScore > 0.5);
        if (highEngagementRoles.length > 0) {
            insights.push(`High engagement roles: ${highEngagementRoles.map(r => r.role).join(', ')}`);
        }

        return insights;
    }

    /**
     * Count critical anomalies
     */
    countCriticalAnomalies(anomalies) {
        return anomalies.filter(a => a.severity === 'critical').length;
    }

    /**
     * Get last anomaly
     */
    getLastAnomaly(anomalies) {
        if (anomalies.length === 0) return null;
        return anomalies.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
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