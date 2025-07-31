-- Ticket Templates Schema
-- This file adds ticket template support to the ticket management system

-- Ticket templates table
CREATE TABLE IF NOT EXISTS ticket_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    priority_id INTEGER,
    subject_template TEXT NOT NULL,
    description_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES ticket_categories(id),
    FOREIGN KEY (priority_id) REFERENCES ticket_priorities(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Template variables table for dynamic content
CREATE TABLE IF NOT EXISTS template_variables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    variable_name TEXT NOT NULL,
    variable_type TEXT NOT NULL CHECK (variable_type IN ('text', 'email', 'select', 'textarea')),
    default_value TEXT,
    is_required BOOLEAN DEFAULT 0,
    options TEXT, -- JSON array for select type variables
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (template_id) REFERENCES ticket_templates(id) ON DELETE CASCADE
);

-- Template usage tracking
CREATE TABLE IF NOT EXISTS template_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    used_by INTEGER NOT NULL,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES ticket_templates(id),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (used_by) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ticket_templates_category ON ticket_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_priority ON ticket_templates(priority_id);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_active ON ticket_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_template_variables_template ON template_variables(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_template ON template_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_ticket ON template_usage(ticket_id);

-- Insert some default templates
INSERT OR IGNORE INTO ticket_templates (id, name, description, category_id, priority_id, subject_template, description_template, created_by) VALUES
(1, 'Hardware Issue', 'Template for hardware-related problems', 1, 2, 'Hardware Issue: {device_type}', 'Device Type: {device_type}\nIssue Description: {issue_description}\nLocation: {location}\n\nPlease provide any additional details about the hardware problem.', 1),
(2, 'Software Problem', 'Template for software-related issues', 2, 2, 'Software Issue: {software_name}', 'Software: {software_name}\nVersion: {version}\nError Message: {error_message}\nSteps to Reproduce: {steps}\n\nPlease include any error screenshots or logs.', 1),
(3, 'Network Connectivity', 'Template for network connectivity issues', 3, 1, 'Network Issue: {connection_type}', 'Connection Type: {connection_type}\nAffected Services: {affected_services}\nError Details: {error_details}\n\nPlease specify which network services are affected.', 1),
(4, 'Email Configuration', 'Template for email setup and configuration', 4, 2, 'Email Configuration: {email_client}', 'Email Client: {email_client}\nAccount: {email_account}\nIssue: {configuration_issue}\n\nPlease provide your email client version and any error messages.', 1),
(5, 'Access Request', 'Template for access permission requests', 5, 3, 'Access Request: {system_name}', 'System/Application: {system_name}\nRequested Access Level: {access_level}\nBusiness Justification: {business_justification}\nManager Approval: {manager_approval}\n\nPlease ensure you have manager approval before submitting.', 1);

-- Insert template variables for the default templates
INSERT OR IGNORE INTO template_variables (template_id, variable_name, variable_type, default_value, is_required, options, display_order) VALUES
-- Hardware Issue template variables
(1, 'device_type', 'select', '', 1, '["Desktop", "Laptop", "Printer", "Scanner", "Mobile Device", "Other"]', 1),
(1, 'issue_description', 'textarea', '', 1, NULL, 2),
(1, 'location', 'text', '', 0, NULL, 3),

-- Software Problem template variables
(2, 'software_name', 'text', '', 1, NULL, 1),
(2, 'version', 'text', '', 0, NULL, 2),
(2, 'error_message', 'textarea', '', 0, NULL, 3),
(2, 'steps', 'textarea', '', 0, NULL, 4),

-- Network Connectivity template variables
(3, 'connection_type', 'select', '', 1, '["WiFi", "Ethernet", "VPN", "Remote Desktop", "Other"]', 1),
(3, 'affected_services', 'text', '', 1, NULL, 2),
(3, 'error_details', 'textarea', '', 0, NULL, 3),

-- Email Configuration template variables
(4, 'email_client', 'select', '', 1, '["Outlook", "Thunderbird", "Gmail", "Apple Mail", "Other"]', 1),
(4, 'email_account', 'email', '', 1, NULL, 2),
(4, 'configuration_issue', 'textarea', '', 1, NULL, 3),

-- Access Request template variables
(5, 'system_name', 'text', '', 1, NULL, 1),
(5, 'access_level', 'select', '', 1, '["Read Only", "Standard User", "Power User", "Administrator"]', 2),
(5, 'business_justification', 'textarea', '', 1, NULL, 3),
(5, 'manager_approval', 'select', '', 1, '["Yes", "No", "Pending"]', 4); 