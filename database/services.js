const dbManager = require('./db');

class DatabaseServices {
    constructor() {
        this.db = dbManager.getDb();
    }

    // ==================== USER SERVICES ====================

    // Get all users
    getUsers() {
        return this.db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    }

    // Get user by ID
    getUserById(id) {
        return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }

    // Get user by email
    getUserByEmail(email) {
        return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }

    // Create new user
    createUser(userData) {
        const stmt = this.db.prepare(`
            INSERT INTO users (email, name, role, department) 
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(userData.email, userData.name, userData.role || 'user', userData.department);
        return { id: result.lastInsertRowid, ...userData };
    }

    // Update user
    updateUser(id, userData) {
        const stmt = this.db.prepare(`
            UPDATE users 
            SET name = ?, role = ?, department = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);
        return stmt.run(userData.name, userData.role, userData.department, id);
    }

    // Delete user
    deleteUser(id) {
        return this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    }

    // ==================== TICKET SERVICES ====================

    // Get all tickets with related data
    getTickets() {
        return this.db.prepare(`
            SELECT 
                t.*,
                u1.name as requester_name,
                u1.email as requester_email,
                u2.name as assignee_name,
                tc.name as category_name,
                tp.name as priority_name,
                tp.color as priority_color,
                ts.name as status_name,
                ts.color as status_color
            FROM tickets t
            LEFT JOIN users u1 ON t.requester_id = u1.id
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            LEFT JOIN ticket_categories tc ON t.category_id = tc.id
            LEFT JOIN ticket_priorities tp ON t.priority_id = tp.id
            LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
            ORDER BY t.created_at DESC
        `).all();
    }

    // Get ticket by ID
    getTicketById(id) {
        const ticket = this.db.prepare(`
            SELECT 
                t.*,
                u1.name as requester_name,
                u1.email as requester_email,
                u2.name as assignee_name,
                tc.name as category_name,
                tp.name as priority_name,
                tp.color as priority_color,
                ts.name as status_name,
                ts.color as status_color
            FROM tickets t
            LEFT JOIN users u1 ON t.requester_id = u1.id
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            LEFT JOIN ticket_categories tc ON t.category_id = tc.id
            LEFT JOIN ticket_priorities tp ON t.priority_id = tp.id
            LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
            WHERE t.id = ?
        `).get(id);

        if (ticket) {
            // Get timeline entries
            ticket.timeline = this.getTicketTimeline(id);
        }

        return ticket;
    }

    // Get ticket by ticket_id (e.g., TKT-001)
    getTicketByTicketId(ticketId) {
        const ticket = this.db.prepare(`
            SELECT 
                t.*,
                u1.name as requester_name,
                u1.email as requester_email,
                u2.name as assignee_name,
                tc.name as category_name,
                tp.name as priority_name,
                tp.color as priority_color,
                ts.name as status_name,
                ts.color as status_color
            FROM tickets t
            LEFT JOIN users u1 ON t.requester_id = u1.id
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            LEFT JOIN ticket_categories tc ON t.category_id = tc.id
            LEFT JOIN ticket_priorities tp ON t.priority_id = tp.id
            LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
            WHERE t.ticket_id = ?
        `).get(ticketId);

        if (ticket) {
            // Get timeline entries
            ticket.timeline = this.getTicketTimeline(ticket.id);
        }

        return ticket;
    }

    // Get ticket timeline
    getTicketTimeline(ticketId) {
        return this.db.prepare(`
            SELECT * FROM ticket_timeline 
            WHERE ticket_id = ? 
            ORDER BY created_at DESC
        `).all(ticketId);
    }

    // Create new ticket
    createTicket(ticketData) {
        // Get next ticket ID
        const lastTicket = this.db.prepare('SELECT ticket_id FROM tickets ORDER BY id DESC LIMIT 1').get();
        let nextNumber = 1;
        if (lastTicket) {
            const match = lastTicket.ticket_id.match(/TKT-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }
        const ticketId = `TKT-${String(nextNumber).padStart(3, '0')}`;

        // Get or create user
        let user = this.getUserByEmail(ticketData.email);
        if (!user) {
            user = this.createUser({
                email: ticketData.email,
                name: ticketData.requester || 'Unknown User',
                role: 'user'
            });
        }

        // Get category, priority, and status IDs
        const category = this.db.prepare('SELECT id FROM ticket_categories WHERE name = ?').get(ticketData.category || 'other');
        const priority = this.db.prepare('SELECT id FROM ticket_priorities WHERE name = ?').get(ticketData.priority || 'medium');
        const status = this.db.prepare('SELECT id FROM ticket_statuses WHERE name = ?').get('open');

        // Insert ticket
        const stmt = this.db.prepare(`
            INSERT INTO tickets (
                ticket_id, subject, description, requester_id, 
                category_id, priority_id, status_id, email
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            ticketId,
            ticketData.subject,
            ticketData.description,
            user.id,
            category ? category.id : 6, // Default to 'other'
            priority ? priority.id : 2, // Default to 'medium'
            status ? status.id : 1, // Default to 'open'
            ticketData.email
        );

        const ticketDbId = result.lastInsertRowid;

        // Create initial timeline entries
        this.createTimelineEntry(ticketDbId, {
            author: 'System',
            authorType: 'system',
            content: `Hello ${ticketData.requester}! Thank you for submitting your ticket. We have received your request and will begin working on it shortly.`,
            entryType: 'greeting'
        });

        this.createTimelineEntry(ticketDbId, {
            author: 'System',
            authorType: 'system',
            content: this.getPriorityBasedMessage(ticketData.priority || 'medium'),
            entryType: 'priority-info'
        });

        this.createTimelineEntry(ticketDbId, {
            author: 'System',
            authorType: 'system',
            content: `Ticket created with ID: ${ticketId}. Status: Open.`,
            entryType: 'creation'
        });

        return this.getTicketById(ticketDbId);
    }

    // Update ticket
    updateTicket(id, ticketData) {
        const stmt = this.db.prepare(`
            UPDATE tickets 
            SET subject = ?, description = ?, assignee_id = ?, 
                category_id = ?, priority_id = ?, status_id = ?, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        // Get related IDs
        const category = this.db.prepare('SELECT id FROM ticket_categories WHERE name = ?').get(ticketData.category);
        const priority = this.db.prepare('SELECT id FROM ticket_priorities WHERE name = ?').get(ticketData.priority);
        const status = this.db.prepare('SELECT id FROM ticket_statuses WHERE name = ?').get(ticketData.status);
        const assignee = ticketData.assignee ? this.getUserByEmail(ticketData.assignee) : null;

        return stmt.run(
            ticketData.subject,
            ticketData.description,
            assignee ? assignee.id : null,
            category ? category.id : null,
            priority ? priority.id : null,
            status ? status.id : null,
            id
        );
    }

    // Create timeline entry
    createTimelineEntry(ticketId, entryData) {
        const stmt = this.db.prepare(`
            INSERT INTO ticket_timeline (
                ticket_id, author, author_type, content, entry_type
            ) VALUES (?, ?, ?, ?, ?)
        `);
        
        return stmt.run(
            ticketId,
            entryData.author,
            entryData.authorType || 'agent',
            entryData.content,
            entryData.entryType || 'note'
        );
    }

    // Get priority-based message
    getPriorityBasedMessage(priority) {
        const messages = {
            low: 'This ticket has been classified as LOW priority. Expected response time: 24-48 hours. We will address this as soon as possible.',
            medium: 'This ticket has been classified as MEDIUM priority. Expected response time: 4-8 hours. Our team will begin working on this shortly.',
            high: 'This ticket has been classified as HIGH priority. Expected response time: 1-2 hours. This will be escalated immediately to our support team.',
            critical: 'This ticket has been classified as CRITICAL priority. Expected response time: 1 hour. This will be escalated immediately to our support team.'
        };
        return messages[priority] || messages.medium;
    }

    // ==================== ASSET SERVICES ====================

    // Get all assets with related data
    getAssets() {
        return this.db.prepare(`
            SELECT 
                a.*,
                u.name as current_user_name,
                u.email as current_user_email,
                at.name as type_name,
                ast.name as status_name,
                ast.color as status_color
            FROM assets a
            LEFT JOIN users u ON a.current_user_id = u.id
            LEFT JOIN asset_types at ON a.type_id = at.id
            LEFT JOIN asset_statuses ast ON a.status_id = ast.id
            ORDER BY a.created_at DESC
        `).all();
    }

    // Get asset by ID
    getAssetById(id) {
        return this.db.prepare(`
            SELECT 
                a.*,
                u.name as current_user_name,
                u.email as current_user_email,
                at.name as type_name,
                ast.name as status_name,
                ast.color as status_color
            FROM assets a
            LEFT JOIN users u ON a.current_user_id = u.id
            LEFT JOIN asset_types at ON a.type_id = at.id
            LEFT JOIN asset_statuses ast ON a.status_id = ast.id
            WHERE a.id = ?
        `).get(id);
    }

    // Get asset by asset_no
    getAssetByAssetNo(assetNo) {
        return this.db.prepare(`
            SELECT 
                a.*,
                u.name as current_user_name,
                u.email as current_user_email,
                at.name as type_name,
                ast.name as status_name,
                ast.color as status_color
            FROM assets a
            LEFT JOIN users u ON a.current_user_id = u.id
            LEFT JOIN asset_types at ON a.type_id = at.id
            LEFT JOIN asset_statuses ast ON a.status_id = ast.id
            WHERE a.asset_no = ?
        `).get(assetNo);
    }

    // Create new asset
    createAsset(assetData) {
        // Get or create user if email is provided
        let currentUserId = null;
        if (assetData.email) {
            let user = this.getUserByEmail(assetData.email);
            if (!user) {
                user = this.createUser({
                    email: assetData.email,
                    name: assetData.currentUser || 'Unknown User',
                    role: 'user'
                });
            }
            currentUserId = user.id;
        }

        // Get type and status IDs
        const type = this.db.prepare('SELECT id FROM asset_types WHERE name = ?').get(assetData.type || 'other');
        const status = this.db.prepare('SELECT id FROM asset_statuses WHERE name = ?').get(assetData.status || 'active');

        const stmt = this.db.prepare(`
            INSERT INTO assets (
                asset_no, asset_tag, type_id, brand, model, 
                serial_number, imei, hostname, current_user_id, 
                department, status_id, purchase_date, warranty_end_date, comment
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            assetData.assetNo,
            assetData.assetTag || '',
            type ? type.id : 8, // Default to 'other'
            assetData.brand || '',
            assetData.model || '',
            assetData.serial || '',
            assetData.imei || '',
            assetData.hostname || '',
            currentUserId,
            assetData.department || '',
            status ? status.id : 1, // Default to 'active'
            assetData.purchaseDate || assetData.date || null,
            assetData.warrantyEndDate || assetData.warranty || null,
            assetData.comment || ''
        );

        return this.getAssetById(result.lastInsertRowid);
    }

    // Update asset
    updateAsset(id, assetData) {
        // Get or create user if email is provided
        let currentUserId = null;
        if (assetData.email) {
            let user = this.getUserByEmail(assetData.email);
            if (!user) {
                user = this.createUser({
                    email: assetData.email,
                    name: assetData.currentUser || 'Unknown User',
                    role: 'user'
                });
            }
            currentUserId = user.id;
        }

        // Get type and status IDs
        const type = this.db.prepare('SELECT id FROM asset_types WHERE name = ?').get(assetData.type);
        const status = this.db.prepare('SELECT id FROM asset_statuses WHERE name = ?').get(assetData.status);

        const stmt = this.db.prepare(`
            UPDATE assets 
            SET asset_tag = ?, type_id = ?, brand = ?, model = ?, 
                serial_number = ?, imei = ?, hostname = ?, current_user_id = ?, 
                department = ?, status_id = ?, purchase_date = ?, 
                warranty_end_date = ?, comment = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        return stmt.run(
            assetData.assetTag,
            type ? type.id : null,
            assetData.brand,
            assetData.model,
            assetData.serial,
            assetData.imei,
            assetData.hostname,
            currentUserId,
            assetData.department,
            status ? status.id : null,
            assetData.purchaseDate,
            assetData.warrantyEndDate,
            assetData.comment,
            id
        );
    }

    // Delete asset
    deleteAsset(id) {
        return this.db.prepare('DELETE FROM assets WHERE id = ?').run(id);
    }

    // ==================== SESSION SERVICES ====================

    // Create user session
    createUserSession(userId, sessionToken, deviceId) {
        const stmt = this.db.prepare(`
            INSERT INTO user_sessions (user_id, session_token, device_id, expires_at)
            VALUES (?, ?, ?, datetime('now', '+1 day'))
        `);
        return stmt.run(userId, sessionToken, deviceId);
    }

    // Get user session
    getUserSession(sessionToken) {
        return this.db.prepare(`
            SELECT us.*, u.email, u.name, u.role
            FROM user_sessions us
            JOIN users u ON us.user_id = u.id
            WHERE us.session_token = ? AND us.expires_at > datetime('now')
        `).get(sessionToken);
    }

    // Delete user session
    deleteUserSession(sessionToken) {
        return this.db.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
    }

    // Create admin session
    createAdminSession(username, sessionToken) {
        const stmt = this.db.prepare(`
            INSERT INTO admin_sessions (username, session_token, expires_at)
            VALUES (?, ?, datetime('now', '+1 day'))
        `);
        return stmt.run(username, sessionToken);
    }

    // Get admin session
    getAdminSession(sessionToken) {
        return this.db.prepare(`
            SELECT * FROM admin_sessions 
            WHERE session_token = ? AND expires_at > datetime('now')
        `).get(sessionToken);
    }

    // Delete admin session
    deleteAdminSession(sessionToken) {
        return this.db.prepare('DELETE FROM admin_sessions WHERE session_token = ?').run(sessionToken);
    }

    // ==================== OTP SERVICES ====================

    // Store OTP
    storeOTP(email, otp) {
        const stmt = this.db.prepare(`
            INSERT INTO otp_store (email, otp, expires_at)
            VALUES (?, ?, datetime('now', '+5 minutes'))
        `);
        return stmt.run(email, otp);
    }

    // Get OTP
    getOTP(email) {
        return this.db.prepare(`
            SELECT * FROM otp_store 
            WHERE email = ? AND expires_at > datetime('now')
            ORDER BY created_at DESC LIMIT 1
        `).get(email);
    }

    // Delete OTP
    deleteOTP(email) {
        return this.db.prepare('DELETE FROM otp_store WHERE email = ?').run(email);
    }

    // ==================== UTILITY SERVICES ====================

    // Get dashboard statistics
    getDashboardStats() {
        const stats = {
            totalTickets: this.db.prepare('SELECT COUNT(*) as count FROM tickets').get().count,
            openTickets: this.db.prepare(`
                SELECT COUNT(*) as count FROM tickets t
                JOIN ticket_statuses ts ON t.status_id = ts.id
                WHERE ts.name IN ('open', 'in-progress')
            `).get().count,
            closedToday: this.db.prepare(`
                SELECT COUNT(*) as count FROM tickets t
                JOIN ticket_statuses ts ON t.status_id = ts.id
                WHERE ts.name IN ('resolved', 'closed')
                AND DATE(t.updated_at) = DATE('now')
            `).get().count,
            totalAssets: this.db.prepare('SELECT COUNT(*) as count FROM assets').get().count
        };
        return stats;
    }

    // Clean up expired sessions and OTPs
    cleanupExpired() {
        this.db.prepare('DELETE FROM user_sessions WHERE expires_at <= datetime("now")').run();
        this.db.prepare('DELETE FROM admin_sessions WHERE expires_at <= datetime("now")').run();
        this.db.prepare('DELETE FROM otp_store WHERE expires_at <= datetime("now")').run();
    }
}

module.exports = new DatabaseServices(); 