-- User Profile Management Schema
-- This extends the existing users table with additional profile information

-- User Profiles table for extended user information
CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    bio TEXT,
    website VARCHAR(255),
    company VARCHAR(100),
    job_title VARCHAR(100),
    date_of_birth DATE,
    gender VARCHAR(20),
    profile_picture_url VARCHAR(500),
    cover_photo_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Preferences table for customizable settings
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

-- User Activity Log for tracking user actions
CREATE TABLE IF NOT EXISTS user_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    activity_description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata TEXT, -- JSON string for additional data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Sessions for tracking active sessions
CREATE TABLE IF NOT EXISTS user_sessions_extended (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    device_name VARCHAR(100),
    device_type VARCHAR(50), -- mobile, desktop, tablet
    browser VARCHAR(100),
    os VARCHAR(100),
    ip_address VARCHAR(45),
    location VARCHAR(100),
    is_active BOOLEAN DEFAULT 1,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Privacy Settings
CREATE TABLE IF NOT EXISTS user_privacy_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    profile_visibility VARCHAR(20) DEFAULT 'public', -- public, private, friends
    show_email BOOLEAN DEFAULT 0,
    show_phone BOOLEAN DEFAULT 0,
    show_address BOOLEAN DEFAULT 0,
    allow_messages BOOLEAN DEFAULT 1,
    allow_friend_requests BOOLEAN DEFAULT 1,
    show_online_status BOOLEAN DEFAULT 1,
    show_last_seen BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Notifications Preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    email_enabled BOOLEAN DEFAULT 1,
    push_enabled BOOLEAN DEFAULT 1,
    sms_enabled BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, notification_type)
);

-- User Skills and Expertise
CREATE TABLE IF NOT EXISTS user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    skill_name VARCHAR(100) NOT NULL,
    skill_level VARCHAR(20) DEFAULT 'beginner', -- beginner, intermediate, advanced, expert
    years_experience INTEGER,
    is_certified BOOLEAN DEFAULT 0,
    certification_name VARCHAR(200),
    certification_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Social Links
CREATE TABLE IF NOT EXISTS user_social_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    platform VARCHAR(50) NOT NULL, -- linkedin, twitter, github, etc.
    url VARCHAR(500) NOT NULL,
    is_public BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Achievements and Badges
CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_type VARCHAR(50) NOT NULL,
    achievement_name VARCHAR(100) NOT NULL,
    achievement_description TEXT,
    badge_url VARCHAR(500),
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT, -- JSON string for additional achievement data
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Work History
CREATE TABLE IF NOT EXISTS user_work_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    company_name VARCHAR(100) NOT NULL,
    job_title VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT 0,
    description TEXT,
    location VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Education History
CREATE TABLE IF NOT EXISTS user_education (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    institution_name VARCHAR(200) NOT NULL,
    degree VARCHAR(100),
    field_of_study VARCHAR(100),
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT 0,
    gpa DECIMAL(3,2),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON user_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_extended_user_id ON user_sessions_extended(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_extended_token ON user_sessions_extended(session_token);
CREATE INDEX IF NOT EXISTS idx_user_privacy_settings_user_id ON user_privacy_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id ON user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_social_links_user_id ON user_social_links(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_work_history_user_id ON user_work_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_education_user_id ON user_education(user_id);

-- Insert default notification preferences for existing users
INSERT OR IGNORE INTO user_notification_preferences (user_id, notification_type, email_enabled, push_enabled, sms_enabled)
SELECT 
    u.id,
    'ticket_updates',
    1,
    1,
    0
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_notification_preferences unp 
    WHERE unp.user_id = u.id AND unp.notification_type = 'ticket_updates'
);

INSERT OR IGNORE INTO user_notification_preferences (user_id, notification_type, email_enabled, push_enabled, sms_enabled)
SELECT 
    u.id,
    'system_announcements',
    1,
    1,
    0
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_notification_preferences unp 
    WHERE unp.user_id = u.id AND unp.notification_type = 'system_announcements'
);

INSERT OR IGNORE INTO user_notification_preferences (user_id, notification_type, email_enabled, push_enabled, sms_enabled)
SELECT 
    u.id,
    'security_alerts',
    1,
    1,
    1
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_notification_preferences unp 
    WHERE unp.user_id = u.id AND unp.notification_type = 'security_alerts'
);

-- Insert default privacy settings for existing users
INSERT OR IGNORE INTO user_privacy_settings (user_id, profile_visibility, show_email, show_phone, show_address, allow_messages, allow_friend_requests, show_online_status, show_last_seen)
SELECT 
    u.id,
    'public',
    0,
    0,
    0,
    1,
    1,
    1,
    1
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_privacy_settings ups WHERE ups.user_id = u.id
); 