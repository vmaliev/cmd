const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

class JWTManager {
  constructor() {
    this.secret = JWT_SECRET;
    this.refreshSecret = JWT_REFRESH_SECRET;
    this.expiresIn = JWT_EXPIRES_IN;
    this.refreshExpiresIn = JWT_REFRESH_EXPIRES_IN;
  }

  /**
   * Generate access token for user
   * @param {Object} payload - Token payload
   * @param {string} payload.userId - User ID
   * @param {string} payload.email - User email
   * @param {string} payload.role - User role
   * @param {string} payload.deviceId - Device ID
   * @returns {string} JWT token
   */
  generateAccessToken(payload) {
    const tokenPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      deviceId: payload.deviceId,
      type: 'access',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(tokenPayload, this.secret, { expiresIn: this.expiresIn });
  }

  /**
   * Generate refresh token for user
   * @param {Object} payload - Token payload
   * @param {string} payload.userId - User ID
   * @param {string} payload.email - User email
   * @param {string} payload.role - User role
   * @param {string} payload.deviceId - Device ID
   * @returns {string} JWT refresh token
   */
  generateRefreshToken(payload) {
    const tokenPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      deviceId: payload.deviceId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(tokenPayload, this.refreshSecret, { expiresIn: this.refreshExpiresIn });
  }

  /**
   * Verify access token
   * @param {string} token - JWT token to verify
   * @returns {Object|null} Decoded token payload or null if invalid
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret);
      if (decoded.type !== 'access') {
        return null;
      }
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - JWT refresh token to verify
   * @returns {Object|null} Decoded token payload or null if invalid
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshSecret);
      if (decoded.type !== 'refresh') {
        return null;
      }
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate token pair (access + refresh)
   * @param {Object} payload - Token payload
   * @returns {Object} Object containing access and refresh tokens
   */
  generateTokenPair(payload) {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload)
    };
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Valid refresh token
   * @returns {Object|null} New token pair or null if refresh token is invalid
   */
  refreshAccessToken(refreshToken) {
    const decoded = this.verifyRefreshToken(refreshToken);
    if (!decoded) {
      return null;
    }

    const payload = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      deviceId: decoded.deviceId
    };

    return this.generateTokenPair(payload);
  }

  /**
   * Decode token without verification (for debugging)
   * @param {string} token - JWT token
   * @returns {Object|null} Decoded token payload or null if invalid format
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get token expiration time
   * @param {string} token - JWT token
   * @returns {Date|null} Expiration date or null if invalid
   */
  getTokenExpiration(token) {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }
    return new Date(decoded.exp * 1000);
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @returns {boolean} True if token is expired
   */
  isTokenExpired(token) {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      return true;
    }
    return Date.now() > expiration.getTime();
  }
}

// Create singleton instance
const jwtManager = new JWTManager();

module.exports = jwtManager; 