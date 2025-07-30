const jwtManager = require('../utils/jwt');
const dbServices = require('../database/services');

/**
 * JWT Authentication Middleware
 * Verifies JWT token and adds user info to request
 */
const authenticateJWT = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify token
    const decoded = jwtManager.verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check if user exists and is active
    const user = await dbServices.getUserById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Add user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      deviceId: decoded.deviceId
    };

    next();
  } catch (error) {
    console.error('JWT Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Role-based Authorization Middleware
 * Checks if user has required role (supports both JWT and session auth)
 */
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    // Check if user exists in request (from JWT)
    let user = req.user;
    
    // If no user from JWT, check for admin session (for admin interface compatibility)
    if (!user && req.cookies?.adminSession) {
      // This is a session-based admin request
      // For admin interface, we'll allow access to admin and manager roles
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      if (roles.includes('admin') || roles.includes('manager')) {
        return next();
      }
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = user.role;
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: userRole
      });
    }

    next();
  };
};

/**
 * Admin Authorization Middleware
 * Checks if user is admin
 */
const requireAdmin = requireRole('admin');

/**
 * Client Authorization Middleware
 * Checks if user is client
 */
const requireClient = requireRole('client');

/**
 * Support Authorization Middleware
 * Checks if user is support or admin
 */
const requireSupport = requireRole(['support', 'admin']);

/**
 * Manager Authorization Middleware
 * Checks if user is manager or admin
 */
const requireManager = requireRole(['manager', 'admin']);

/**
 * Optional Authentication Middleware
 * Adds user info if token is present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : req.cookies?.accessToken;

    if (token) {
      const decoded = jwtManager.verifyAccessToken(token);
      if (decoded) {
        const user = await dbServices.getUserById(decoded.userId);
        if (user && user.isActive) {
          req.user = {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            deviceId: decoded.deviceId
          };
        }
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Device-specific Authentication Middleware
 * Ensures token is valid for the current device
 */
const authenticateDevice = async (req, res, next) => {
  try {
    const deviceId = req.body.deviceId || req.query.deviceId;
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.deviceId !== deviceId) {
      return res.status(403).json({ error: 'Token not valid for this device' });
    }

    next();
  } catch (error) {
    console.error('Device authentication error:', error);
    return res.status(401).json({ error: 'Device authentication failed' });
  }
};

/**
 * Rate Limiting for Authentication Endpoints
 */
const authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
};

module.exports = {
  authenticateJWT,
  requireRole,
  requireAdmin,
  requireClient,
  requireSupport,
  requireManager,
  optionalAuth,
  authenticateDevice,
  authRateLimit
}; 