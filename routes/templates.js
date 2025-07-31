const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const TemplateServices = require('../database/template-services');
const dbManager = require('../database/db');

const router = express.Router();

// Initialize template services
const templateServices = new TemplateServices(dbManager.db);

// Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Validation failed', 
            details: errors.array() 
        });
    }
    next();
};

// Get all templates
router.get('/templates',
    [
        query('categoryId').optional().isInt().withMessage('Category ID must be a valid integer'),
        query('priorityId').optional().isInt().withMessage('Priority ID must be a valid integer'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            const options = {};
            if (req.query.categoryId) options.categoryId = req.query.categoryId;
            if (req.query.priorityId) options.priorityId = req.query.priorityId;
            
            const templates = templateServices.getTemplates(options);
            res.json(templates);
        } catch (error) {
            console.error('Error getting templates:', error);
            res.status(500).json({ error: 'Failed to get templates' });
        }
    }
);

// Get a specific template
router.get('/templates/:templateId',
    [
        param('templateId').isInt().withMessage('Template ID must be a valid integer'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            const template = templateServices.getTemplateById(req.params.templateId);
            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }
            res.json(template);
        } catch (error) {
            console.error('Error getting template:', error);
            res.status(500).json({ error: 'Failed to get template' });
        }
    }
);

// Create a new template
router.post('/templates',
    [
        body('name').notEmpty().trim().isLength({ min: 1, max: 100 }).withMessage('Template name is required and must be 1-100 characters'),
        body('description').optional().trim(),
        body('category_id').optional().isInt().withMessage('Category ID must be a valid integer'),
        body('priority_id').optional().isInt().withMessage('Priority ID must be a valid integer'),
        body('subject_template').notEmpty().trim().withMessage('Subject template is required'),
        body('description_template').notEmpty().trim().withMessage('Description template is required'),
        body('variables').optional().isArray().withMessage('Variables must be an array'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            // Get user ID from session (you'll need to implement this based on your auth system)
            const createdBy = req.user?.id || 1; // Default to admin user for now
            
            const template = templateServices.createTemplate({
                ...req.body,
                created_by: createdBy
            });
            
            res.status(201).json(template);
        } catch (error) {
            console.error('Error creating template:', error);
            res.status(500).json({ error: 'Failed to create template' });
        }
    }
);

// Update a template
router.put('/templates/:templateId',
    [
        param('templateId').isInt().withMessage('Template ID must be a valid integer'),
        body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Template name must be 1-100 characters'),
        body('description').optional().trim(),
        body('category_id').optional().isInt().withMessage('Category ID must be a valid integer'),
        body('priority_id').optional().isInt().withMessage('Priority ID must be a valid integer'),
        body('subject_template').optional().trim(),
        body('description_template').optional().trim(),
        body('variables').optional().isArray().withMessage('Variables must be an array'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            const template = templateServices.updateTemplate(req.params.templateId, req.body);
            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }
            res.json(template);
        } catch (error) {
            console.error('Error updating template:', error);
            res.status(500).json({ error: 'Failed to update template' });
        }
    }
);

// Delete a template
router.delete('/templates/:templateId',
    [
        param('templateId').isInt().withMessage('Template ID must be a valid integer'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            const result = templateServices.deleteTemplate(req.params.templateId);
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Template not found' });
            }
            res.json({ message: 'Template deleted successfully' });
        } catch (error) {
            console.error('Error deleting template:', error);
            res.status(500).json({ error: 'Failed to delete template' });
        }
    }
);

// Process template with variables
router.post('/templates/:templateId/process',
    [
        param('templateId').isInt().withMessage('Template ID must be a valid integer'),
        body('variables').isObject().withMessage('Variables must be an object'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            // Validate template variables
            const validation = templateServices.validateTemplateVariables(req.params.templateId, req.body.variables);
            if (!validation.valid) {
                return res.status(400).json({ 
                    error: 'Template validation failed', 
                    details: validation.errors 
                });
            }
            
            const processedTemplate = templateServices.processTemplate(req.params.templateId, req.body.variables);
            res.json(processedTemplate);
        } catch (error) {
            console.error('Error processing template:', error);
            res.status(500).json({ error: 'Failed to process template' });
        }
    }
);

// Get template usage statistics
router.get('/templates/stats/usage',
    (req, res) => {
        try {
            const stats = templateServices.getTemplateUsageStats();
            res.json(stats);
        } catch (error) {
            console.error('Error getting template usage stats:', error);
            res.status(500).json({ error: 'Failed to get template usage statistics' });
        }
    }
);

// Export templates
router.get('/templates/export',
    (req, res) => {
        try {
            const templates = templateServices.exportTemplates();
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="ticket-templates.json"');
            res.json(templates);
        } catch (error) {
            console.error('Error exporting templates:', error);
            res.status(500).json({ error: 'Failed to export templates' });
        }
    }
);

// Import templates
router.post('/templates/import',
    [
        body('templates').isArray().withMessage('Templates must be an array'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            // Get user ID from session (you'll need to implement this based on your auth system)
            const createdBy = req.user?.id || 1; // Default to admin user for now
            
            const importedTemplates = templateServices.importTemplates(req.body.templates, createdBy);
            res.status(201).json({
                message: 'Templates imported successfully',
                count: importedTemplates.length,
                templates: importedTemplates
            });
        } catch (error) {
            console.error('Error importing templates:', error);
            res.status(500).json({ error: 'Failed to import templates' });
        }
    }
);

// Validate template variables
router.post('/templates/:templateId/validate',
    [
        param('templateId').isInt().withMessage('Template ID must be a valid integer'),
        body('variables').isObject().withMessage('Variables must be an object'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            const validation = templateServices.validateTemplateVariables(req.params.templateId, req.body.variables);
            res.json(validation);
        } catch (error) {
            console.error('Error validating template variables:', error);
            res.status(500).json({ error: 'Failed to validate template variables' });
        }
    }
);

module.exports = router; 