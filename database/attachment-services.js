const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class AttachmentServices {
    constructor(db) {
        this.db = db;
        console.log('AttachmentServices constructor - Database:', db);
        console.log('AttachmentServices constructor - Database path:', db?.name);
        
        this.uploadDir = path.join(__dirname, '..', 'uploads');
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.allowedMimeTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        // Ensure upload directory exists
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    // Get all attachments for a ticket
    getTicketAttachments(ticketId) {
        try {
            // Handle both integer and string ticket IDs
            const isInteger = Number.isInteger(ticketId) || (typeof ticketId === 'string' && !isNaN(parseInt(ticketId)));
            
            if (isInteger) {
                // Database ticket
                const stmt = this.db.prepare(`
                    SELECT ta.*, u.name as uploaded_by_name
                    FROM ticket_attachments ta
                    LEFT JOIN users u ON ta.uploaded_by = u.id
                    WHERE ta.ticket_id = ? AND ta.is_deleted = 0
                    ORDER BY ta.uploaded_at DESC
                `);
                return stmt.all(ticketId);
            } else {
                // JSON ticket - store string ID in a separate field
                const stmt = this.db.prepare(`
                    SELECT ta.*, u.name as uploaded_by_name
                    FROM ticket_attachments ta
                    LEFT JOIN users u ON ta.uploaded_by = u.id
                    WHERE ta.json_ticket_id = ? AND ta.is_deleted = 0
                    ORDER BY ta.uploaded_at DESC
                `);
                return stmt.all(ticketId);
            }
        } catch (error) {
            console.error('Error getting ticket attachments:', error);
            return [];
        }
    }

    // Get a specific attachment
    getAttachmentById(attachmentId) {
        try {
            const stmt = this.db.prepare(`
                SELECT ta.*, u.name as uploaded_by_name
                FROM ticket_attachments ta
                LEFT JOIN users u ON ta.uploaded_by = u.id
                WHERE ta.id = ? AND ta.is_deleted = 0
            `);
            return stmt.get(attachmentId);
        } catch (error) {
            console.error('Error getting attachment:', error);
            return null;
        }
    }

    // Create a new attachment
    createAttachment(ticketId, fileData, uploadedBy) {
        try {
            console.log('Creating attachment for ticket:', ticketId);
            console.log('File data:', {
                name: fileData.name,
                size: fileData.size,
                mimetype: fileData.mimetype
            });
            
            // Validate file
            if (!this.validateFile(fileData)) {
                throw new Error('Invalid file');
            }

            // Generate unique filename
            const fileExtension = path.extname(fileData.name);
            const uniqueFilename = this.generateUniqueFilename(fileExtension);
            const filePath = path.join(this.uploadDir, uniqueFilename);

            console.log('Saving file to:', filePath);

            // Save file to disk
            fs.writeFileSync(filePath, fileData.data);

            // Handle both integer and string ticket IDs
            const isInteger = Number.isInteger(ticketId) || (typeof ticketId === 'string' && !isNaN(parseInt(ticketId)));
            
            console.log('Ticket ID type:', typeof ticketId, 'Is integer:', isInteger);
            
            let stmt, result;
            if (isInteger) {
                // Database ticket
                console.log('Using database ticket ID');
                stmt = this.db.prepare(`
                    INSERT INTO ticket_attachments 
                    (ticket_id, filename, original_filename, file_path, file_size, mime_type, uploaded_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                result = stmt.run(
                    ticketId,
                    uniqueFilename,
                    fileData.name,
                    `/uploads/${uniqueFilename}`,
                    fileData.size,
                    fileData.mimetype,
                    uploadedBy || 1 // Default to user ID 1 if not provided
                );
            } else {
                // JSON ticket - store string ID in json_ticket_id field
                console.log('Using JSON ticket ID');
                stmt = this.db.prepare(`
                    INSERT INTO ticket_attachments 
                    (json_ticket_id, filename, original_filename, file_path, file_size, mime_type, uploaded_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                result = stmt.run(
                    ticketId,
                    uniqueFilename,
                    fileData.name,
                    `/uploads/${uniqueFilename}`,
                    fileData.size,
                    fileData.mimetype,
                    uploadedBy || 1 // Default to user ID 1 if not provided
                );
            }

            console.log('Insert result:', result);
            return this.getAttachmentById(result.lastInsertRowid);
        } catch (error) {
            console.error('Error creating attachment:', error);
            console.error('Error details:', error.message);
            throw error;
        }
    }

    // Delete an attachment (soft delete)
    deleteAttachment(attachmentId, deletedBy) {
        try {
            const stmt = this.db.prepare(`
                UPDATE ticket_attachments 
                SET is_deleted = 1, deleted_at = datetime('now'), deleted_by = ?
                WHERE id = ?
            `);
            return stmt.run(deletedBy, attachmentId);
        } catch (error) {
            console.error('Error deleting attachment:', error);
            throw error;
        }
    }

    // Get file path for download
    getFilePath(attachmentId) {
        try {
            const attachment = this.getAttachmentById(attachmentId);
            if (!attachment) {
                return null;
            }
            return path.join(this.uploadDir, attachment.filename);
        } catch (error) {
            console.error('Error getting file path:', error);
            return null;
        }
    }

    // Validate file
    validateFile(fileData) {
        // Check file size
        if (fileData.size > this.maxFileSize) {
            return false;
        }

        // Check MIME type
        if (!this.allowedMimeTypes.includes(fileData.mimetype)) {
            return false;
        }

        return true;
    }

    // Generate unique filename
    generateUniqueFilename(extension) {
        const timestamp = Date.now();
        const random = crypto.randomBytes(8).toString('hex');
        return `${timestamp}_${random}${extension}`;
    }

    // Get attachment statistics
    getAttachmentStats() {
        try {
            const stmt = this.db.prepare(`
                SELECT 
                    COUNT(*) as total_attachments,
                    SUM(file_size) as total_size,
                    COUNT(DISTINCT ticket_id) as tickets_with_attachments
                FROM ticket_attachments 
                WHERE is_deleted = 0
            `);
            return stmt.get();
        } catch (error) {
            console.error('Error getting attachment stats:', error);
            return { total_attachments: 0, total_size: 0, tickets_with_attachments: 0 };
        }
    }

    // Clean up orphaned files
    cleanupOrphanedFiles() {
        try {
            const stmt = this.db.prepare(`
                SELECT file_path FROM ticket_attachments 
                WHERE is_deleted = 1 AND deleted_at < datetime('now', '-30 days')
            `);
            const orphanedFiles = stmt.all();

            orphanedFiles.forEach(file => {
                const filePath = path.join(__dirname, '..', file.file_path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });

            // Delete orphaned records
            const deleteStmt = this.db.prepare(`
                DELETE FROM ticket_attachments 
                WHERE is_deleted = 1 AND deleted_at < datetime('now', '-30 days')
            `);
            return deleteStmt.run();
        } catch (error) {
            console.error('Error cleaning up orphaned files:', error);
            throw error;
        }
    }
}

module.exports = AttachmentServices; 