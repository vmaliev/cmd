const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');
const ProfileServices = require('../database/profile-services');

const router = express.Router();
const profileServices = new ProfileServices();

// Apply rate limiting to all profile routes
router.use(generalRateLimit);

// ==================== PROFILE MANAGEMENT ====================

/**
 * @route GET /api/profiles/:userId
 * @desc Get complete user profile with all related data
 * @access Self, Admin, Manager
 */
router.get('/:userId', authenticateJWT, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const profile = profileServices.getCompleteUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * @route PUT /api/profiles/:userId
 * @desc Update user profile
 * @access Self, Admin
 */
router.put('/:userId', authenticateJWT, [
  body('phone').optional().isMobilePhone(),
  body('bio').optional().isLength({ max: 1000 }),
  body('website').optional().isURL(),
  body('company').optional().isLength({ max: 100 }),
  body('job_title').optional().isLength({ max: 100 }),
  body('timezone').optional().isLength({ max: 50 }),
  body('language').optional().isLength({ min: 2, max: 10 })
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const profileData = req.body;
    const updatedProfile = profileServices.upsertUserProfile(userId, profileData);

    // Log the activity
    profileServices.logUserActivity(
      userId,
      'profile_updated',
      'Profile information updated',
      req.ip,
      req.get('User-Agent'),
      { updatedFields: Object.keys(profileData) }
    );

    res.json({
      message: 'Profile updated successfully',
      profile: updatedProfile
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ==================== PREFERENCES MANAGEMENT ====================

/**
 * @route GET /api/profiles/:userId/preferences
 * @desc Get user preferences
 * @access Self, Admin
 */
router.get('/:userId/preferences', authenticateJWT, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const preferences = profileServices.getUserPreferences(userId);
    res.json(preferences);

  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * @route PUT /api/profiles/:userId/preferences
 * @desc Update user preferences
 * @access Self, Admin
 */
router.put('/:userId/preferences', authenticateJWT, [
  body('preferences').isObject()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { preferences } = req.body;
    
    // Update each preference
    for (const [key, value] of Object.entries(preferences)) {
      profileServices.setUserPreference(userId, key, value);
    }

    // Log the activity
    profileServices.logUserActivity(
      userId,
      'preferences_updated',
      'User preferences updated',
      req.ip,
      req.get('User-Agent'),
      { updatedPreferences: Object.keys(preferences) }
    );

    const updatedPreferences = profileServices.getUserPreferences(userId);
    res.json({
      message: 'Preferences updated successfully',
      preferences: updatedPreferences
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * @route DELETE /api/profiles/:userId/preferences/:key
 * @desc Delete user preference
 * @access Self, Admin
 */
router.delete('/:userId/preferences/:key', authenticateJWT, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const preferenceKey = req.params.key;
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    profileServices.deleteUserPreference(userId, preferenceKey);

    // Log the activity
    profileServices.logUserActivity(
      userId,
      'preference_deleted',
      `Preference '${preferenceKey}' deleted`,
      req.ip,
      req.get('User-Agent')
    );

    res.json({ message: 'Preference deleted successfully' });

  } catch (error) {
    console.error('Delete preference error:', error);
    res.status(500).json({ error: 'Failed to delete preference' });
  }
});

// ==================== ACTIVITY LOGGING ====================

/**
 * @route GET /api/profiles/:userId/activity
 * @desc Get user activity log
 * @access Self, Admin, Manager
 */
router.get('/:userId/activity', authenticateJWT, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('type').optional().isString()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const userId = parseInt(req.params.userId);
    const { limit = 50, offset = 0, type } = req.query;
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let activity;
    if (type) {
      activity = profileServices.getRecentActivityByType(userId, type, parseInt(limit));
    } else {
      activity = profileServices.getUserActivityLog(userId, parseInt(limit), parseInt(offset));
    }

    res.json({
      activity,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: activity.length
      }
    });

  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to get activity log' });
  }
});

// ==================== PRIVACY SETTINGS ====================

/**
 * @route GET /api/profiles/:userId/privacy
 * @desc Get user privacy settings
 * @access Self, Admin
 */
router.get('/:userId/privacy', authenticateJWT, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const privacySettings = profileServices.getUserPrivacySettings(userId);
    res.json(privacySettings);

  } catch (error) {
    console.error('Get privacy settings error:', error);
    res.status(500).json({ error: 'Failed to get privacy settings' });
  }
});

/**
 * @route PUT /api/profiles/:userId/privacy
 * @desc Update user privacy settings
 * @access Self, Admin
 */
router.put('/:userId/privacy', authenticateJWT, [
  body('profile_visibility').optional().isIn(['public', 'private', 'friends']),
  body('show_email').optional().isBoolean(),
  body('show_phone').optional().isBoolean(),
  body('show_address').optional().isBoolean(),
  body('allow_messages').optional().isBoolean(),
  body('allow_friend_requests').optional().isBoolean(),
  body('show_online_status').optional().isBoolean(),
  body('show_last_seen').optional().isBoolean()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const privacySettings = req.body;
    const updatedSettings = profileServices.updateUserPrivacySettings(userId, privacySettings);

    // Log the activity
    profileServices.logUserActivity(
      userId,
      'privacy_updated',
      'Privacy settings updated',
      req.ip,
      req.get('User-Agent'),
      { updatedSettings: Object.keys(privacySettings) }
    );

    res.json({
      message: 'Privacy settings updated successfully',
      settings: updatedSettings
    });

  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

// ==================== NOTIFICATION PREFERENCES ====================

/**
 * @route GET /api/profiles/:userId/notifications
 * @desc Get user notification preferences
 * @access Self, Admin
 */
router.get('/:userId/notifications', authenticateJWT, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const notificationPreferences = profileServices.getUserNotificationPreferences(userId);
    res.json(notificationPreferences);

  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

/**
 * @route PUT /api/profiles/:userId/notifications/:type
 * @desc Update user notification preference
 * @access Self, Admin
 */
router.put('/:userId/notifications/:type', authenticateJWT, [
  body('email_enabled').optional().isBoolean(),
  body('push_enabled').optional().isBoolean(),
  body('sms_enabled').optional().isBoolean()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const userId = parseInt(req.params.userId);
    const notificationType = req.params.type;
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const settings = req.body;
    profileServices.updateUserNotificationPreference(userId, notificationType, settings);

    // Log the activity
    profileServices.logUserActivity(
      userId,
      'notification_preference_updated',
      `Notification preference '${notificationType}' updated`,
      req.ip,
      req.get('User-Agent'),
      { notificationType, settings }
    );

    res.json({ message: 'Notification preference updated successfully' });

  } catch (error) {
    console.error('Update notification preference error:', error);
    res.status(500).json({ error: 'Failed to update notification preference' });
  }
});

// ==================== SKILLS MANAGEMENT ====================

/**
 * @route GET /api/profiles/:userId/skills
 * @desc Get user skills
 * @access Self, Admin, Manager
 */
router.get('/:userId/skills', authenticateJWT, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const skills = profileServices.getUserSkills(userId);
    res.json(skills);

  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ error: 'Failed to get skills' });
  }
});

/**
 * @route POST /api/profiles/:userId/skills
 * @desc Add user skill
 * @access Self, Admin
 */
router.post('/:userId/skills', authenticateJWT, [
  body('skill_name').isLength({ min: 1, max: 100 }),
  body('skill_level').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']),
  body('years_experience').optional().isInt({ min: 0, max: 50 }),
  body('is_certified').optional().isBoolean(),
  body('certification_name').optional().isLength({ max: 200 }),
  body('certification_date').optional().isDate()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const skillData = req.body;
    const result = profileServices.addUserSkill(userId, skillData);

    // Log the activity
    profileServices.logUserActivity(
      userId,
      'skill_added',
      `Skill '${skillData.skill_name}' added`,
      req.ip,
      req.get('User-Agent'),
      { skillName: skillData.skill_name, skillLevel: skillData.skill_level }
    );

    res.status(201).json({
      message: 'Skill added successfully',
      skillId: result.lastInsertRowid
    });

  } catch (error) {
    console.error('Add skill error:', error);
    res.status(500).json({ error: 'Failed to add skill' });
  }
});

/**
 * @route PUT /api/profiles/:userId/skills/:skillId
 * @desc Update user skill
 * @access Self, Admin
 */
router.put('/:userId/skills/:skillId', authenticateJWT, [
  body('skill_name').isLength({ min: 1, max: 100 }),
  body('skill_level').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']),
  body('years_experience').optional().isInt({ min: 0, max: 50 }),
  body('is_certified').optional().isBoolean(),
  body('certification_name').optional().isLength({ max: 200 }),
  body('certification_date').optional().isDate()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const userId = parseInt(req.params.userId);
    const skillId = parseInt(req.params.skillId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const skillData = req.body;
    profileServices.updateUserSkill(skillId, skillData);

    // Log the activity
    profileServices.logUserActivity(
      userId,
      'skill_updated',
      `Skill '${skillData.skill_name}' updated`,
      req.ip,
      req.get('User-Agent'),
      { skillId, skillName: skillData.skill_name }
    );

    res.json({ message: 'Skill updated successfully' });

  } catch (error) {
    console.error('Update skill error:', error);
    res.status(500).json({ error: 'Failed to update skill' });
  }
});

/**
 * @route DELETE /api/profiles/:userId/skills/:skillId
 * @desc Delete user skill
 * @access Self, Admin
 */
router.delete('/:userId/skills/:skillId', authenticateJWT, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const skillId = parseInt(req.params.skillId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    profileServices.deleteUserSkill(skillId);

    // Log the activity
    profileServices.logUserActivity(
      userId,
      'skill_deleted',
      'Skill deleted',
      req.ip,
      req.get('User-Agent'),
      { skillId }
    );

    res.json({ message: 'Skill deleted successfully' });

  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

// ==================== SOCIAL LINKS ====================

/**
 * @route GET /api/profiles/:userId/social-links
 * @desc Get user social links
 * @access Self, Admin, Manager
 */
router.get('/:userId/social-links', authenticateJWT, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const socialLinks = profileServices.getUserSocialLinks(userId);
    res.json(socialLinks);

  } catch (error) {
    console.error('Get social links error:', error);
    res.status(500).json({ error: 'Failed to get social links' });
  }
});

/**
 * @route POST /api/profiles/:userId/social-links
 * @desc Add user social link
 * @access Self, Admin
 */
router.post('/:userId/social-links', authenticateJWT, [
  body('platform').isLength({ min: 1, max: 50 }),
  body('url').isURL(),
  body('is_public').optional().isBoolean()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const userId = parseInt(req.params.userId);
    const { platform, url, is_public = true } = req.body;
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = profileServices.addUserSocialLink(userId, platform, url, is_public);

    // Log the activity
    profileServices.logUserActivity(
      userId,
      'social_link_added',
      `Social link '${platform}' added`,
      req.ip,
      req.get('User-Agent'),
      { platform, url, isPublic: is_public }
    );

    res.status(201).json({
      message: 'Social link added successfully',
      linkId: result.lastInsertRowid
    });

  } catch (error) {
    console.error('Add social link error:', error);
    res.status(500).json({ error: 'Failed to add social link' });
  }
});

// ==================== STATISTICS ====================

/**
 * @route GET /api/profiles/:userId/stats
 * @desc Get user statistics
 * @access Self, Admin, Manager
 */
router.get('/:userId/stats', authenticateJWT, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = profileServices.getUserStatistics(userId);
    res.json(stats);

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

module.exports = router; 