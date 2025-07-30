const Database = require('better-sqlite3');
const path = require('path');

class ProfileServices {
    constructor(dbPath = path.join(__dirname, 'it_support.db')) {
        this.db = new Database(dbPath);
        this.initializeProfileTables();
    }

    /**
     * Initialize profile-related tables
     */
    initializeProfileTables() {
        try {
            const fs = require('fs');
            const profileSchemaPath = path.join(__dirname, 'schema-user-profiles.sql');
            
            if (fs.existsSync(profileSchemaPath)) {
                const schema = fs.readFileSync(profileSchemaPath, 'utf8');
                this.db.exec(schema);
                console.log('Profile tables initialized successfully');
            } else {
                console.warn('Profile schema file not found, creating basic tables...');
                this.createBasicProfileTables();
            }
        } catch (error) {
            console.error('Error initializing profile tables:', error);
            this.createBasicProfileTables();
        }
    }

    /**
     * Create basic profile tables if schema file is not available
     */
    createBasicProfileTables() {
        const basicSchema = `
            CREATE TABLE IF NOT EXISTS user_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                phone VARCHAR(20),
                bio TEXT,
                profile_picture_url VARCHAR(500),
                timezone VARCHAR(50) DEFAULT 'UTC',
                language VARCHAR(10) DEFAULT 'en',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                preference_key VARCHAR(100) NOT NULL,
                preference_value TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, preference_key)
            );

            CREATE TABLE IF NOT EXISTS user_activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                activity_type VARCHAR(50) NOT NULL,
                activity_description TEXT,
                ip_address VARCHAR(45),
                user_agent TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON user_activity_log(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON user_activity_log(created_at);
        `;
        
        this.db.exec(basicSchema);
    }

    // ==================== USER PROFILE MANAGEMENT ====================

    /**
     * Get user profile by user ID
     */
    getUserProfile(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM user_profiles WHERE user_id = ?
            `);
            return stmt.get(userId);
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    /**
     * Create or update user profile
     */
    upsertUserProfile(userId, profileData) {
        try {
            const existingProfile = this.getUserProfile(userId);
            
            if (existingProfile) {
                // Update existing profile
                const updateFields = Object.keys(profileData)
                    .filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at')
                    .map(key => `${key} = ?`);
                
                const updateValues = Object.keys(profileData)
                    .filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at')
                    .map(key => profileData[key]);
                
                const stmt = this.db.prepare(`
                    UPDATE user_profiles 
                    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                `);
                
                stmt.run(...updateValues, userId);
                return this.getUserProfile(userId);
            } else {
                // Create new profile
                const fields = Object.keys(profileData).join(', ');
                const placeholders = Object.keys(profileData).map(() => '?').join(', ');
                const values = Object.values(profileData);
                
                const stmt = this.db.prepare(`
                    INSERT INTO user_profiles (user_id, ${fields})
                    VALUES (?, ${placeholders})
                `);
                
                stmt.run(userId, ...values);
                return this.getUserProfile(userId);
            }
        } catch (error) {
            console.error('Error upserting user profile:', error);
            throw error;
        }
    }

    /**
     * Delete user profile
     */
    deleteUserProfile(userId) {
        try {
            const stmt = this.db.prepare('DELETE FROM user_profiles WHERE user_id = ?');
            return stmt.run(userId);
        } catch (error) {
            console.error('Error deleting user profile:', error);
            throw error;
        }
    }

    // ==================== USER PREFERENCES ====================

    /**
     * Get user preference by key
     */
    getUserPreference(userId, preferenceKey) {
        try {
            const stmt = this.db.prepare(`
                SELECT preference_value FROM user_preferences 
                WHERE user_id = ? AND preference_key = ?
            `);
            const result = stmt.get(userId, preferenceKey);
            return result ? result.preference_value : null;
        } catch (error) {
            console.error('Error getting user preference:', error);
            return null;
        }
    }

    /**
     * Get all user preferences
     */
    getUserPreferences(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT preference_key, preference_value 
                FROM user_preferences 
                WHERE user_id = ?
            `);
            const results = stmt.all(userId);
            
            const preferences = {};
            results.forEach(row => {
                preferences[row.preference_key] = row.preference_value;
            });
            
            return preferences;
        } catch (error) {
            console.error('Error getting user preferences:', error);
            return {};
        }
    }

    /**
     * Set user preference
     */
    setUserPreference(userId, preferenceKey, preferenceValue) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO user_preferences 
                (user_id, preference_key, preference_value, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `);
            return stmt.run(userId, preferenceKey, preferenceValue);
        } catch (error) {
            console.error('Error setting user preference:', error);
            throw error;
        }
    }

    /**
     * Delete user preference
     */
    deleteUserPreference(userId, preferenceKey) {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM user_preferences 
                WHERE user_id = ? AND preference_key = ?
            `);
            return stmt.run(userId, preferenceKey);
        } catch (error) {
            console.error('Error deleting user preference:', error);
            throw error;
        }
    }

    // ==================== USER ACTIVITY LOGGING ====================

    /**
     * Log user activity
     */
    logUserActivity(userId, activityType, activityDescription, ipAddress = null, userAgent = null, metadata = null) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO user_activity_log 
                (user_id, activity_type, activity_description, ip_address, user_agent, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            const metadataJson = metadata ? JSON.stringify(metadata) : null;
            return stmt.run(userId, activityType, activityDescription, ipAddress, userAgent, metadataJson);
        } catch (error) {
            console.error('Error logging user activity:', error);
            throw error;
        }
    }

    /**
     * Get user activity log
     */
    getUserActivityLog(userId, limit = 50, offset = 0) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM user_activity_log 
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `);
            return stmt.all(userId, limit, offset);
        } catch (error) {
            console.error('Error getting user activity log:', error);
            return [];
        }
    }

    /**
     * Get recent activity by type
     */
    getRecentActivityByType(userId, activityType, limit = 10) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM user_activity_log 
                WHERE user_id = ? AND activity_type = ?
                ORDER BY created_at DESC
                LIMIT ?
            `);
            return stmt.all(userId, activityType, limit);
        } catch (error) {
            console.error('Error getting recent activity by type:', error);
            return [];
        }
    }

    // ==================== PRIVACY SETTINGS ====================

    /**
     * Get user privacy settings
     */
    getUserPrivacySettings(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM user_privacy_settings WHERE user_id = ?
            `);
            return stmt.get(userId);
        } catch (error) {
            console.error('Error getting user privacy settings:', error);
            return null;
        }
    }

    /**
     * Update user privacy settings
     */
    updateUserPrivacySettings(userId, settings) {
        try {
            const existingSettings = this.getUserPrivacySettings(userId);
            
            if (existingSettings) {
                // Update existing settings
                const updateFields = Object.keys(settings)
                    .filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at')
                    .map(key => `${key} = ?`);
                
                const updateValues = Object.keys(settings)
                    .filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at')
                    .map(key => settings[key]);
                
                const stmt = this.db.prepare(`
                    UPDATE user_privacy_settings 
                    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                `);
                
                stmt.run(...updateValues, userId);
            } else {
                // Create new settings
                const fields = Object.keys(settings).join(', ');
                const placeholders = Object.keys(settings).map(() => '?').join(', ');
                const values = Object.values(settings);
                
                const stmt = this.db.prepare(`
                    INSERT INTO user_privacy_settings (user_id, ${fields})
                    VALUES (?, ${placeholders})
                `);
                
                stmt.run(userId, ...values);
            }
            
            return this.getUserPrivacySettings(userId);
        } catch (error) {
            console.error('Error updating user privacy settings:', error);
            throw error;
        }
    }

    // ==================== NOTIFICATION PREFERENCES ====================

    /**
     * Get user notification preferences
     */
    getUserNotificationPreferences(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM user_notification_preferences 
                WHERE user_id = ?
            `);
            return stmt.all(userId);
        } catch (error) {
            console.error('Error getting user notification preferences:', error);
            return [];
        }
    }

    /**
     * Update user notification preference
     */
    updateUserNotificationPreference(userId, notificationType, settings) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO user_notification_preferences 
                (user_id, notification_type, email_enabled, push_enabled, sms_enabled, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            return stmt.run(
                userId,
                notificationType,
                settings.email_enabled || false,
                settings.push_enabled || false,
                settings.sms_enabled || false
            );
        } catch (error) {
            console.error('Error updating user notification preference:', error);
            throw error;
        }
    }

    // ==================== USER SKILLS ====================

    /**
     * Get user skills
     */
    getUserSkills(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM user_skills 
                WHERE user_id = ?
                ORDER BY skill_name
            `);
            return stmt.all(userId);
        } catch (error) {
            console.error('Error getting user skills:', error);
            return [];
        }
    }

    /**
     * Add user skill
     */
    addUserSkill(userId, skillData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO user_skills 
                (user_id, skill_name, skill_level, years_experience, is_certified, certification_name, certification_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            return stmt.run(
                userId,
                skillData.skill_name,
                skillData.skill_level || 'beginner',
                skillData.years_experience || null,
                skillData.is_certified || false,
                skillData.certification_name || null,
                skillData.certification_date || null
            );
        } catch (error) {
            console.error('Error adding user skill:', error);
            throw error;
        }
    }

    /**
     * Update user skill
     */
    updateUserSkill(skillId, skillData) {
        try {
            const stmt = this.db.prepare(`
                UPDATE user_skills 
                SET skill_name = ?, skill_level = ?, years_experience = ?, 
                    is_certified = ?, certification_name = ?, certification_date = ?
                WHERE id = ?
            `);
            
            return stmt.run(
                skillData.skill_name,
                skillData.skill_level,
                skillData.years_experience,
                skillData.is_certified,
                skillData.certification_name,
                skillData.certification_date,
                skillId
            );
        } catch (error) {
            console.error('Error updating user skill:', error);
            throw error;
        }
    }

    /**
     * Delete user skill
     */
    deleteUserSkill(skillId) {
        try {
            const stmt = this.db.prepare('DELETE FROM user_skills WHERE id = ?');
            return stmt.run(skillId);
        } catch (error) {
            console.error('Error deleting user skill:', error);
            throw error;
        }
    }

    // ==================== SOCIAL LINKS ====================

    /**
     * Get user social links
     */
    getUserSocialLinks(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM user_social_links 
                WHERE user_id = ?
                ORDER BY platform
            `);
            return stmt.all(userId);
        } catch (error) {
            console.error('Error getting user social links:', error);
            return [];
        }
    }

    /**
     * Add user social link
     */
    addUserSocialLink(userId, platform, url, isPublic = true) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO user_social_links (user_id, platform, url, is_public)
                VALUES (?, ?, ?, ?)
            `);
            return stmt.run(userId, platform, url, isPublic);
        } catch (error) {
            console.error('Error adding user social link:', error);
            throw error;
        }
    }

    /**
     * Update user social link
     */
    updateUserSocialLink(linkId, platform, url, isPublic) {
        try {
            const stmt = this.db.prepare(`
                UPDATE user_social_links 
                SET platform = ?, url = ?, is_public = ?
                WHERE id = ?
            `);
            return stmt.run(platform, url, isPublic, linkId);
        } catch (error) {
            console.error('Error updating user social link:', error);
            throw error;
        }
    }

    /**
     * Delete user social link
     */
    deleteUserSocialLink(linkId) {
        try {
            const stmt = this.db.prepare('DELETE FROM user_social_links WHERE id = ?');
            return stmt.run(linkId);
        } catch (error) {
            console.error('Error deleting user social link:', error);
            throw error;
        }
    }

    // ==================== ACHIEVEMENTS ====================

    /**
     * Get user achievements
     */
    getUserAchievements(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM user_achievements 
                WHERE user_id = ?
                ORDER BY earned_at DESC
            `);
            return stmt.all(userId);
        } catch (error) {
            console.error('Error getting user achievements:', error);
            return [];
        }
    }

    /**
     * Add user achievement
     */
    addUserAchievement(userId, achievementData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO user_achievements 
                (user_id, achievement_type, achievement_name, achievement_description, badge_url, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            const metadataJson = achievementData.metadata ? JSON.stringify(achievementData.metadata) : null;
            
            return stmt.run(
                userId,
                achievementData.achievement_type,
                achievementData.achievement_name,
                achievementData.achievement_description,
                achievementData.badge_url || null,
                metadataJson
            );
        } catch (error) {
            console.error('Error adding user achievement:', error);
            throw error;
        }
    }

    // ==================== WORK HISTORY ====================

    /**
     * Get user work history
     */
    getUserWorkHistory(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM user_work_history 
                WHERE user_id = ?
                ORDER BY start_date DESC
            `);
            return stmt.all(userId);
        } catch (error) {
            console.error('Error getting user work history:', error);
            return [];
        }
    }

    /**
     * Add work history entry
     */
    addWorkHistoryEntry(userId, workData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO user_work_history 
                (user_id, company_name, job_title, start_date, end_date, is_current, description, location)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            return stmt.run(
                userId,
                workData.company_name,
                workData.job_title,
                workData.start_date,
                workData.end_date || null,
                workData.is_current || false,
                workData.description || null,
                workData.location || null
            );
        } catch (error) {
            console.error('Error adding work history entry:', error);
            throw error;
        }
    }

    // ==================== EDUCATION ====================

    /**
     * Get user education history
     */
    getUserEducation(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM user_education 
                WHERE user_id = ?
                ORDER BY start_date DESC
            `);
            return stmt.all(userId);
        } catch (error) {
            console.error('Error getting user education:', error);
            return [];
        }
    }

    /**
     * Add education entry
     */
    addEducationEntry(userId, educationData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO user_education 
                (user_id, institution_name, degree, field_of_study, start_date, end_date, is_current, gpa, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            return stmt.run(
                userId,
                educationData.institution_name,
                educationData.degree || null,
                educationData.field_of_study || null,
                educationData.start_date,
                educationData.end_date || null,
                educationData.is_current || false,
                educationData.gpa || null,
                educationData.description || null
            );
        } catch (error) {
            console.error('Error adding education entry:', error);
            throw error;
        }
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Get complete user profile with all related data
     */
    getCompleteUserProfile(userId) {
        try {
            const profile = this.getUserProfile(userId);
            const preferences = this.getUserPreferences(userId);
            const privacySettings = this.getUserPrivacySettings(userId);
            const notificationPreferences = this.getUserNotificationPreferences(userId);
            const skills = this.getUserSkills(userId);
            const socialLinks = this.getUserSocialLinks(userId);
            const achievements = this.getUserAchievements(userId);
            const workHistory = this.getUserWorkHistory(userId);
            const education = this.getUserEducation(userId);
            const recentActivity = this.getUserActivityLog(userId, 10);

            return {
                profile,
                preferences,
                privacySettings,
                notificationPreferences,
                skills,
                socialLinks,
                achievements,
                workHistory,
                education,
                recentActivity
            };
        } catch (error) {
            console.error('Error getting complete user profile:', error);
            return null;
        }
    }

    /**
     * Clean up old activity logs (keep last 1000 entries per user)
     */
    cleanupOldActivityLogs() {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM user_activity_log 
                WHERE id NOT IN (
                    SELECT id FROM user_activity_log 
                    ORDER BY created_at DESC 
                    LIMIT 1000
                )
            `);
            return stmt.run();
        } catch (error) {
            console.error('Error cleaning up old activity logs:', error);
            throw error;
        }
    }

    /**
     * Get user statistics
     */
    getUserStatistics(userId) {
        try {
            const activityCount = this.db.prepare(`
                SELECT COUNT(*) as count FROM user_activity_log WHERE user_id = ?
            `).get(userId).count;

            const skillsCount = this.db.prepare(`
                SELECT COUNT(*) as count FROM user_skills WHERE user_id = ?
            `).get(userId).count;

            const achievementsCount = this.db.prepare(`
                SELECT COUNT(*) as count FROM user_achievements WHERE user_id = ?
            `).get(userId).count;

            const lastActivity = this.db.prepare(`
                SELECT created_at FROM user_activity_log 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT 1
            `).get(userId);

            return {
                activityCount,
                skillsCount,
                achievementsCount,
                lastActivity: lastActivity ? lastActivity.created_at : null
            };
        } catch (error) {
            console.error('Error getting user statistics:', error);
            return {
                activityCount: 0,
                skillsCount: 0,
                achievementsCount: 0,
                lastActivity: null
            };
        }
    }
}

module.exports = ProfileServices; 