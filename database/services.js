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