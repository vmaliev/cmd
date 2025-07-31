const path = require('path');
const fs = require('fs');

class TemplateServices {
    constructor(db) {
        this.db = db;
    }

    // Get all active templates
    getTemplates(options = {}) {
        try {
            let query = `
                SELECT tt.*, tc.name as category_name, tp.name as priority_name, u.name as created_by_name
                FROM ticket_templates tt
                LEFT JOIN ticket_categories tc ON tt.category_id = tc.id
                LEFT JOIN ticket_priorities tp ON tt.priority_id = tp.id
                LEFT JOIN users u ON tt.created_by = u.id
                WHERE tt.is_active = 1
            `;
            
            const params = [];
            
            if (options.categoryId) {
                query += ' AND tt.category_id = ?';
                params.push(options.categoryId);
            }
            
            if (options.priorityId) {
                query += ' AND tt.priority_id = ?';
                params.push(options.priorityId);
            }
            
            query += ' ORDER BY tt.name ASC';
            
            const stmt = this.db.prepare(query);
            return stmt.all(...params);
        } catch (error) {
            console.error('Error getting templates:', error);
            return [];
        }
    }

    // Get a specific template with variables
    getTemplateById(templateId) {
        try {
            // Get template details
            const templateStmt = this.db.prepare(`
                SELECT tt.*, tc.name as category_name, tp.name as priority_name, u.name as created_by_name
                FROM ticket_templates tt
                LEFT JOIN ticket_categories tc ON tt.category_id = tc.id
                LEFT JOIN ticket_priorities tp ON tt.priority_id = tp.id
                LEFT JOIN users u ON tt.created_by = u.id
                WHERE tt.id = ?
            `);
            const template = templateStmt.get(templateId);
            
            if (!template) {
                return null;
            }
            
            // Get template variables
            const variablesStmt = this.db.prepare(`
                SELECT * FROM template_variables 
                WHERE template_id = ? 
                ORDER BY display_order ASC
            `);
            const variables = variablesStmt.all(templateId);
            
            return {
                ...template,
                variables: variables
            };
        } catch (error) {
            console.error('Error getting template:', error);
            return null;
        }
    }

    // Create a new template
    createTemplate(templateData) {
        try {
            const { name, description, category_id, priority_id, subject_template, description_template, created_by, variables } = templateData;
            
            // Insert template
            const templateStmt = this.db.prepare(`
                INSERT INTO ticket_templates 
                (name, description, category_id, priority_id, subject_template, description_template, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            const result = templateStmt.run(name, description, category_id, priority_id, subject_template, description_template, created_by);
            const templateId = result.lastInsertRowid;
            
            // Insert variables if provided
            if (variables && Array.isArray(variables)) {
                for (const variable of variables) {
                    this.createTemplateVariable(templateId, variable);
                }
            }
            
            return this.getTemplateById(templateId);
        } catch (error) {
            console.error('Error creating template:', error);
            throw error;
        }
    }

    // Create a template variable
    createTemplateVariable(templateId, variableData) {
        try {
            const { variable_name, variable_type, default_value, is_required, options, display_order } = variableData;
            
            const stmt = this.db.prepare(`
                INSERT INTO template_variables 
                (template_id, variable_name, variable_type, default_value, is_required, options, display_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            return stmt.run(templateId, variable_name, variable_type, default_value, is_required, options, display_order);
        } catch (error) {
            console.error('Error creating template variable:', error);
            throw error;
        }
    }

    // Update a template
    updateTemplate(templateId, templateData) {
        try {
            const { name, description, category_id, priority_id, subject_template, description_template, variables } = templateData;
            
            // Update template
            const templateStmt = this.db.prepare(`
                UPDATE ticket_templates 
                SET name = ?, description = ?, category_id = ?, priority_id = ?, 
                    subject_template = ?, description_template = ?, updated_at = datetime('now')
                WHERE id = ?
            `);
            
            const result = templateStmt.run(name, description, category_id, priority_id, subject_template, description_template, templateId);
            
            // Update variables if provided
            if (variables && Array.isArray(variables)) {
                // Delete existing variables
                const deleteStmt = this.db.prepare('DELETE FROM template_variables WHERE template_id = ?');
                deleteStmt.run(templateId);
                
                // Insert new variables
                for (const variable of variables) {
                    this.createTemplateVariable(templateId, variable);
                }
            }
            
            return this.getTemplateById(templateId);
        } catch (error) {
            console.error('Error updating template:', error);
            throw error;
        }
    }

    // Delete a template (soft delete)
    deleteTemplate(templateId) {
        try {
            const stmt = this.db.prepare('UPDATE ticket_templates SET is_active = 0 WHERE id = ?');
            return stmt.run(templateId);
        } catch (error) {
            console.error('Error deleting template:', error);
            throw error;
        }
    }

    // Process template with variables
    processTemplate(templateId, variableValues) {
        try {
            const template = this.getTemplateById(templateId);
            if (!template) {
                throw new Error('Template not found');
            }
            
            let subject = template.subject_template;
            let description = template.description_template;
            
            // Replace variables in templates
            for (const [variableName, value] of Object.entries(variableValues)) {
                const placeholder = `{${variableName}}`;
                subject = subject.replace(new RegExp(placeholder, 'g'), value || '');
                description = description.replace(new RegExp(placeholder, 'g'), value || '');
            }
            
            return {
                subject: subject,
                description: description,
                category_id: template.category_id,
                priority_id: template.priority_id
            };
        } catch (error) {
            console.error('Error processing template:', error);
            throw error;
        }
    }

    // Track template usage
    trackTemplateUsage(templateId, ticketId, usedBy) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO template_usage (template_id, ticket_id, used_by)
                VALUES (?, ?, ?)
            `);
            return stmt.run(templateId, ticketId, usedBy);
        } catch (error) {
            console.error('Error tracking template usage:', error);
            // Don't throw error as this is not critical
        }
    }

    // Get template usage statistics
    getTemplateUsageStats() {
        try {
            const stmt = this.db.prepare(`
                SELECT 
                    tt.name as template_name,
                    COUNT(tu.id) as usage_count,
                    MAX(tu.used_at) as last_used
                FROM ticket_templates tt
                LEFT JOIN template_usage tu ON tt.id = tu.template_id
                WHERE tt.is_active = 1
                GROUP BY tt.id, tt.name
                ORDER BY usage_count DESC
            `);
            return stmt.all();
        } catch (error) {
            console.error('Error getting template usage stats:', error);
            return [];
        }
    }

    // Export templates to JSON
    exportTemplates() {
        try {
            const templates = this.getTemplates();
            const exportData = [];
            
            for (const template of templates) {
                const fullTemplate = this.getTemplateById(template.id);
                exportData.push(fullTemplate);
            }
            
            return exportData;
        } catch (error) {
            console.error('Error exporting templates:', error);
            throw error;
        }
    }

    // Import templates from JSON
    importTemplates(templatesData, createdBy) {
        try {
            const results = [];
            
            for (const templateData of templatesData) {
                const { variables, ...templateInfo } = templateData;
                templateInfo.created_by = createdBy;
                
                const template = this.createTemplate({
                    ...templateInfo,
                    variables: variables
                });
                
                results.push(template);
            }
            
            return results;
        } catch (error) {
            console.error('Error importing templates:', error);
            throw error;
        }
    }

    // Validate template variables
    validateTemplateVariables(templateId, variableValues) {
        try {
            const template = this.getTemplateById(templateId);
            if (!template) {
                return { valid: false, errors: ['Template not found'] };
            }
            
            const errors = [];
            
            for (const variable of template.variables) {
                const value = variableValues[variable.variable_name];
                
                // Check required fields
                if (variable.is_required && (!value || value.trim() === '')) {
                    errors.push(`${variable.variable_name} is required`);
                    continue;
                }
                
                // Validate email type
                if (variable.variable_type === 'email' && value) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(value)) {
                        errors.push(`${variable.variable_name} must be a valid email address`);
                    }
                }
                
                // Validate select type
                if (variable.variable_type === 'select' && value) {
                    try {
                        const options = JSON.parse(variable.options || '[]');
                        if (!options.includes(value)) {
                            errors.push(`${variable.variable_name} must be one of: ${options.join(', ')}`);
                        }
                    } catch (e) {
                        errors.push(`Invalid options for ${variable.variable_name}`);
                    }
                }
            }
            
            return {
                valid: errors.length === 0,
                errors: errors
            };
        } catch (error) {
            console.error('Error validating template variables:', error);
            return { valid: false, errors: ['Validation error'] };
        }
    }
}

module.exports = TemplateServices; 