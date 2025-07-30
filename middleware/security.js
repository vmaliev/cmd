const rateLimit = require('express-rate-limit');
const dbServices = require('../database/services');

// ==================== IP-BASED SECURITY ====================

// Store blocked IPs in memory (in production, use Redis)
const blockedIPs = new Map();
const suspiciousIPs = new Map();

/**
 * IP Blocking Middleware
 * Blocks IPs that have been flagged for suspicious activity
 */
const ipBlockingMiddleware = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (blockedIPs.has(clientIP)) {
    const blockInfo = blockedIPs.get(clientIP);
    if (Date.now() < blockInfo.until) {
      return res.status(403).json({ 
        error: 'IP address is blocked',
        reason: blockInfo.reason,
        until: new Date(blockInfo.until).toISOString()
      });
    } else {
      // Block expired, remove from blocked list
      blockedIPs.delete(clientIP);
    }
  }
  
  next();
};

/**
 * Block an IP address
 * @param {string} ip - IP address to block
 * @param {number} duration - Duration in milliseconds
 * @param {string} reason - Reason for blocking
 */
const blockIP = (ip, duration = 60 * 60 * 1000, reason = 'Suspicious activity') => {
  blockedIPs.set(ip, {
    until: Date.now() + duration,
    reason: reason,
    blockedAt: new Date().toISOString()
  });
  
  console.log(`IP ${ip} blocked for ${duration/1000/60} minutes: ${reason}`);
};

/**
 * Unblock an IP address
 * @param {string} ip - IP address to unblock
 */
const unblockIP = (ip) => {
  blockedIPs.delete(ip);
  console.log(`IP ${ip} unblocked`);
};

// ==================== RATE LIMITING ====================

// General API rate limiting
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    blockIP(clientIP, 30 * 60 * 1000, 'Rate limit exceeded');
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later',
      retryAfter: Math.ceil(30 * 60 / 60) // 30 minutes in minutes
    });
  }
});

// Strict rate limiting for sensitive endpoints
const strictRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    blockIP(clientIP, 60 * 60 * 1000, 'Strict rate limit exceeded');
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later',
      retryAfter: Math.ceil(60 * 60 / 60) // 60 minutes in minutes
    });
  }
});

// ==================== SESSION SECURITY ====================

/**
 * Session Timeout Middleware
 * Checks if user session has timed out
 */
const sessionTimeoutMiddleware = (req, res, next) => {
  if (req.user) {
    // Check if user has been inactive for too long
    const lastActivity = req.session?.lastActivity || Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes
    
    if (Date.now() - lastActivity > timeout) {
      // Session expired, clear user data
      req.user = null;
      req.session = null;
      return res.status(401).json({ 
        error: 'Session expired due to inactivity',
        code: 'SESSION_TIMEOUT'
      });
    }
    
    // Update last activity
    if (req.session) {
      req.session.lastActivity = Date.now();
    }
  }
  
  next();
};

/**
 * Device Validation Middleware
 * Validates that the request is coming from the same device
 */
const deviceValidationMiddleware = (req, res, next) => {
  if (req.user && req.user.deviceId) {
    const requestDeviceId = req.body.deviceId || req.query.deviceId || req.headers['x-device-id'];
    
    if (requestDeviceId && requestDeviceId !== req.user.deviceId) {
      // Log suspicious activity
      dbServices.logAuthEvent({
        userId: req.user.id,
        email: req.user.email,
        action: 'suspicious_device',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        deviceId: requestDeviceId,
        success: false,
        details: {
          expectedDevice: req.user.deviceId,
          actualDevice: requestDeviceId
        }
      });
      
      return res.status(403).json({ 
        error: 'Request from unauthorized device',
        code: 'DEVICE_MISMATCH'
      });
    }
  }
  
  next();
};

// ==================== TWO-FACTOR AUTHENTICATION ====================

/**
 * 2FA Verification Middleware
 * Requires 2FA verification for sensitive operations
 */
const require2FA = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check if user has 2FA enabled
  const user = dbServices.getUserById(req.user.id);
  if (!user || !user.two_factor_enabled) {
    // 2FA not enabled, allow access
    return next();
  }
  
  // Check if 2FA has been verified in this session
  if (!req.session?.twoFactorVerified) {
    return res.status(403).json({ 
      error: 'Two-factor authentication required',
      code: '2FA_REQUIRED'
    });
  }
  
  next();
};

/**
 * 2FA Setup Middleware
 * Handles 2FA setup and verification
 */
const twoFactorSetup = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const user = dbServices.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Add 2FA info to request
  req.twoFactorInfo = {
    enabled: user.two_factor_enabled || false,
    secret: user.two_factor_secret,
    verified: req.session?.twoFactorVerified || false
  };
  
  next();
};

// ==================== AUDIT LOGGING ====================

/**
 * Security Audit Middleware
 * Logs security-relevant events
 */
const securityAuditMiddleware = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log security events
    if (res.statusCode >= 400) {
      const securityEvent = {
        userId: req.user?.id,
        email: req.user?.email || req.body?.email,
        action: 'api_error',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        deviceId: req.body?.deviceId || req.query?.deviceId,
        success: false,
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          error: typeof data === 'string' ? data : JSON.stringify(data)
        }
      };
      
      dbServices.logAuthEvent(securityEvent);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// ==================== INPUT VALIDATION ====================

/**
 * Enhanced Input Sanitization Middleware
 * Sanitizes and validates input data
 */
const inputSanitizationMiddleware = (req, res, next) => {
  // Sanitize request body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Remove potential XSS vectors
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      }
    });
  }
  
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      }
    });
  }
  
  next();
};

// ==================== HEADER SECURITY ====================

/**
 * Security Headers Middleware
 * Adds additional security headers
 */
const securityHeadersMiddleware = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// ==================== EXPORT ====================

module.exports = {
  // IP Security
  ipBlockingMiddleware,
  blockIP,
  unblockIP,
  
  // Rate Limiting
  generalRateLimit,
  strictRateLimit,
  
  // Session Security
  sessionTimeoutMiddleware,
  deviceValidationMiddleware,
  
  // 2FA
  require2FA,
  twoFactorSetup,
  
  // Audit & Validation
  securityAuditMiddleware,
  inputSanitizationMiddleware,
  securityHeadersMiddleware
}; 