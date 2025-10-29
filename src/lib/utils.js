/**
 * Utility Functions
 *
 * This module provides common utility functions used across the application.
 * Currently contains JWT token generation and management utilities for
 * user authentication and session handling.
 *
 * @module utils
 * @requires jsonwebtoken - JWT token creation and verification
 */

import jwt from 'jsonwebtoken';
import AuthLog from '../models/AuthLog.js';
import Session from '../models/Session.js';

/**
 * Extract client IP address from request
 *
 * Checks various headers and request properties to find the real client IP,
 * accounting for proxies and load balancers.
 *
 * @function getClientIp
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 *
 * @example
 * const clientIp = getClientIp(req);
 * // Returns: '192.168.1.100' or IPv6 address
 */
export const getClientIp = (req) => {
  // Try to get IP from various headers (for proxied requests)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  // Try other common headers
  const realIp = req.headers['x-real-ip'];
  if (realIp) return realIp;

  // Fallback to direct connection IP
  return req.ip
         || req.connection?.remoteAddress
         || req.socket?.remoteAddress
         || 'unknown';
};

/**
 * Extract user agent from request
 *
 * Retrieves the client's user agent string for browser/device identification.
 *
 * @function getUserAgent
 * @param {Object} req - Express request object
 * @returns {string} User agent string
 *
 * @example
 * const userAgent = getUserAgent(req);
 * // Returns: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...'
 */
export const getUserAgent = (req) => req.headers['user-agent'] || 'unknown';

/**
 * Parse user agent string to extract device information
 *
 * Extracts browser, operating system, and device type from user agent string.
 * Provides a simple parsing without external dependencies.
 *
 * @function parseUserAgent
 * @param {string} userAgent - User agent string from request
 * @returns {Object} Parsed device information
 * @returns {string} returns.browser - Browser name
 * @returns {string} returns.os - Operating system
 * @returns {string} returns.device - Device type
 *
 * @example
 * const deviceInfo = parseUserAgent(req.headers['user-agent']);
 * // Returns: { browser: 'Chrome', os: 'Windows', device: 'Desktop' }
 */
export const parseUserAgent = (userAgent) => {
  if (!userAgent || userAgent === 'unknown') {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown',
    };
  }

  const ua = userAgent.toLowerCase();

  // Detect Browser
  let browser = 'Unknown';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('opera') || ua.includes('opr/')) browser = 'Opera';

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('win')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  // Detect Device Type
  let device = 'Desktop';
  if (ua.includes('mobile')) device = 'Mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) device = 'Tablet';

  return {
    browser,
    os,
    device,
  };
};

/**
 * Generate JWT authentication token and set secure cookie
 *
 * This function creates a JSON Web Token for user authentication and
 * automatically sets it as a secure httpOnly cookie in the response.
 * The token includes user ID and role for authorization purposes.
 * Also creates a session record in the database for session management.
 *
 * @function generateToken
 * @param {string} userId - Unique identifier of the user
 * @param {string} role - User role ('doctor', 'patient', or 'super_admin'/'user_management')
 * @param {Object} res - Express response object for setting cookie
 * @param {Object} req - Express request object for extracting device info
 * @returns {Promise<string>} Generated JWT token string
 * @throws {Error} If token generation fails
 *
 * @example
 * // Generate token for a patient
 * const token = await generateToken(patient._id, 'patient', res, req);
 *
 * @example
 * // Generate token for a doctor
 * const token = await generateToken(doctor._id, 'doctor', res, req);
 *
 * @security
 * - Token expires in 7 days for security
 * - httpOnly cookie prevents XSS attacks
 * - sameSite 'strict' prevents CSRF attacks
 * - secure flag ensures HTTPS-only transmission
 * - Session tracked in database
 */
export const generateToken = async (userId, role, res, req = null) => {
  try {
    // Create JWT token with user ID and role
    const token = jwt.sign(
      { id: userId, role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }, // Token valid for 7 days
    );

    // Determine if we're in production based on NODE_ENV
    const isProduction = process.env.NODE_ENV === 'production';

    // Set secure httpOnly cookie with token
    res.cookie('token', token, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      httpOnly: true, // Prevent XSS attacks
      sameSite: 'strict', // CSRF protection
      secure: isProduction, // HTTPS only in production, HTTP allowed in development
    });

    // Create session record in database if req object is provided
    if (req) {
      try {
        const ipAddress = getClientIp(req);
        const userAgent = getUserAgent(req);
        const deviceInfo = parseUserAgent(userAgent);

        // Map role to userType for session
        let userType = 'Patient';
        if (role === 'doctor') userType = 'Doctor';
        else if (role === 'super_admin' || role === 'user_management') userType = 'Admin';

        // FR-1.4: Single Device Login Enforcement
        // Revoke all existing sessions before creating a new one
        const enforcement = await Session.enforceSingleDevice(userId, userType);

        if (enforcement.previousDeviceLoggedOut) {
          console.log(`✓ Single device enforcement: Previous device(s) logged out for user ${userId}`);
        }

        // Calculate expiration date (7 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await Session.createSession({
          userId,
          userType,
          token,
          deviceInfo,
          ipAddress,
          lastActivity: new Date(),
          expiresAt,
        });

        console.log(`✓ New session created for ${userType} ${userId}`);
      } catch (sessionError) {
        console.error('Error creating session record:', sessionError);
        // Don't throw - session tracking failure shouldn't break login
      }
    }

    return token;
  } catch (error) {
    throw new Error('Failed to generate authentication token');
  }
};

/**
 * Log authentication event
 *
 * Creates a comprehensive log entry for authentication-related actions.
 * Automatically extracts IP address and user agent from the request.
 * This function is non-blocking and will not throw errors to avoid
 * disrupting the authentication flow.
 *
 * @async
 * @function logAuthEvent
 * @param {Object} params - Logging parameters
 * @param {Object} params.req - Express request object
 * @param {string} params.action - Authentication action type
 * @param {string} params.email - User email address
 * @param {boolean} params.success - Whether the action was successful
 * @param {string} [params.userId] - User ID (if available)
 * @param {string} [params.userType] - User type (Doctor/Patient/Admin)
 * @param {string} [params.failureReason] - Reason for failure (if applicable)
 * @param {Object} [params.metadata] - Additional metadata
 * @returns {Promise<Object|null>} Created log entry or null if logging failed
 *
 * @example
 * // Log successful login
 * await logAuthEvent({
 *   req,
 *   action: 'login',
 *   email: 'user@example.com',
 *   success: true,
 *   userId: user._id,
 *   userType: 'Patient'
 * });
 *
 * @example
 * // Log failed login attempt
 * await logAuthEvent({
 *   req,
 *   action: 'failed_login',
 *   email: 'user@example.com',
 *   success: false,
 *   failureReason: 'Invalid password'
 * });
 */
export const logAuthEvent = async ({
  req,
  action,
  email,
  success,
  userId = null,
  userType = null,
  failureReason = null,
  metadata = {},
}) => {
  try {
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);

    const logData = {
      userId,
      userType,
      email,
      action,
      ipAddress,
      userAgent,
      success,
      failureReason,
      metadata,
    };

    return await AuthLog.logEvent(logData);
  } catch (error) {
    // Log error but don't throw - logging should not break auth flow
    console.error('Error in logAuthEvent:', error);
    return null;
  }
};
