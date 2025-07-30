const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const jwtManager = require('../utils/jwt');
const passwordManager = require('../utils/password');
const dbServices = require('../database/services');
const { authenticateJWT, requireRole, authRateLimit } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit(authRateLimit);

// ==================== PASSWORD-BASED AUTHENTICATION ====================

/**
 * @route POST /api/auth/register
 * @desc Register a new user with password
 * @access Public
 */
router.post('/register', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().isLength({ min: 2 }),
  body('role').optional().isIn(['client', 'support', 'manager'])
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

    const { email, password, name, role = 'client' } = req.body;

    // Check if user already exists
    const existingUser = dbServices.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Validate password strength
    const passwordValidation = passwordManager.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet requirements',
        details: passwordValidation.errors 
      });
    }

    // Hash password
    const passwordHash = await passwordManager.hashPassword(password);

    // Generate email verification token
    const verificationToken = passwordManager.generateSecureToken();

    // Create user
    const userData = {
      email,
      name,
      password_hash: passwordHash,
      role,
      is_active: 1,
      is_verified: 0,
      email_verification_token: verificationToken
    };

    const user = dbServices.createUser(userData);

    // Send verification email
    try {
      await sendEmail({
        to: email,
        subject: 'Verify Your Email Address',
        html: `
          <h2>Welcome to IT Support System!</h2>
          <p>Please click the link below to verify your email address:</p>
          <a href="${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}">
            Verify Email
          </a>
          <p>If you didn't create this account, please ignore this email.</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue without email verification for now
    }

    // Log auth event
    dbServices.logAuthEvent({
      email,
      action: 'register',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true,
      details: { userId: user.id, role }
    });

    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      userId: user.id
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Login with email and password
 * @access Public
 */
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('deviceId').optional().isString()
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

    const { email, password, deviceId } = req.body;

    // Get user
    const user = dbServices.getUserByEmail(email);
    if (!user) {
      dbServices.logAuthEvent({
        email,
        action: 'failed_login',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        deviceId,
        success: false,
        details: { reason: 'User not found' }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      return res.status(423).json({ 
        error: 'Account is temporarily locked',
        lockedUntil: user.account_locked_until
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Check if email is verified (optional for now)
    if (!user.is_verified) {
      console.log('User not verified, but allowing login for now');
    }

    // Verify password
    const isValidPassword = await passwordManager.comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      // Update failed login attempts
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      let lockedUntil = null;
      
      if (failedAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
      }
      
      dbServices.updateFailedLoginAttempts(email, failedAttempts, lockedUntil);
      
      dbServices.logAuthEvent({
        userId: user.id,
        email,
        action: 'failed_login',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        deviceId,
        success: false,
        details: { reason: 'Invalid password', failedAttempts }
      });

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed login attempts and update last login
    dbServices.updateLastLogin(user.id);

    // Generate JWT tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      deviceId: deviceId || 'unknown'
    };

    const tokens = jwtManager.generateTokenPair(tokenPayload);

    // Store refresh token
    const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    dbServices.storeRefreshToken(
      user.id, 
      tokens.refreshToken, 
      deviceId || 'unknown',
      JSON.stringify({
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }),
      refreshTokenExpiry
    );

    // Log successful login
    dbServices.logAuthEvent({
      userId: user.id,
      email,
      action: 'login',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      deviceId,
      success: true,
      details: { method: 'password' }
    });

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.is_verified
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token using refresh token
 * @access Public
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwtManager.verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token exists in database and is not revoked
    const storedToken = dbServices.getRefreshToken(refreshToken);
    if (!storedToken) {
      return res.status(401).json({ error: 'Refresh token not found or revoked' });
    }

    // Generate new token pair
    const tokenPayload = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      deviceId: decoded.deviceId
    };

    const newTokens = jwtManager.generateTokenPair(tokenPayload);

    // Revoke old refresh token and store new one
    dbServices.revokeRefreshToken(refreshToken);
    
    const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    dbServices.storeRefreshToken(
      decoded.userId,
      newTokens.refreshToken,
      decoded.deviceId,
      storedToken.device_info,
      refreshTokenExpiry
    );

    // Set new cookies
    res.cookie('accessToken', newTokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', newTokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Token refreshed successfully',
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout user and revoke tokens
 * @access Private
 */
router.post('/logout', authenticateJWT, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      // Revoke refresh token
      dbServices.revokeRefreshToken(refreshToken);
    }

    // Log logout event
    dbServices.logAuthEvent({
      userId: req.user.id,
      email: req.user.email,
      action: 'logout',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      deviceId: req.user.deviceId,
      success: true
    });

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({ message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * @route GET /api/auth/verify-email
 * @desc Verify email address using token
 * @access Public
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    // Find user with this verification token
    const user = dbServices.getUserByVerificationToken(token);
    if (!user) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    // Update user verification status
    dbServices.updateUserVerification(user.id, true, null);

    res.json({ message: 'Email verified successfully' });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post('/forgot-password', authLimiter, [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { email } = req.body;

    const user = dbServices.getUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({ message: 'If the email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = passwordManager.generateSecureToken();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token
    dbServices.setPasswordResetToken(email, resetToken, resetExpiry);

    // Send reset email
    try {
      await sendEmail({
        to: email,
        subject: 'Password Reset Request',
        html: `
          <h2>Password Reset Request</h2>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <a href="${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}">
            Reset Password
          </a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
      return res.status(500).json({ error: 'Failed to send reset email' });
    }

    // Log event
    dbServices.logAuthEvent({
      userId: user.id,
      email,
      action: 'password_reset_requested',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    res.json({ message: 'If the email exists, a password reset link has been sent.' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Password reset request failed' });
  }
});

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password using token
 * @access Public
 */
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { token, password } = req.body;

    // Validate password strength
    const passwordValidation = passwordManager.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet requirements',
        details: passwordValidation.errors 
      });
    }

    // Get user by reset token
    const user = dbServices.getUserByResetToken(token);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const passwordHash = await passwordManager.hashPassword(password);

    // Update password and clear reset token
    dbServices.updateUserPassword(user.id, passwordHash);
    dbServices.clearPasswordResetToken(user.email);

    // Log event
    dbServices.logAuthEvent({
      userId: user.id,
      email: user.email,
      action: 'password_reset_completed',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user information
 * @access Private
 */
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const user = dbServices.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user permissions
    const permissions = dbServices.getUserPermissions(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        isVerified: user.is_verified,
        isActive: user.is_active,
        lastLogin: user.last_login
      },
      permissions
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

/**
 * @route POST /api/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.post('/change-password', authenticateJWT, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = dbServices.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await passwordManager.comparePassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Validate new password strength
    const passwordValidation = passwordManager.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'New password does not meet requirements',
        details: passwordValidation.errors 
      });
    }

    // Hash new password
    const passwordHash = await passwordManager.hashPassword(newPassword);

    // Update password
    dbServices.updateUserPassword(user.id, passwordHash);

    // Log event
    dbServices.logAuthEvent({
      userId: user.id,
      email: user.email,
      action: 'password_changed',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

module.exports = router; 