const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const AttachmentServices = require('../database/attachment-services');
const dbManager = require('../database/db');

const router = express.Router();

// Initialize attachment services
const attachmentServices = new AttachmentServices(dbManager.db);

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

// Get attachment statistics (must come before /:attachmentId routes)
router.get('/attachments/stats',
    (req, res) => {
        try {
            const stats = attachmentServices.getAttachmentStats();
            res.json(stats);
        } catch (error) {
            console.error('Error getting attachment stats:', error);
            res.status(500).json({ error: 'Failed to get attachment statistics' });
        }
    }
);

// Get all attachments for a ticket
router.get('/tickets/:ticketId/attachments',
    [
        param('ticketId').isInt().withMessage('Ticket ID must be a valid integer'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            const attachments = attachmentServices.getTicketAttachments(req.params.ticketId);
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
            const attachment = attachmentServices.getAttachmentById(req.params.attachmentId);
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
            const attachment = attachmentServices.getAttachmentById(req.params.attachmentId);
            if (!attachment) {
                return res.status(404).json({ error: 'Attachment not found' });
            }

            const filePath = attachmentServices.getFilePath(req.params.attachmentId);
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
router.post('/tickets/:ticketId/attachments',
    [
        param('ticketId').isInt().withMessage('Ticket ID must be a valid integer'),
        handleValidationErrors
    ],
    (req, res) => {
        try {
            if (!req.files || Object.keys(req.files).length === 0) {
                return res.status(400).json({ error: 'No files were uploaded' });
            }

            const uploadedFile = req.files.file;
            if (!uploadedFile) {
                return res.status(400).json({ error: 'No file provided' });
            }

            // Get user ID from session (you'll need to implement this based on your auth system)
            const uploadedBy = req.user?.id || 1; // Default to admin user for now

            const attachment = attachmentServices.createAttachment(
                req.params.ticketId,
                uploadedFile,
                uploadedBy
            );

            res.status(201).json(attachment);
        } catch (error) {
            console.error('Error uploading attachment:', error);
            res.status(500).json({ error: 'Failed to upload attachment' });
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

            const result = attachmentServices.deleteAttachment(req.params.attachmentId, deletedBy);
            
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
            const result = attachmentServices.cleanupOrphanedFiles();
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