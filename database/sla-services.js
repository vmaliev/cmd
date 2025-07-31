const dbManager = require('./db');

class SLAServices {
    constructor() {
        this.db = dbManager.getDb();
    }

    // ==================== SLA RULES MANAGEMENT ====================

    /**
     * Get all SLA rules
     */
    getAllSLARules() {
        return this.db.prepare(`
            SELECT sr.*, tp.name as priority_name, tp.color as priority_color
            FROM sla_rules sr
            LEFT JOIN ticket_priorities tp ON sr.priority_id = tp.id
            WHERE sr.is_active = 1
            ORDER BY tp.id
        `).all();
    }

    /**
     * Get SLA rule by ID
     */
    getSLARuleById(id) {
        return this.db.prepare(`
            SELECT sr.*, tp.name as priority_name, tp.color as priority_color
            FROM sla_rules sr
            LEFT JOIN ticket_priorities tp ON sr.priority_id = tp.id
            WHERE sr.id = ?
        `).get(id);
    }

    /**
     * Get SLA rule by priority ID
     */
    getSLARuleByPriorityId(priorityId) {
        return this.db.prepare(`
            SELECT sr.*, tp.name as priority_name, tp.color as priority_color
            FROM sla_rules sr
            LEFT JOIN ticket_priorities tp ON sr.priority_id = tp.id
            WHERE sr.priority_id = ? AND sr.is_active = 1
        `).get(priorityId);
    }

    /**
     * Create new SLA rule
     */
    createSLARule(ruleData) {
        const result = this.db.prepare(`
            INSERT INTO sla_rules (
                priority_id, name, description, initial_response_hours,
                resolution_hours, escalation_levels, escalation_interval_hours
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            ruleData.priority_id,
            ruleData.name,
            ruleData.description,
            ruleData.initial_response_hours,
            ruleData.resolution_hours,
            ruleData.escalation_levels,
            ruleData.escalation_interval_hours
        );
        return this.getSLARuleById(result.lastInsertRowid);
    }

    /**
     * Update SLA rule
     */
    updateSLARule(id, ruleData) {
        const updateFields = [];
        const updateValues = [];

        if (ruleData.name !== undefined) {
            updateFields.push('name = ?');
            updateValues.push(ruleData.name);
        }
        if (ruleData.description !== undefined) {
            updateFields.push('description = ?');
            updateValues.push(ruleData.description);
        }
        if (ruleData.initial_response_hours !== undefined) {
            updateFields.push('initial_response_hours = ?');
            updateValues.push(ruleData.initial_response_hours);
        }
        if (ruleData.resolution_hours !== undefined) {
            updateFields.push('resolution_hours = ?');
            updateValues.push(ruleData.resolution_hours);
        }
        if (ruleData.escalation_levels !== undefined) {
            updateFields.push('escalation_levels = ?');
            updateValues.push(ruleData.escalation_levels);
        }
        if (ruleData.escalation_interval_hours !== undefined) {
            updateFields.push('escalation_interval_hours = ?');
            updateValues.push(ruleData.escalation_interval_hours);
        }
        if (ruleData.is_active !== undefined) {
            updateFields.push('is_active = ?');
            updateValues.push(ruleData.is_active);
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(id);

        const updateQuery = `UPDATE sla_rules SET ${updateFields.join(', ')} WHERE id = ?`;
        this.db.prepare(updateQuery).run(...updateValues);
        return this.getSLARuleById(id);
    }

    /**
     * Delete SLA rule
     */
    deleteSLARule(id) {
        return this.db.prepare('DELETE FROM sla_rules WHERE id = ?').run(id);
    }

    // ==================== SLA VIOLATION TRACKING ====================

    /**
     * Check for SLA violations and create violation records
     */
    checkSLAViolations() {
        const tickets = this.db.prepare(`
            SELECT t.*, tp.name as priority_name, sr.id as sla_rule_id, sr.initial_response_hours, sr.resolution_hours, sr.escalation_interval_hours
            FROM tickets t
            LEFT JOIN ticket_priorities tp ON t.priority_id = tp.id
            LEFT JOIN sla_rules sr ON tp.id = sr.priority_id
            WHERE t.status_id NOT IN (
                SELECT id FROM ticket_statuses WHERE name IN ('resolved', 'closed', 'cancelled')
            )
            AND sr.is_active = 1
        `).all();

        const violations = [];
        const now = new Date();

        for (const ticket of tickets) {
            // Check response time violation
            const expectedResponseTime = new Date(ticket.created_at);
            expectedResponseTime.setHours(expectedResponseTime.getHours() + ticket.initial_response_hours);

            if (now > expectedResponseTime) {
                const existingViolation = this.db.prepare(`
                    SELECT * FROM sla_violations 
                    WHERE ticket_id = ? AND violation_type = 'response' AND is_resolved = 0
                `).get(ticket.id);

                if (!existingViolation) {
                    const violation = this.createSLAViolation({
                        ticket_id: ticket.id,
                        rule_id: ticket.sla_rule_id,
                        violation_type: 'response',
                        expected_time: expectedResponseTime.toISOString(),
                        actual_time: now.toISOString()
                    });
                    violations.push(violation);
                }
            }

            // Check resolution time violation
            const expectedResolutionTime = new Date(ticket.created_at);
            expectedResolutionTime.setHours(expectedResolutionTime.getHours() + ticket.resolution_hours);

            if (now > expectedResolutionTime) {
                const existingViolation = this.db.prepare(`
                    SELECT * FROM sla_violations 
                    WHERE ticket_id = ? AND violation_type = 'resolution' AND is_resolved = 0
                `).get(ticket.id);

                if (!existingViolation) {
                    const violation = this.createSLAViolation({
                        ticket_id: ticket.id,
                        rule_id: ticket.sla_rule_id,
                        violation_type: 'resolution',
                        expected_time: expectedResolutionTime.toISOString(),
                        actual_time: now.toISOString()
                    });
                    violations.push(violation);
                }
            }
        }

        return violations;
    }

    /**
     * Create SLA violation record
     */
    createSLAViolation(violationData) {
        const expectedTime = new Date(violationData.expected_time);
        const actualTime = new Date(violationData.actual_time);
        const violationDuration = (actualTime - expectedTime) / (1000 * 60 * 60); // hours

        const result = this.db.prepare(`
            INSERT INTO sla_violations (
                ticket_id, rule_id, violation_type, expected_time, 
                actual_time, violation_duration_hours
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            violationData.ticket_id,
            violationData.rule_id,
            violationData.violation_type,
            violationData.expected_time,
            violationData.actual_time,
            violationDuration
        );

        // Create notification
        this.createSLANotification({
            ticket_id: violationData.ticket_id,
            notification_type: 'breach',
            message: `SLA ${violationData.violation_type} violation detected for ticket ${violationData.ticket_id}`,
            sent_to_user_id: null // Will be set based on escalation rules
        });

        return this.getSLAViolationById(result.lastInsertRowid);
    }

    /**
     * Get SLA violation by ID
     */
    getSLAViolationById(id) {
        return this.db.prepare(`
            SELECT sv.*, t.ticket_id as ticket_number, t.subject,
                   sr.name as rule_name, tp.name as priority_name
            FROM sla_violations sv
            LEFT JOIN tickets t ON sv.ticket_id = t.id
            LEFT JOIN sla_rules sr ON sv.rule_id = sr.id
            LEFT JOIN ticket_priorities tp ON sr.priority_id = tp.id
            WHERE sv.id = ?
        `).get(id);
    }

    /**
     * Get all SLA violations
     */
    getAllSLAViolations(filters = {}) {
        let query = `
            SELECT sv.*, t.ticket_id as ticket_number, t.subject,
                   sr.name as rule_name, tp.name as priority_name
            FROM sla_violations sv
            LEFT JOIN tickets t ON sv.ticket_id = t.id
            LEFT JOIN sla_rules sr ON sv.rule_id = sr.id
            LEFT JOIN ticket_priorities tp ON sr.priority_id = tp.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.is_resolved !== undefined) {
            query += ' AND sv.is_resolved = ?';
            params.push(filters.is_resolved ? 1 : 0);
        }

        if (filters.violation_type) {
            query += ' AND sv.violation_type = ?';
            params.push(filters.violation_type);
        }

        if (filters.ticket_id) {
            query += ' AND sv.ticket_id = ?';
            params.push(filters.ticket_id);
        }

        query += ' ORDER BY sv.created_at DESC';

        return this.db.prepare(query).all(...params);
    }

    /**
     * Resolve SLA violation
     */
    resolveSLAViolation(id, resolvedByUserId = null) {
        this.db.prepare(`
            UPDATE sla_violations 
            SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(id);

        return this.getSLAViolationById(id);
    }

    // ==================== ESCALATION MANAGEMENT ====================

    /**
     * Check for escalations and trigger them
     */
    checkEscalations() {
        const violations = this.db.prepare(`
            SELECT sv.*, t.ticket_id as ticket_number, t.subject, t.assignee_id,
                   sr.escalation_levels, sr.escalation_interval_hours,
                   tp.name as priority_name
            FROM sla_violations sv
            LEFT JOIN tickets t ON sv.ticket_id = t.id
            LEFT JOIN sla_rules sr ON sv.rule_id = sr.id
            LEFT JOIN ticket_priorities tp ON sr.priority_id = tp.id
            WHERE sv.is_resolved = 0
        `).all();

        const escalations = [];

        for (const violation of violations) {
            const escalationLevel = this.calculateEscalationLevel(violation);
            
            if (escalationLevel > 0) {
                const escalation = this.triggerEscalation(violation.ticket_id, escalationLevel, violation);
                if (escalation) {
                    escalations.push(escalation);
                }
            }
        }

        return escalations;
    }

    /**
     * Calculate escalation level based on violation duration
     */
    calculateEscalationLevel(violation) {
        const hoursSinceViolation = violation.violation_duration_hours;
        const intervalHours = violation.escalation_interval_hours;
        
        return Math.floor(hoursSinceViolation / intervalHours);
    }

    /**
     * Trigger escalation for a ticket
     */
    triggerEscalation(ticketId, escalationLevel, violation = null) {
        // Get escalation rule
        const escalationRule = this.getEscalationRule(violation ? violation.rule_id : null, escalationLevel);
        if (!escalationRule) return null;

        // Check if escalation already exists
        const existingEscalation = this.db.prepare(`
            SELECT * FROM escalation_history 
            WHERE ticket_id = ? AND escalation_level = ? AND is_resolved = 0
        `).get(ticketId, escalationLevel);

        if (existingEscalation) return existingEscalation;

        // Get user to escalate to
        let escalatedToUserId = null;
        if (escalationRule.escalate_to_user_id) {
            escalatedToUserId = escalationRule.escalate_to_user_id;
        } else {
            // Find user by role
            const user = this.db.prepare(`
                SELECT id FROM users WHERE role = ? AND is_active = 1 LIMIT 1
            `).get(escalationRule.escalate_to_role);
            escalatedToUserId = user ? user.id : null;
        }

        if (!escalatedToUserId) return null;

        // Create escalation record
        const result = this.db.prepare(`
            INSERT INTO escalation_history (
                ticket_id, escalation_level, escalated_to_user_id, escalation_reason
            ) VALUES (?, ?, ?, ?)
        `).run(
            ticketId,
            escalationLevel,
            escalatedToUserId,
            violation ? `SLA ${violation.violation_type} violation - ${violation.violation_duration_hours.toFixed(1)} hours overdue` : 'Manual escalation'
        );

        // Create notification
        this.createSLANotification({
            ticket_id: ticketId,
            notification_type: 'escalation',
            message: `Ticket escalated to level ${escalationLevel} due to SLA violation`,
            sent_to_user_id: escalatedToUserId
        });

        return this.getEscalationById(result.lastInsertRowid);
    }

    /**
     * Get escalation rule
     */
    getEscalationRule(slaRuleId, escalationLevel) {
        return this.db.prepare(`
            SELECT * FROM escalation_rules 
            WHERE sla_rule_id = ? AND escalation_level = ? AND is_active = 1
        `).get(slaRuleId, escalationLevel);
    }

    /**
     * Get escalation by ID
     */
    getEscalationById(id) {
        return this.db.prepare(`
            SELECT eh.*, t.ticket_id as ticket_number, t.subject,
                   u1.name as escalated_from_name, u2.name as escalated_to_name
            FROM escalation_history eh
            LEFT JOIN tickets t ON eh.ticket_id = t.id
            LEFT JOIN users u1 ON eh.escalated_from_user_id = u1.id
            LEFT JOIN users u2 ON eh.escalated_to_user_id = u2.id
            WHERE eh.id = ?
        `).get(id);
    }

    /**
     * Get all escalations
     */
    getAllEscalations(filters = {}) {
        let query = `
            SELECT eh.*, t.ticket_id as ticket_number, t.subject,
                   u1.name as escalated_from_name, u2.name as escalated_to_name
            FROM escalation_history eh
            LEFT JOIN tickets t ON eh.ticket_id = t.id
            LEFT JOIN users u1 ON eh.escalated_from_user_id = u1.id
            LEFT JOIN users u2 ON eh.escalated_to_user_id = u2.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.is_resolved !== undefined) {
            query += ' AND eh.is_resolved = ?';
            params.push(filters.is_resolved ? 1 : 0);
        }

        if (filters.ticket_id) {
            query += ' AND eh.ticket_id = ?';
            params.push(filters.ticket_id);
        }

        query += ' ORDER BY eh.escalation_time DESC';

        return this.db.prepare(query).all(...params);
    }

    /**
     * Resolve escalation
     */
    resolveEscalation(id, resolvedByUserId) {
        this.db.prepare(`
            UPDATE escalation_history 
            SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP, resolved_by_user_id = ?
            WHERE id = ?
        `).run(resolvedByUserId, id);

        return this.getEscalationById(id);
    }

    // ==================== SLA NOTIFICATIONS ====================

    /**
     * Create SLA notification
     */
    createSLANotification(notificationData) {
        const result = this.db.prepare(`
            INSERT INTO sla_notifications (
                ticket_id, notification_type, message, sent_to_user_id
            ) VALUES (?, ?, ?, ?)
        `).run(
            notificationData.ticket_id,
            notificationData.notification_type,
            notificationData.message,
            notificationData.sent_to_user_id
        );

        return this.getSLANotificationById(result.lastInsertRowid);
    }

    /**
     * Get SLA notification by ID
     */
    getSLANotificationById(id) {
        return this.db.prepare(`
            SELECT sn.*, t.ticket_id as ticket_number, t.subject,
                   u.name as sent_to_name
            FROM sla_notifications sn
            LEFT JOIN tickets t ON sn.ticket_id = t.id
            LEFT JOIN users u ON sn.sent_to_user_id = u.id
            WHERE sn.id = ?
        `).get(id);
    }

    /**
     * Get all SLA notifications
     */
    getAllSLANotifications(filters = {}) {
        let query = `
            SELECT sn.*, t.ticket_id as ticket_number, t.subject,
                   u.name as sent_to_name
            FROM sla_notifications sn
            LEFT JOIN tickets t ON sn.ticket_id = t.id
            LEFT JOIN users u ON sn.sent_to_user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.is_read !== undefined) {
            query += ' AND sn.is_read = ?';
            params.push(filters.is_read ? 1 : 0);
        }

        if (filters.notification_type) {
            query += ' AND sn.notification_type = ?';
            params.push(filters.notification_type);
        }

        if (filters.sent_to_user_id) {
            query += ' AND sn.sent_to_user_id = ?';
            params.push(filters.sent_to_user_id);
        }

        query += ' ORDER BY sn.sent_at DESC';

        return this.db.prepare(query).all(...params);
    }

    /**
     * Mark notification as read
     */
    markNotificationAsRead(id) {
        this.db.prepare(`
            UPDATE sla_notifications 
            SET is_read = 1, read_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(id);

        return this.getSLANotificationById(id);
    }

    // ==================== SLA REPORTING ====================

    /**
     * Get SLA compliance report
     */
    getSLAComplianceReport(timeRange = '30d') {
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const tickets = this.db.prepare(`
            SELECT t.*, tp.name as priority_name, sr.initial_response_hours, sr.resolution_hours,
                   CASE 
                       WHEN t.resolved_at IS NOT NULL THEN 
                           (julianday(t.resolved_at) - julianday(t.created_at)) * 24
                       ELSE 
                           (julianday('now') - julianday(t.created_at)) * 24
                   END as actual_hours
            FROM tickets t
            LEFT JOIN ticket_priorities tp ON t.priority_id = tp.id
            LEFT JOIN sla_rules sr ON tp.id = sr.priority_id
            WHERE t.created_at >= ? AND sr.is_active = 1
        `).all(startDate.toISOString());

        let totalTickets = 0;
        let compliantTickets = 0;
        let responseViolations = 0;
        let resolutionViolations = 0;

        for (const ticket of tickets) {
            totalTickets++;
            
            if (ticket.actual_hours <= ticket.resolution_hours) {
                compliantTickets++;
            } else {
                resolutionViolations++;
            }

            // Check response time (simplified - would need first response tracking)
            if (ticket.actual_hours > ticket.initial_response_hours) {
                responseViolations++;
            }
        }

        const complianceRate = totalTickets > 0 ? (compliantTickets / totalTickets) * 100 : 0;

        return {
            totalTickets,
            compliantTickets,
            responseViolations,
            resolutionViolations,
            complianceRate: Math.round(complianceRate * 100) / 100,
            averageResolutionTime: this.calculateAverageResolutionTime(tickets),
            violationsByPriority: this.calculateViolationsByPriority(tickets)
        };
    }

    /**
     * Calculate average resolution time
     */
    calculateAverageResolutionTime(tickets) {
        const resolvedTickets = tickets.filter(t => t.resolved_at);
        if (resolvedTickets.length === 0) return 0;

        const totalHours = resolvedTickets.reduce((sum, ticket) => sum + ticket.actual_hours, 0);
        return Math.round((totalHours / resolvedTickets.length) * 100) / 100;
    }

    /**
     * Calculate violations by priority
     */
    calculateViolationsByPriority(tickets) {
        const violations = {};
        
        for (const ticket of tickets) {
            if (!violations[ticket.priority_name]) {
                violations[ticket.priority_name] = { total: 0, violations: 0 };
            }
            
            violations[ticket.priority_name].total++;
            if (ticket.actual_hours > ticket.resolution_hours) {
                violations[ticket.priority_name].violations++;
            }
        }

        return violations;
    }

    // ==================== MAINTENANCE FUNCTIONS ====================

    /**
     * Initialize SLA tables
     */
    initializeSLATables() {
        try {
            // Run the SLA schema
            const fs = require('fs');
            const path = require('path');
            const schemaPath = path.join(__dirname, 'schema-sla-escalation.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            this.db.exec(schema);
            console.log('SLA tables initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing SLA tables:', error);
            return false;
        }
    }

    /**
     * Clean up old SLA data
     */
    cleanupOldSLAData(daysToKeep = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = this.db.prepare(`
            DELETE FROM sla_violations 
            WHERE created_at < ? AND is_resolved = 1
        `).run(cutoffDate.toISOString());

        return result.changes;
    }
}

module.exports = SLAServices; 