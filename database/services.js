const dbManager = require('./db');

class DatabaseServices {
    constructor() {
        this.db = dbManager.getDb();
    }

    // ==================== USER SERVICES ====================

    // Get all users with pagination and filtering
    getUsers(options = {}) {
        const {
            page = 1,
            limit = 20,
            search = '',
            role = '',
            status = '',
            sortBy = 'created_at',
            sortOrder = 'desc'
        } = options;

        // Build query conditions
        let conditions = [];
        let params = [];

        if (search) {
            conditions.push('(name LIKE ? OR email LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        if (role) {
            conditions.push('role = ?');
            params.push(role);
        }

        if (status) {
            if (status === 'active') {
                conditions.push('is_active = 1');
            } else if (status === 'inactive') {
                conditions.push('is_active = 0');
            }
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const offset = (page - 1) * limit;

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
        const totalResult = this.db.prepare(countQuery).get(...params);
        const total = totalResult.total;

        // Get users with pagination
        const usersQuery = `
            SELECT 
                id, email, name, role, department, is_active,
                last_login, created_at, updated_at
            FROM users 
            ${whereClause}
            ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
            LIMIT ? OFFSET ?
        `;
        
        const users = this.db.prepare(usersQuery).all(...params, limit, offset);

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        return {
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNext,
                hasPrev
            },
            filters: {
                search,
                role,
                status,
                sortBy,
                sortOrder
            }
        };
    }

    // Get all users (for export)
    getAllUsers() {
        return this.db.prepare(`
            SELECT 
                id, email, name, role, department, is_active,
                last_login, created_at, updated_at
            FROM users 
            ORDER BY created_at DESC
        `).all();
    }

    // Get user by ID
    getUserById(id) {
        return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }

    // Get user by email
    getUserByEmail(email) {
        return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }

    // Get user by email verification token
    getUserByVerificationToken(token) {
        return this.db.prepare('SELECT * FROM users WHERE email_verification_token = ?').get(token);
    }

    // Create new user with password
    async createUser(userData) {
        const { name, email, role, password, department } = userData;
        
        // Hash password if provided
        let passwordHash = null;
        if (password) {
            const bcrypt = require('bcrypt');
            passwordHash = await bcrypt.hash(password, 10);
        }

        // Try to insert with password_hash first (enhanced schema)
        try {
            const stmt = this.db.prepare(`
                INSERT INTO users (email, name, role, department, password_hash, is_active) 
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                email, 
                name, 
                role || 'user', 
                department || null,
                passwordHash,
                1 // is_active
            );
            
            return this.getUserById(result.lastInsertRowid);
        } catch (error) {
            // If password_hash column doesn't exist, fall back to basic schema
            console.log('Enhanced schema not available, using basic schema for user creation');
            const stmt = this.db.prepare(`
                INSERT INTO users (email, name, role, department, is_active) 
                VALUES (?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                email, 
                name, 
                role || 'user', 
                department || null,
                1 // is_active
            );
            
            return this.getUserById(result.lastInsertRowid);
        }
    }

    // Update user
    updateUser(id, userData) {
        const updates = [];
        const params = [];

        if (userData.name !== undefined) {
            updates.push('name = ?');
            params.push(userData.name);
        }
        if (userData.email !== undefined) {
            updates.push('email = ?');
            params.push(userData.email);
        }
        if (userData.role !== undefined) {
            updates.push('role = ?');
            params.push(userData.role);
        }
        if (userData.department !== undefined) {
            updates.push('department = ?');
            params.push(userData.department);
        }
        if (userData.is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(userData.is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            return { changes: 0 };
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        const stmt = this.db.prepare(`
            UPDATE users 
            SET ${updates.join(', ')}
            WHERE id = ?
        `);
        
        const result = stmt.run(...params);
        return this.getUserById(id);
    }

    // Update user password
    updateUserPassword(id, passwordHash) {
        const stmt = this.db.prepare(`
            UPDATE users 
            SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);
        return stmt.run(passwordHash, id);
    }

    // Update user verification status
    updateUserVerification(id, isVerified, verificationToken = null) {
        const stmt = this.db.prepare(`
            UPDATE users 
            SET is_verified = ?, email_verification_token = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);
        return stmt.run(isVerified ? 1 : 0, verificationToken, id);
    }

    // Set password reset token
    setPasswordResetToken(email, resetToken, expiresAt) {
        const stmt = this.db.prepare(`
            UPDATE users 
            SET password_reset_token = ?, password_reset_expires = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE email = ?
        `);
        return stmt.run(resetToken, expiresAt, email);
    }

    // Get user by password reset token
    getUserByResetToken(resetToken) {
        return this.db.prepare(`
            SELECT * FROM users 
            WHERE password_reset_token = ? AND password_reset_expires > datetime('now')
        `).get(resetToken);
    }

    // Clear password reset token
    clearPasswordResetToken(email) {
        const stmt = this.db.prepare(`
            UPDATE users 
            SET password_reset_token = NULL, password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP 
            WHERE email = ?
        `);
        return stmt.run(email);
    }

    // Update failed login attempts
    updateFailedLoginAttempts(email, attempts, lockedUntil = null) {
        const stmt = this.db.prepare(`
            UPDATE users 
            SET failed_login_attempts = ?, account_locked_until = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE email = ?
        `);
        return stmt.run(attempts, lockedUntil, email);
    }

    // Update last login
    updateLastLogin(id) {
        const stmt = this.db.prepare(`
            UPDATE users 
            SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0, account_locked_until = NULL, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);
        return stmt.run(id);
    }

    // Delete user
    deleteUser(id) {
        return this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    }

    // Bulk update users
    async bulkUpdateUsers(userIds, updates) {
        let updated = 0;
        let failed = 0;

        for (const userId of userIds) {
            try {
                const user = this.getUserById(userId);
                if (!user) {
                    failed++;
                    continue;
                }

                // Prepare update data
                const updateData = {};
                if (updates.name) updateData.name = updates.name;
                if (updates.email) updateData.email = updates.email;
                if (updates.role) updateData.role = updates.role;
                if (updates.department !== undefined) updateData.department = updates.department;
                if (updates.isActive !== undefined) updateData.is_active = updates.isActive ? 1 : 0;

                if (Object.keys(updateData).length > 0) {
                    this.updateUser(userId, updateData);
                    updated++;
                }
            } catch (error) {
                failed++;
            }
        }

        return { updated, failed };
    }

    // Bulk delete users
    async bulkDeleteUsers(userIds) {
        let deleted = 0;
        let failed = 0;

        for (const userId of userIds) {
            try {
                const user = this.getUserById(userId);
                if (!user) {
                    failed++;
                    continue;
                }

                this.deleteUser(userId);
                deleted++;
            } catch (error) {
                failed++;
            }
        }

        return { deleted, failed };
    }

    // Get user statistics
    getUserStats() {
        const stats = {
            total: this.db.prepare('SELECT COUNT(*) as count FROM users').get().count,
            active: this.db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count,
            inactive: this.db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 0').get().count,
            verified: this.db.prepare('SELECT COUNT(*) as count FROM users').get().count, // All users are considered verified in this schema
            unverified: 0, // No unverified users in this schema
            byRole: this.db.prepare(`
                SELECT role, COUNT(*) as count 
                FROM users 
                GROUP BY role
            `).all(),
            recentRegistrations: this.db.prepare(`
                SELECT COUNT(*) as count 
                FROM users 
                WHERE created_at >= datetime('now', '-7 days')
            `).get().count,
            recentLogins: this.db.prepare(`
                SELECT COUNT(*) as count 
                FROM users 
                WHERE last_login >= datetime('now', '-7 days')
            `).get().count
        };

        return stats;
    }

    // ==================== JWT TOKEN SERVICES ====================

    // Store JWT refresh token
    storeRefreshToken(userId, refreshToken, deviceId, deviceInfo = null, expiresAt) {
        const stmt = this.db.prepare(`
            INSERT INTO jwt_refresh_tokens (user_id, refresh_token, device_id, device_info, expires_at) 
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(userId, refreshToken, deviceId, deviceInfo, expiresAt);
    }

    // Get refresh token
    getRefreshToken(refreshToken) {
        return this.db.prepare(`
            SELECT * FROM jwt_refresh_tokens 
            WHERE refresh_token = ? AND is_revoked = 0 AND expires_at > datetime('now')
        `).get(refreshToken);
    }

    // Revoke refresh token
    revokeRefreshToken(refreshToken) {
        const stmt = this.db.prepare(`
            UPDATE jwt_refresh_tokens 
            SET is_revoked = 1 
            WHERE refresh_token = ?
        `);
        return stmt.run(refreshToken);
    }

    // Revoke all refresh tokens for user
    revokeAllUserTokens(userId) {
        const stmt = this.db.prepare(`
            UPDATE jwt_refresh_tokens 
            SET is_revoked = 1 
            WHERE user_id = ?
        `);
        return stmt.run(userId);
    }

    // Revoke all refresh tokens for user on specific device
    revokeUserDeviceTokens(userId, deviceId) {
        const stmt = this.db.prepare(`
            UPDATE jwt_refresh_tokens 
            SET is_revoked = 1 
            WHERE user_id = ? AND device_id = ?
        `);
        return stmt.run(userId, deviceId);
    }

    // Get user's active refresh tokens
    getUserRefreshTokens(userId) {
        return this.db.prepare(`
            SELECT * FROM jwt_refresh_tokens 
            WHERE user_id = ? AND is_revoked = 0 AND expires_at > datetime('now')
            ORDER BY created_at DESC
        `).all(userId);
    }

    // ==================== AUTH AUDIT LOG SERVICES ====================

    // Log authentication event
    logAuthEvent(auditData) {
        const stmt = this.db.prepare(`
            INSERT INTO auth_audit_log (user_id, email, action, ip_address, user_agent, device_id, success, details) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            auditData.userId || null,
            auditData.email,
            auditData.action,
            auditData.ipAddress || null,
            auditData.userAgent || null,
            auditData.deviceId || null,
            auditData.success ? 1 : 0,
            auditData.details ? JSON.stringify(auditData.details) : null
        );
    }

    // Get auth audit log for user
    getAuthAuditLog(userId, limit = 50) {
        return this.db.prepare(`
            SELECT * FROM auth_audit_log 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        `).all(userId, limit);
    }

    // ==================== PERMISSION SERVICES ====================

    // Get user permissions
    getUserPermissions(userId) {
        return this.db.prepare(`
            SELECT resource, action, granted FROM user_permissions 
            WHERE user_id = ?
        `).all(userId);
    }

    // Get role permissions
    getRolePermissions(role) {
        return this.db.prepare(`
            SELECT resource, action, granted FROM role_permissions 
            WHERE role = ?
        `).all(role);
    }

    // Check if user has permission
    hasPermission(userId, resource, action) {
        // First check user-specific permissions
        const userPermission = this.db.prepare(`
            SELECT granted FROM user_permissions 
            WHERE user_id = ? AND resource = ? AND action = ?
        `).get(userId, resource, action);

        if (userPermission !== undefined) {
            return userPermission.granted === 1;
        }

        // Then check role permissions
        const user = this.getUserById(userId);
        if (!user) return false;

        const rolePermission = this.db.prepare(`
            SELECT granted FROM role_permissions 
            WHERE role = ? AND resource = ? AND action = ?
        `).get(user.role, resource, action);

        return rolePermission ? rolePermission.granted === 1 : false;
    }

    // Grant permission to user
    grantUserPermission(userId, resource, action) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO user_permissions (user_id, resource, action, granted) 
            VALUES (?, ?, ?, 1)
        `);
        return stmt.run(userId, resource, action);
    }

    // Revoke permission from user
    revokeUserPermission(userId, resource, action) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO user_permissions (user_id, resource, action, granted) 
            VALUES (?, ?, ?, 0)
        `);
        return stmt.run(userId, resource, action);
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
        // Build dynamic update query based on provided fields
        let updateFields = [];
        let updateValues = [];
        
        if (ticketData.subject !== undefined) {
            updateFields.push('subject = ?');
            updateValues.push(ticketData.subject);
        }
        
        if (ticketData.description !== undefined) {
            updateFields.push('description = ?');
            updateValues.push(ticketData.description);
        }
        
        if (ticketData.assignee !== undefined) {
            updateFields.push('assignee_id = ?');
            const assignee = ticketData.assignee ? this.getUserByEmail(ticketData.assignee) : null;
            updateValues.push(assignee ? assignee.id : null);
        }
        
        if (ticketData.category !== undefined) {
            updateFields.push('category_id = ?');
            const category = this.db.prepare('SELECT id FROM ticket_categories WHERE name = ?').get(ticketData.category);
            updateValues.push(category ? category.id : null);
        }
        
        if (ticketData.priority !== undefined) {
            updateFields.push('priority_id = ?');
            const priority = this.db.prepare('SELECT id FROM ticket_priorities WHERE name = ?').get(ticketData.priority);
            updateValues.push(priority ? priority.id : null);
        }
        
        if (ticketData.status !== undefined) {
            updateFields.push('status_id = ?');
            const status = this.db.prepare('SELECT id FROM ticket_statuses WHERE name = ?').get(ticketData.status);
            updateValues.push(status ? status.id : null);
        }
        
        // Always update the updated_at timestamp
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        
        if (updateFields.length === 0) {
            return { changes: 0 };
        }
        
        const updateQuery = `UPDATE tickets SET ${updateFields.join(', ')} WHERE id = ?`;
        updateValues.push(id);
        
        const stmt = this.db.prepare(updateQuery);
        return stmt.run(...updateValues);
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

    // ==================== ADVANCED TICKET FILTERING AND SEARCH ====================

    // Advanced ticket search with multiple criteria
    searchTickets(filters = {}, options = {}) {
        let query = `
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
        `;

        const conditions = [];
        const params = [];

        // Text search
        if (filters.search) {
            conditions.push(`(
                t.subject LIKE ? OR 
                t.description LIKE ? OR 
                t.ticket_id LIKE ? OR
                u1.name LIKE ? OR 
                u1.email LIKE ? OR
                u2.name LIKE ? OR
                u2.email LIKE ?
            )`);
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Status filter
        if (filters.status) {
            if (Array.isArray(filters.status)) {
                const placeholders = filters.status.map(() => '?').join(',');
                conditions.push(`ts.name IN (${placeholders})`);
                params.push(...filters.status);
            } else {
                conditions.push('ts.name = ?');
                params.push(filters.status);
            }
        }

        // Priority filter
        if (filters.priority) {
            if (Array.isArray(filters.priority)) {
                const placeholders = filters.priority.map(() => '?').join(',');
                conditions.push(`tp.name IN (${placeholders})`);
                params.push(...filters.priority);
            } else {
                conditions.push('tp.name = ?');
                params.push(filters.priority);
            }
        }

        // Category filter
        if (filters.category) {
            if (Array.isArray(filters.category)) {
                const placeholders = filters.category.map(() => '?').join(',');
                conditions.push(`tc.name IN (${placeholders})`);
                params.push(...filters.category);
            } else {
                conditions.push('tc.name = ?');
                params.push(filters.category);
            }
        }

        // Assignee filter
        if (filters.assignee) {
            if (filters.assignee === 'unassigned') {
                conditions.push('t.assignee_id IS NULL');
            } else {
                conditions.push('u2.email = ?');
                params.push(filters.assignee);
            }
        }

        // Requester filter
        if (filters.requester) {
            conditions.push('u1.email = ?');
            params.push(filters.requester);
        }

        // Date range filters
        if (filters.createdAfter) {
            conditions.push('t.created_at >= ?');
            params.push(filters.createdAfter);
        }

        if (filters.createdBefore) {
            conditions.push('t.created_at <= ?');
            params.push(filters.createdBefore);
        }

        if (filters.updatedAfter) {
            conditions.push('t.updated_at >= ?');
            params.push(filters.updatedAfter);
        }

        if (filters.updatedBefore) {
            conditions.push('t.updated_at <= ?');
            params.push(filters.updatedBefore);
        }

        // Resolution time filter
        if (filters.resolvedAfter) {
            conditions.push('t.resolved_at >= ?');
            params.push(filters.resolvedAfter);
        }

        if (filters.resolvedBefore) {
            conditions.push('t.resolved_at <= ?');
            params.push(filters.resolvedBefore);
        }

        // Department filter (if available)
        if (filters.department) {
            conditions.push('u1.department = ?');
            params.push(filters.department);
        }

        // Add WHERE clause if conditions exist
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // Add ORDER BY
        const orderBy = options.orderBy || 't.created_at';
        const orderDirection = options.orderDirection || 'DESC';
        query += ` ORDER BY ${orderBy} ${orderDirection}`;

        // Add LIMIT and OFFSET for pagination
        if (options.limit) {
            query += ' LIMIT ?';
            params.push(options.limit);
            
            if (options.offset) {
                query += ' OFFSET ?';
                params.push(options.offset);
            }
        }

        return this.db.prepare(query).all(...params);
    }

    // Get ticket search statistics
    getTicketSearchStats(filters = {}) {
        let query = `
            SELECT 
                COUNT(*) as total_tickets,
                COUNT(CASE WHEN ts.name IN ('open', 'in-progress') THEN 1 END) as open_tickets,
                COUNT(CASE WHEN ts.name = 'resolved' THEN 1 END) as resolved_tickets,
                COUNT(CASE WHEN ts.name = 'closed' THEN 1 END) as closed_tickets,
                AVG(CASE WHEN t.resolved_at IS NOT NULL 
                    THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24 
                    END) as avg_resolution_hours
            FROM tickets t
            LEFT JOIN users u1 ON t.requester_id = u1.id
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            LEFT JOIN ticket_categories tc ON t.category_id = tc.id
            LEFT JOIN ticket_priorities tp ON t.priority_id = tp.id
            LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
        `;

        const conditions = [];
        const params = [];

        // Apply same filters as searchTickets
        if (filters.search) {
            conditions.push(`(
                t.subject LIKE ? OR 
                t.description LIKE ? OR 
                t.ticket_id LIKE ? OR
                u1.name LIKE ? OR 
                u1.email LIKE ? OR
                u2.name LIKE ? OR
                u2.email LIKE ?
            )`);
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (filters.status) {
            if (Array.isArray(filters.status)) {
                const placeholders = filters.status.map(() => '?').join(',');
                conditions.push(`ts.name IN (${placeholders})`);
                params.push(...filters.status);
            } else {
                conditions.push('ts.name = ?');
                params.push(filters.status);
            }
        }

        if (filters.priority) {
            if (Array.isArray(filters.priority)) {
                const placeholders = filters.priority.map(() => '?').join(',');
                conditions.push(`tp.name IN (${placeholders})`);
                params.push(...filters.priority);
            } else {
                conditions.push('tp.name = ?');
                params.push(filters.priority);
            }
        }

        if (filters.category) {
            if (Array.isArray(filters.category)) {
                const placeholders = filters.category.map(() => '?').join(',');
                conditions.push(`tc.name IN (${placeholders})`);
                params.push(...filters.category);
            } else {
                conditions.push('tc.name = ?');
                params.push(filters.category);
            }
        }

        if (filters.assignee) {
            if (filters.assignee === 'unassigned') {
                conditions.push('t.assignee_id IS NULL');
            } else {
                conditions.push('u2.email = ?');
                params.push(filters.assignee);
            }
        }

        if (filters.requester) {
            conditions.push('u1.email = ?');
            params.push(filters.requester);
        }

        if (filters.createdAfter) {
            conditions.push('t.created_at >= ?');
            params.push(filters.createdAfter);
        }

        if (filters.createdBefore) {
            conditions.push('t.created_at <= ?');
            params.push(filters.createdBefore);
        }

        if (filters.updatedAfter) {
            conditions.push('t.updated_at >= ?');
            params.push(filters.updatedAfter);
        }

        if (filters.updatedBefore) {
            conditions.push('t.updated_at <= ?');
            params.push(filters.updatedBefore);
        }

        if (filters.resolvedAfter) {
            conditions.push('t.resolved_at >= ?');
            params.push(filters.resolvedAfter);
        }

        if (filters.resolvedBefore) {
            conditions.push('t.resolved_at <= ?');
            params.push(filters.resolvedBefore);
        }

        if (filters.department) {
            conditions.push('u1.department = ?');
            params.push(filters.department);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        return this.db.prepare(query).get(...params);
    }

    // Get available filter options
    getTicketFilterOptions() {
        const options = {
            statuses: this.db.prepare('SELECT DISTINCT name FROM ticket_statuses ORDER BY name').all(),
            priorities: this.db.prepare('SELECT DISTINCT name FROM ticket_priorities ORDER BY name').all(),
            categories: this.db.prepare('SELECT DISTINCT name FROM ticket_categories ORDER BY name').all(),
            assignees: this.db.prepare(`
                SELECT DISTINCT u.email, u.name 
                FROM users u 
                JOIN tickets t ON u.id = t.assignee_id 
                WHERE u.role IN ('admin', 'manager', 'technician')
                ORDER BY u.name
            `).all(),
            requesters: this.db.prepare(`
                SELECT DISTINCT u.email, u.name 
                FROM users u 
                JOIN tickets t ON u.id = t.requester_id 
                ORDER BY u.name
            `).all(),
            departments: this.db.prepare(`
                SELECT DISTINCT department 
                FROM users 
                WHERE department IS NOT NULL AND department != ''
                ORDER BY department
            `).all()
        };

        return options;
    }

    // ==================== ENHANCED REPORTING AND ANALYTICS ====================

    // Get ticket volume and trend reports
    getTicketVolumeReport(timeRange = '30d', groupBy = 'day') {
        const dateFormat = groupBy === 'day' ? '%Y-%m-%d' : 
                          groupBy === 'week' ? '%Y-W%W' : 
                          groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
        
        const daysAgo = timeRange === '7d' ? 7 : 
                       timeRange === '30d' ? 30 : 
                       timeRange === '90d' ? 90 : 30;

        return this.db.prepare(`
            SELECT 
                strftime('${dateFormat}', created_at) as period,
                COUNT(*) as total_tickets,
                COUNT(CASE WHEN status_id IN (SELECT id FROM ticket_statuses WHERE name IN ('open', 'in-progress')) THEN 1 END) as open_tickets,
                COUNT(CASE WHEN status_id IN (SELECT id FROM ticket_statuses WHERE name = 'resolved') THEN 1 END) as resolved_tickets,
                COUNT(CASE WHEN status_id IN (SELECT id FROM ticket_statuses WHERE name = 'closed') THEN 1 END) as closed_tickets
            FROM tickets 
            WHERE created_at >= datetime('now', '-${daysAgo} days')
            GROUP BY period
            ORDER BY period
        `).all();
    }

    // Get SLA compliance reporting
    getSLAComplianceReport(timeRange = '30d') {
        const daysAgo = timeRange === '7d' ? 7 : 
                       timeRange === '30d' ? 30 : 
                       timeRange === '90d' ? 90 : 30;

        return this.db.prepare(`
            SELECT 
                tp.name as priority,
                COUNT(*) as total_tickets,
                COUNT(CASE WHEN t.resolved_at IS NOT NULL THEN 1 END) as resolved_tickets,
                COUNT(CASE WHEN t.resolved_at IS NOT NULL AND 
                    (julianday(t.resolved_at) - julianday(t.created_at)) * 24 <= 
                    CASE tp.name 
                        WHEN 'critical' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 8
                        WHEN 'low' THEN 48
                        ELSE 8
                    END THEN 1 END) as sla_compliant,
                AVG(CASE WHEN t.resolved_at IS NOT NULL 
                    THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24 
                    END) as avg_resolution_hours
            FROM tickets t
            JOIN ticket_priorities tp ON t.priority_id = tp.id
            WHERE t.created_at >= datetime('now', '-${daysAgo} days')
            GROUP BY tp.name
            ORDER BY tp.name
        `).all();
    }

    // Get technician performance metrics
    getTechnicianPerformanceReport(timeRange = '30d') {
        const daysAgo = timeRange === '7d' ? 7 : 
                       timeRange === '30d' ? 30 : 
                       timeRange === '90d' ? 90 : 30;

        return this.db.prepare(`
            SELECT 
                u.name as technician_name,
                u.email as technician_email,
                COUNT(t.id) as total_assigned,
                COUNT(CASE WHEN t.status_id IN (SELECT id FROM ticket_statuses WHERE name IN ('open', 'in-progress')) THEN 1 END) as open_tickets,
                COUNT(CASE WHEN t.status_id IN (SELECT id FROM ticket_statuses WHERE name = 'resolved') THEN 1 END) as resolved_tickets,
                AVG(CASE WHEN t.resolved_at IS NOT NULL 
                    THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24 
                    END) as avg_resolution_hours,
                COUNT(CASE WHEN t.resolved_at IS NOT NULL AND 
                    (julianday(t.resolved_at) - julianday(t.created_at)) * 24 <= 8 THEN 1 END) as sla_compliant_tickets
            FROM users u
            LEFT JOIN tickets t ON u.id = t.assignee_id
            WHERE u.role IN ('admin', 'manager', 'technician')
            AND (t.id IS NULL OR t.created_at >= datetime('now', '-${daysAgo} days'))
            GROUP BY u.id, u.name, u.email
            ORDER BY total_assigned DESC
        `).all();
    }

    // Get category and priority distribution reports
    getCategoryPriorityDistribution(timeRange = '30d') {
        const daysAgo = timeRange === '7d' ? 7 : 
                       timeRange === '30d' ? 30 : 
                       timeRange === '90d' ? 90 : 30;

        return this.db.prepare(`
            SELECT 
                tc.name as category,
                tp.name as priority,
                COUNT(*) as ticket_count,
                COUNT(CASE WHEN t.status_id IN (SELECT id FROM ticket_statuses WHERE name IN ('open', 'in-progress')) THEN 1 END) as open_count,
                COUNT(CASE WHEN t.status_id IN (SELECT id FROM ticket_statuses WHERE name = 'resolved') THEN 1 END) as resolved_count,
                AVG(CASE WHEN t.resolved_at IS NOT NULL 
                    THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24 
                    END) as avg_resolution_hours
            FROM tickets t
            JOIN ticket_categories tc ON t.category_id = tc.id
            JOIN ticket_priorities tp ON t.priority_id = tp.id
            WHERE t.created_at >= datetime('now', '-${daysAgo} days')
            GROUP BY tc.name, tp.name
            ORDER BY tc.name, tp.name
        `).all();
    }

    // Get resolution time analytics
    getResolutionTimeAnalytics(timeRange = '30d') {
        const daysAgo = timeRange === '7d' ? 7 : 
                       timeRange === '30d' ? 30 : 
                       timeRange === '90d' ? 90 : 30;

        return this.db.prepare(`
            SELECT 
                tp.name as priority,
                tc.name as category,
                COUNT(*) as total_resolved,
                AVG((julianday(t.resolved_at) - julianday(t.created_at)) * 24) as avg_resolution_hours,
                MIN((julianday(t.resolved_at) - julianday(t.created_at)) * 24) as min_resolution_hours,
                MAX((julianday(t.resolved_at) - julianday(t.created_at)) * 24) as max_resolution_hours,
                COUNT(CASE WHEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24 <= 1 THEN 1 END) as resolved_within_1h,
                COUNT(CASE WHEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24 <= 4 THEN 1 END) as resolved_within_4h,
                COUNT(CASE WHEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24 <= 24 THEN 1 END) as resolved_within_24h
            FROM tickets t
            JOIN ticket_priorities tp ON t.priority_id = tp.id
            JOIN ticket_categories tc ON t.category_id = tc.id
            WHERE t.resolved_at IS NOT NULL
            AND t.created_at >= datetime('now', '-${daysAgo} days')
            GROUP BY tp.name, tc.name
            ORDER BY tp.name, tc.name
        `).all();
    }

    // Get customer satisfaction tracking (if satisfaction data exists)
    getCustomerSatisfactionReport(timeRange = '30d') {
        const daysAgo = timeRange === '7d' ? 7 : 
                       timeRange === '30d' ? 30 : 
                       timeRange === '90d' ? 90 : 30;

        // This would need a satisfaction table - for now return basic metrics
        return this.db.prepare(`
            SELECT 
                COUNT(*) as total_resolved_tickets,
                COUNT(CASE WHEN t.resolved_at IS NOT NULL THEN 1 END) as tickets_with_resolution,
                AVG(CASE WHEN t.resolved_at IS NOT NULL 
                    THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24 
                    END) as avg_resolution_time,
                COUNT(CASE WHEN t.resolved_at IS NOT NULL AND 
                    (julianday(t.resolved_at) - julianday(t.created_at)) * 24 <= 8 THEN 1 END) as sla_compliant_tickets
            FROM tickets t
            WHERE t.created_at >= datetime('now', '-${daysAgo} days')
        `).get();
    }

    // Get real-time dashboard metrics
    getRealTimeDashboardMetrics() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        return this.db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM tickets WHERE DATE(created_at) = '${today}') as tickets_today,
                (SELECT COUNT(*) FROM tickets WHERE DATE(created_at) = '${yesterday}') as tickets_yesterday,
                (SELECT COUNT(*) FROM tickets WHERE status_id IN (SELECT id FROM ticket_statuses WHERE name IN ('open', 'in-progress'))) as open_tickets,
                (SELECT COUNT(*) FROM tickets WHERE status_id IN (SELECT id FROM ticket_statuses WHERE name = 'resolved') AND DATE(resolved_at) = '${today}') as resolved_today,
                (SELECT COUNT(*) FROM tickets WHERE assignee_id IS NULL) as unassigned_tickets,
                (SELECT COUNT(*) FROM tickets WHERE priority_id IN (SELECT id FROM ticket_priorities WHERE name IN ('high', 'critical'))) as high_priority_tickets
        `).get();
    }

    // Get trend analysis for dashboard
    getTrendAnalysis(days = 7) {
        return this.db.prepare(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as created,
                COUNT(CASE WHEN status_id IN (SELECT id FROM ticket_statuses WHERE name = 'resolved') THEN 1 END) as resolved
            FROM tickets 
            WHERE created_at >= datetime('now', '-${days} days')
            GROUP BY DATE(created_at)
            ORDER BY date
        `).all();
    }

    // Get top performing technicians
    getTopPerformingTechnicians(limit = 5, timeRange = '30d') {
        const daysAgo = timeRange === '7d' ? 7 : 
                       timeRange === '30d' ? 30 : 
                       timeRange === '90d' ? 90 : 30;

        return this.db.prepare(`
            SELECT 
                u.name as technician_name,
                COUNT(t.id) as total_resolved,
                AVG(CASE WHEN t.resolved_at IS NOT NULL 
                    THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24 
                    END) as avg_resolution_hours,
                COUNT(CASE WHEN t.resolved_at IS NOT NULL AND 
                    (julianday(t.resolved_at) - julianday(t.created_at)) * 24 <= 8 THEN 1 END) as sla_compliant_count
            FROM users u
            JOIN tickets t ON u.id = t.assignee_id
            WHERE u.role IN ('admin', 'manager', 'technician')
            AND t.status_id IN (SELECT id FROM ticket_statuses WHERE name = 'resolved')
            AND t.created_at >= datetime('now', '-${daysAgo} days')
            GROUP BY u.id, u.name
            ORDER BY total_resolved DESC
            LIMIT ${limit}
        `).all();
    }

    // Get system health metrics
    getSystemHealthMetrics() {
        return this.db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM tickets) as total_tickets,
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM assets) as total_assets,
                (SELECT COUNT(*) FROM tickets WHERE status_id IN (SELECT id FROM ticket_statuses WHERE name IN ('open', 'in-progress'))) as active_tickets,
                (SELECT COUNT(*) FROM tickets WHERE created_at >= datetime('now', '-24 hours')) as tickets_last_24h,
                (SELECT COUNT(*) FROM tickets WHERE resolved_at >= datetime('now', '-24 hours')) as resolved_last_24h
        `).get();
    }

    // ==================== SAVED SEARCH FILTERS ====================

    // Save search filter
    saveSearchFilter(userId, filterData) {
        const stmt = this.db.prepare(`
            INSERT INTO saved_search_filters (
                user_id, name, description, filters, is_public, created_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        return stmt.run(
            userId,
            filterData.name,
            filterData.description || '',
            JSON.stringify(filterData.filters),
            filterData.isPublic ? 1 : 0
        );
    }

    // Get saved search filters for user
    getSavedSearchFilters(userId) {
        return this.db.prepare(`
            SELECT * FROM saved_search_filters 
            WHERE user_id = ? OR is_public = 1
            ORDER BY created_at DESC
        `).all(userId);
    }

    // Get saved search filter by ID
    getSavedSearchFilter(filterId, userId) {
        return this.db.prepare(`
            SELECT * FROM saved_search_filters 
            WHERE id = ? AND (user_id = ? OR is_public = 1)
        `).get(filterId, userId);
    }

    // Update saved search filter
    updateSavedSearchFilter(filterId, userId, filterData) {
        const stmt = this.db.prepare(`
            UPDATE saved_search_filters 
            SET name = ?, description = ?, filters = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `);
        
        return stmt.run(
            filterData.name,
            filterData.description || '',
            JSON.stringify(filterData.filters),
            filterData.isPublic ? 1 : 0,
            filterId,
            userId
        );
    }

    // Delete saved search filter
    deleteSavedSearchFilter(filterId, userId) {
        return this.db.prepare(`
            DELETE FROM saved_search_filters 
            WHERE id = ? AND user_id = ?
        `).run(filterId, userId);
    }

    // ==================== BULK TICKET OPERATIONS ====================

    // Bulk update tickets
    async bulkUpdateTickets(ticketIds, updates, userId = null) {
        const transaction = this.db.transaction(() => {
            let updateFields = [];
            let updateValues = [];
            let changes = 0;
            
            // Build update fields based on provided updates
            if (updates.status !== undefined) {
                updateFields.push('status_id = ?');
                const status = this.db.prepare('SELECT id FROM ticket_statuses WHERE name = ?').get(updates.status);
                updateValues.push(status ? status.id : null);
            }
            
            if (updates.priority !== undefined) {
                updateFields.push('priority_id = ?');
                const priority = this.db.prepare('SELECT id FROM ticket_priorities WHERE name = ?').get(updates.priority);
                updateValues.push(priority ? priority.id : null);
            }
            
            if (updates.category !== undefined) {
                updateFields.push('category_id = ?');
                const category = this.db.prepare('SELECT id FROM ticket_categories WHERE name = ?').get(updates.category);
                updateValues.push(category ? category.id : null);
            }
            
            if (updates.assignee !== undefined) {
                updateFields.push('assignee_id = ?');
                const assignee = updates.assignee ? this.getUserByEmail(updates.assignee) : null;
                updateValues.push(assignee ? assignee.id : null);
            }
            
            // Always update the updated_at timestamp
            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            
            if (updateFields.length === 0) {
                return { changes: 0, updatedTickets: [] };
            }
            
            const updateQuery = `UPDATE tickets SET ${updateFields.join(', ')} WHERE id IN (${ticketIds.map(() => '?').join(',')})`;
            const allValues = [...updateValues, ...ticketIds];
            
            const stmt = this.db.prepare(updateQuery);
            const result = stmt.run(...allValues);
            changes = result.changes;
            
            // Create timeline entries for each updated ticket
            const updatedTickets = [];
            for (const ticketId of ticketIds) {
                const ticket = this.getTicketById(ticketId);
                if (ticket) {
                    updatedTickets.push(ticket);
                    
                    // Create timeline entry for the bulk update
                    let content = 'Bulk update applied: ';
                    const changes = [];
                    
                    if (updates.status !== undefined) {
                        changes.push(`Status changed to ${updates.status}`);
                    }
                    if (updates.priority !== undefined) {
                        changes.push(`Priority changed to ${updates.priority}`);
                    }
                    if (updates.category !== undefined) {
                        changes.push(`Category changed to ${updates.category}`);
                    }
                    if (updates.assignee !== undefined) {
                        changes.push(`Assignee changed to ${updates.assignee || 'Unassigned'}`);
                    }
                    
                    content += changes.join(', ');
                    
                    this.createTimelineEntry(ticketId, {
                        author: userId ? this.getUserById(userId).name : 'System',
                        authorType: userId ? 'agent' : 'system',
                        content: content,
                        entryType: 'bulk-update'
                    });
                }
            }
            
            return { changes, updatedTickets };
        });
        
        return transaction();
    }

    // Bulk delete tickets
    async bulkDeleteTickets(ticketIds, userId = null) {
        const transaction = this.db.transaction(() => {
            let deletedTickets = [];
            
            // Get ticket details before deletion for timeline entries
            for (const ticketId of ticketIds) {
                const ticket = this.getTicketById(ticketId);
                if (ticket) {
                    deletedTickets.push(ticket);
                }
            }
            
            // Delete timeline entries first (due to foreign key constraints)
            const deleteTimelineStmt = this.db.prepare('DELETE FROM ticket_timeline WHERE ticket_id IN (' + ticketIds.map(() => '?').join(',') + ')');
            deleteTimelineStmt.run(...ticketIds);
            
            // Delete tickets
            const deleteTicketsStmt = this.db.prepare('DELETE FROM tickets WHERE id IN (' + ticketIds.map(() => '?').join(',') + ')');
            const result = deleteTicketsStmt.run(...ticketIds);
            
            return { changes: result.changes, deletedTickets };
        });
        
        return transaction();
    }

    // Bulk export tickets
    async bulkExportTickets(ticketIds, format = 'json') {
        const tickets = [];
        
        for (const ticketId of ticketIds) {
            const ticket = this.getTicketById(ticketId);
            if (ticket) {
                tickets.push(ticket);
            }
        }
        
        if (format === 'csv') {
            // Convert to CSV format
            const csvHeaders = [
                'Ticket ID', 'Subject', 'Description', 'Status', 'Priority', 'Category',
                'Requester', 'Assignee', 'Created At', 'Updated At'
            ];
            
            const csvRows = tickets.map(ticket => [
                ticket.ticket_id,
                ticket.subject,
                ticket.description,
                ticket.status_name,
                ticket.priority_name,
                ticket.category_name,
                ticket.requester_name,
                ticket.assignee_name,
                ticket.created_at,
                ticket.updated_at
            ]);
            
            const csvContent = [csvHeaders, ...csvRows]
                .map(row => row.map(cell => `"${cell || ''}"`).join(','))
                .join('\n');
            
            return { format: 'csv', data: csvContent, filename: `tickets-export-${new Date().toISOString().split('T')[0]}.csv` };
        }
        
        return { format: 'json', data: tickets, filename: `tickets-export-${new Date().toISOString().split('T')[0]}.json` };
    }

    // Bulk apply template to tickets
    async bulkApplyTemplate(ticketIds, templateId, userId = null) {
        const transaction = this.db.transaction(() => {
            // Get template details
            const template = this.db.prepare('SELECT * FROM ticket_templates WHERE id = ?').get(templateId);
            if (!template) {
                throw new Error('Template not found');
            }
            
            let updatedTickets = [];
            
            for (const ticketId of ticketIds) {
                const ticket = this.getTicketById(ticketId);
                if (ticket) {
                    // Apply template updates
                    const updates = {};
                    
                    if (template.category) {
                        updates.category = template.category;
                    }
                    if (template.priority) {
                        updates.priority = template.priority;
                    }
                    
                    // Update ticket
                    this.updateTicket(ticketId, updates);
                    
                    // Create timeline entry
                    this.createTimelineEntry(ticketId, {
                        author: userId ? this.getUserById(userId).name : 'System',
                        authorType: userId ? 'agent' : 'system',
                        content: `Template "${template.name}" applied to this ticket`,
                        entryType: 'template-applied'
                    });
                    
                    updatedTickets.push(this.getTicketById(ticketId));
                }
            }
            
            return { changes: updatedTickets.length, updatedTickets };
        });
        
        return transaction();
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

    // Update admin session (extend expiration)
    updateAdminSession(sessionToken) {
        return this.db.prepare(`
            UPDATE admin_sessions 
            SET expires_at = datetime('now', '+1 day')
            WHERE session_token = ?
        `).run(sessionToken);
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

    // Clean up expired sessions, OTPs, and JWT tokens
    cleanupExpired() {
        try {
            this.db.prepare('DELETE FROM user_sessions WHERE expires_at <= datetime(\'now\')').run();
        } catch (error) {
            console.error('Cleanup user_sessions error:', error);
        }
        
        try {
            this.db.prepare('DELETE FROM admin_sessions WHERE expires_at <= datetime(\'now\')').run();
        } catch (error) {
            console.error('Cleanup admin_sessions error:', error);
        }
        
        try {
            this.db.prepare('DELETE FROM otp_store WHERE expires_at <= datetime(\'now\')').run();
        } catch (error) {
            console.error('Cleanup otp_store error:', error);
        }
        
        try {
            this.db.prepare('DELETE FROM jwt_refresh_tokens WHERE expires_at <= datetime(\'now\')').run();
        } catch (error) {
            console.error('Cleanup jwt_refresh_tokens error:', error);
        }
    }
}

module.exports = new DatabaseServices(); 