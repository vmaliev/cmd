-- SLA Management and Escalation Rules Schema
-- SQLite database schema for Service Level Agreement tracking and escalation

-- SLA Rules table - defines escalation rules for different priorities
CREATE TABLE IF NOT EXISTS sla_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    priority_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    initial_response_hours INTEGER NOT NULL, -- Time to first response
    resolution_hours INTEGER NOT NULL, -- Time to resolution
    escalation_levels INTEGER DEFAULT 3, -- Number of escalation levels
    escalation_interval_hours INTEGER DEFAULT 4, -- Hours between escalations
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (priority_id) REFERENCES ticket_priorities(id) ON DELETE CASCADE
);

-- SLA Violations table - tracks when SLA is breached
CREATE TABLE IF NOT EXISTS sla_violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    rule_id INTEGER NOT NULL,
    violation_type TEXT NOT NULL CHECK (violation_type IN ('response', 'resolution')),
    expected_time DATETIME NOT NULL,
    actual_time DATETIME,
    violation_duration_hours REAL,
    is_resolved BOOLEAN DEFAULT 0,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES sla_rules(id) ON DELETE CASCADE
);

-- Escalation History table - tracks escalation events
CREATE TABLE IF NOT EXISTS escalation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    escalation_level INTEGER NOT NULL,
    escalated_from_user_id INTEGER,
    escalated_to_user_id INTEGER,
    escalation_reason TEXT,
    escalation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_resolved BOOLEAN DEFAULT 0,
    resolved_at DATETIME,
    resolved_by_user_id INTEGER,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (escalated_from_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (escalated_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Escalation Rules table - defines who gets escalated to
CREATE TABLE IF NOT EXISTS escalation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sla_rule_id INTEGER NOT NULL,
    escalation_level INTEGER NOT NULL,
    escalate_to_role TEXT NOT NULL,
    escalate_to_user_id INTEGER,
    notification_method TEXT DEFAULT 'email' CHECK (notification_method IN ('email', 'sms', 'in_app')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sla_rule_id) REFERENCES sla_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (escalate_to_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- SLA Notifications table - tracks SLA-related notifications
CREATE TABLE IF NOT EXISTS sla_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('warning', 'breach', 'escalation')),
    message TEXT NOT NULL,
    sent_to_user_id INTEGER,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT 0,
    read_at DATETIME,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (sent_to_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sla_violations_ticket_id ON sla_violations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_violations_rule_id ON sla_violations(rule_id);
CREATE INDEX IF NOT EXISTS idx_sla_violations_violation_type ON sla_violations(violation_type);
CREATE INDEX IF NOT EXISTS idx_sla_violations_is_resolved ON sla_violations(is_resolved);

CREATE INDEX IF NOT EXISTS idx_escalation_history_ticket_id ON escalation_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_escalation_history_escalation_level ON escalation_history(escalation_level);
CREATE INDEX IF NOT EXISTS idx_escalation_history_is_resolved ON escalation_history(is_resolved);

CREATE INDEX IF NOT EXISTS idx_escalation_rules_sla_rule_id ON escalation_rules(sla_rule_id);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_escalation_level ON escalation_rules(escalation_level);

CREATE INDEX IF NOT EXISTS idx_sla_notifications_ticket_id ON sla_notifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_notifications_notification_type ON sla_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_sla_notifications_is_read ON sla_notifications(is_read);

-- Insert default SLA rules based on existing priorities
INSERT OR IGNORE INTO sla_rules (priority_id, name, description, initial_response_hours, resolution_hours, escalation_levels, escalation_interval_hours) VALUES
(1, 'Low Priority SLA', 'Low priority tickets - 48 hour resolution', 24, 48, 2, 12),
(2, 'Medium Priority SLA', 'Medium priority tickets - 8 hour resolution', 4, 8, 3, 4),
(3, 'High Priority SLA', 'High priority tickets - 2 hour resolution', 1, 2, 4, 2),
(4, 'Critical Priority SLA', 'Critical tickets - 1 hour resolution', 0.5, 1, 5, 1);

-- Insert default escalation rules
INSERT OR IGNORE INTO escalation_rules (sla_rule_id, escalation_level, escalate_to_role, notification_method) VALUES
(1, 1, 'technician', 'email'),
(1, 2, 'admin', 'email'),
(2, 1, 'technician', 'email'),
(2, 2, 'technician', 'email'),
(2, 3, 'admin', 'email'),
(3, 1, 'technician', 'email'),
(3, 2, 'technician', 'email'),
(3, 3, 'admin', 'email'),
(3, 4, 'admin', 'email'),
(4, 1, 'technician', 'email'),
(4, 2, 'technician', 'email'),
(4, 3, 'admin', 'email'),
(4, 4, 'admin', 'email'),
(4, 5, 'admin', 'email'); 