const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const AttachmentServices = require('../database/attachment-services');
const dbManager = require('../database/db');

const router = express.Router();

// Initialize attachment services lazily
let attachmentServices = null;

function getAttachmentServices() {
    console.log('Getting attachment services...');
    console.log('dbManager:', dbManager);
    console.log('dbManager.db:', dbManager.db);
    
    // Force recreation of attachment services to ensure fresh database connection
    attachmentServices = null;
    
    if (!attachmentServices) {
        if (!dbManager.db) {
            throw new Error('Database not initialized');
        }
        attachmentServices = new AttachmentServices(dbManager.db);
    }
    return attachmentServices;
}

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

// Test simple endpoint (must come before /attachments/:attachmentId routes)
router.get('/test-simple-route',
    (req, res) => {
        console.log('=== SIMPLE TEST ROUTE CALLED ===');
        res.json({ message: 'Simple test route working' });
    }
);

// Test file upload endpoint (must come before /attachments/:attachmentId routes)
router.post('/test-upload',
    (req, res) => {
        try {
            console.log('Test upload - Files received:', req.files);
            console.log('Test upload - File keys:', Object.keys(req.files || {}));
            
            if (!req.files || Object.keys(req.files).length === 0) {
                return res.status(400).json({ error: 'No files were uploaded' });
            }

            const uploadedFile = req.files.file;
            console.log('Test upload - Uploaded file:', uploadedFile);
            
            res.json({ 
                message: 'File upload test successful',
                fileInfo: {
                    name: uploadedFile?.name,
                    originalname: uploadedFile?.originalname,
                    size: uploadedFile?.size,
                    mimetype: uploadedFile?.mimetype
                }
            });
        } catch (error) {
            console.error('Test upload error:', error);
            res.status(500).json({ error: 'Test upload failed', details: error.message });
        }
    }
);

// Get attachment statistics (must come before /:attachmentId routes)
router.get('/attachments/stats',
    (req, res) => {
        try {
            const stats = getAttachmentServices().getAttachmentStats();
            res.json(stats);
        } catch (error) {
            console.error('Error getting attachment stats:', error);
            res.status(500).json({ error: 'Failed to get attachment statistics' });
        }
    }
);

// Get all attachments for a ticket
router.get('/tickets/:ticketId/attachments',
    (req, res) => {
        try {
            const ticketId = req.params.ticketId;
            console.log('Getting attachments for ticket:', ticketId);
            
            const attachments = getAttachmentServices().getTicketAttachments(ticketId);
            console.log('Found attachments:', attachments);
            
            res.json(attachments);
        } catch (error) {
            console.error('Error getting ticket attachments:', error);
            res.status(500).json({ error: 'Failed to get attachments' });
        }
    }
);

// Get a specific attachment
router.get('/attachments/:attachmentId',
    [
        param('attachmentId').isInt().withMessage('Attachment ID must be a valid integer'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            const attachment = getAttachmentServices().getAttachmentById(req.params.attachmentId);
            if (!attachment) {
                return res.status(404).json({ error: 'Attachment not found' });
            }
            res.json(attachment);
        } catch (error) {
            console.error('Error getting attachment:', error);
            res.status(500).json({ error: 'Failed to get attachment' });
        }
    }
);

// Download an attachment
router.get('/attachments/:attachmentId/download',
    [
        param('attachmentId').isInt().withMessage('Attachment ID must be a valid integer'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            const attachment = getAttachmentServices().getAttachmentById(req.params.attachmentId);
            if (!attachment) {
                return res.status(404).json({ error: 'Attachment not found' });
            }

            const filePath = getAttachmentServices().getFilePath(req.params.attachmentId);
            if (!filePath || !fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            // Set headers for download
            res.setHeader('Content-Type', attachment.mime_type);
            res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_filename}"`);
            res.setHeader('Content-Length', attachment.file_size);

            // Stream the file
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
        } catch (error) {
            console.error('Error downloading attachment:', error);
            res.status(500).json({ error: 'Failed to download attachment' });
        }
    }
);

// Upload attachment to a ticket
router.post('/ticket-attachments/:ticketId',
    (req, res) => {
        console.log('=== ATTACHMENT UPLOAD ROUTE CALLED ===');
        console.log('Ticket ID:', req.params.ticketId);
        console.log('Request body keys:', Object.keys(req.body || {}));
        console.log('Request method:', req.method);
        console.log('Request path:', req.path);
        
        try {
            console.log('Files received:', req.files);
            console.log('File keys:', Object.keys(req.files || {}));
            
            if (!req.files || Object.keys(req.files).length === 0) {
                return res.status(400).json({ error: 'No files were uploaded' });
            }

            const uploadedFile = req.files.file;
            console.log('Uploaded file:', uploadedFile);
            console.log('File properties:', {
                name: uploadedFile?.name,
                originalname: uploadedFile?.originalname,
                size: uploadedFile?.size,
                mimetype: uploadedFile?.mimetype
            });
            
            if (!uploadedFile) {
                return res.status(400).json({ error: 'No file provided' });
            }

            // Accept both integer and string ticket IDs
            const ticketId = req.params.ticketId;
            console.log('About to call attachmentServices.createAttachment with ticketId:', ticketId);

            // Test database connection
            console.log('Testing database connection...');
            const db = dbManager.db;
            console.log('Database:', db);
            
            try {
                const tableInfo = db.prepare("PRAGMA table_info(ticket_attachments)").all();
                console.log('Table info:', tableInfo);
            } catch (error) {
                console.error('Database test error:', error);
            }

            // Get user ID from session (you'll need to implement this based on your auth system)
            const uploadedBy = req.user?.id || 1; // Default to admin user for now

            const attachment = getAttachmentServices().createAttachment(
                ticketId,
                uploadedFile,
                uploadedBy
            );

            console.log('Attachment created successfully:', attachment);
            res.status(201).json(attachment);
        } catch (error) {
            console.error('Error uploading attachment:', error);
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
            res.status(500).json({ error: 'Failed to upload attachment', details: error.message });
        }
    }
);

// Delete an attachment
router.delete('/attachments/:attachmentId',
    [
        param('attachmentId').isInt().withMessage('Attachment ID must be a valid integer'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            // Get user ID from session (you'll need to implement this based on your auth system)
            const deletedBy = req.user?.id || 1; // Default to admin user for now

            const result = getAttachmentServices().deleteAttachment(req.params.attachmentId, deletedBy);
            
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Attachment not found' });
            }

            res.json({ message: 'Attachment deleted successfully' });
        } catch (error) {
            console.error('Error deleting attachment:', error);
            res.status(500).json({ error: 'Failed to delete attachment' });
        }
    }
);

// Clean up orphaned files (admin only)
router.post('/attachments/cleanup',
    (req, res) => {
        try {
            const result = getAttachmentServices().cleanupOrphanedFiles();
            res.json({ 
                message: 'Cleanup completed successfully',
                deletedFiles: result.changes 
            });
        } catch (error) {
            console.error('Error cleaning up orphaned files:', error);
            res.status(500).json({ error: 'Failed to cleanup orphaned files' });
        }
    }
);

module.exports = router; 