/**
 * Authentication Middleware
 *
 * This module provides authentication and authorization middleware for the healthcare system.
 * It includes:
 * - JWT token verification and validation
 * - User authentication and session management
 * - Role-based access control (doctor/patient)
 * - Token expiration checking
 *
 * @module authMiddleware
 * @requires jsonwebtoken - JWT token handling
 * @requires Doctor - Doctor model for user lookup
 * @requires Patient - Patient model for user lookup
 */

import jwt from 'jsonwebtoken';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import Admin from '../models/Admin.js';
import Session from '../models/Session.js';

/**
 * Verify and decode JWT token
 *
 * This function validates a JWT token and extracts user information.
 * It checks for token presence, validity, and expiration.
 *
 * @async
 * @function verifyToken
 * @param {string} token - JWT token from request cookie
 * @returns {Promise<Object>} Object containing userId and role
 * @throws {Error} If token is missing, invalid, or expired
 */
const verifyToken = async (token) => {
  try {
    if (!token) {
      throw new Error('No token provided');
    }

    // Verify token signature and decode payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is expired (additional safety check)
    if (Date.now() >= decoded.exp * 1000) {
      console.log('token expired');
      throw new Error('Token has expired');
    }

    const { id } = decoded;

    return { userId: id, role: decoded.role };
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.log('other error');
      // throw new Error('Invalid token');
    }
    console.log('error');
  }
};

/**
 * Main authentication middleware
 *
 * This middleware function protects routes by verifying JWT tokens and
 * populating request object with authenticated user information.
 * It extracts token from httpOnly cookies and validates user existence.
 *
 * @async
 * @function protect
 * @param {Object} req - Express request object
 * @param {Object} req.cookies - Request cookies containing JWT token
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @sets req.token - JWT token string
 * @sets req.user - Authenticated user object (Doctor or Patient)
 * @sets req.userRole - User role ('doctor' or 'patient')
 *
 * @returns {void} Calls next() on success or sends error response
 * @throws {401} If token is missing or invalid
 * @throws {400} If token verification fails
 */
export const protect = async (req, res, next) => {
  try {
    // Extract JWT token from httpOnly cookie
    const { token } = req.cookies;
    
    // Debug logging
    console.log('🔐 Auth Middleware - Token present:', !!token);
    console.log('🍪 All cookies:', Object.keys(req.cookies));
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'missing token' });
    }

    // Verify token and extract user information
    const { userId, role } = await verifyToken(token);
    console.log('✓ Token verified - User:', userId, 'Role:', role);
    let user;

    // Fetch user from appropriate collection based on role
    if (role === 'patient') {
      user = await Patient.findById(userId);
    } else if (role === 'doctor') {
      user = await Doctor.findById(userId);
    } else if (role === 'admin' || role === 'super_admin') {
      user = await Admin.findById(userId);
    } else {
      return res.status(401).json({ success: false, message: 'Invalid role' });
    }

    // Validate that user exists and role is valid
    if (!user || !role) {
      console.log('errorinvalid');
      return res.status(401).json({ success: false, message: ' Invalid' });
    }

    // Validate session exists and is active
    const session = await Session.findByToken(token);
    if (!session) {
      // Session doesn't exist or is expired
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid. Please login again.',
      });
    }

    // Update session activity timestamp
    await Session.updateActivity(token);

    // Populate request object with authenticated user data
    req.token = token;
    req.user = user;
    req.userRole = role;
    req.session = session; // Add session to request
    next(); // Continue to next middleware/route handler
  } catch (error) {
    console.log('eroror', error);
    return res.status(400).json({ success: false, message: error });
  }
};

/**
 * Doctor-only access middleware
 *
 * This middleware restricts access to doctor-only endpoints.
 * Must be used after the protect middleware to ensure req.userRole is populated.
 *
 * @function doctorOnly
 * @param {Object} req - Express request object
 * @param {string} req.userRole - User role (set by protect middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @returns {void} Calls next() if user is doctor, sends 403 error otherwise
 */
export const doctorOnly = (req, res, next) => {
  if (req.userRole !== 'doctor') {
    return res.status(403).json({
      message: 'Access denied. This endpoint is only available to doctors.',
    });
  }
  next();
};

/**
 * Patient-only access middleware
 *
 * This middleware restricts access to patient-only endpoints.
 * Must be used after the protect middleware to ensure req.userRole is populated.
 *
 * @function patientOnly
 * @param {Object} req - Express request object
 * @param {string} req.userRole - User role (set by protect middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @returns {void} Calls next() if user is patient, sends 403 error otherwise
 */
export const patientOnly = (req, res, next) => {
  if (req.userRole !== 'patient') {
    return res.status(403).json({
      message: 'Access denied. This endpoint is only available to patients.',
    });
  }
  next();
};

/**
 * Admin only access middleware
 * Ensures only admin users can access protected routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const adminOnly = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization error',
    });
  }
};

/**
 * Super admin only access middleware
 * Restricts access to super admin users only
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const superAdminOnly = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin access required',
      });
    }
    next();
  } catch (error) {
    console.error('Super admin middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization error',
    });
  }
};
