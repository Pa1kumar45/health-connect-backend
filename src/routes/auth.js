/**
 * Authentication Routes
 *
 * This module defines all authentication-related API endpoints including:
 * - User registration (doctors and patients)
 * - User login and logout
 * - Current user retrieval
 * - JWT token management
 *
 * All routes except registration and login require authentication middleware.
 *
 * @module authRoutes
 * @requires express - Express framework
 * @requires validation - Comprehensive input validation middleware
 * @requires authController - Authentication business logic
 * @requires auth - Authentication middleware
 */

import express from 'express';
import {
  register,
  login,
  logout,
  getCurrentUser,
  adminLogin,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
  changePassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import {
  validateRegister,
  validateLogin,
  validateAdminLogin,
  validateVerifyOTP,
  validateResendOTP,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
} from '../middleware/validation.js';
import sessionRoutes from './sessions.js';

// Create Express router instance
const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * POST /api/auth/register
 * Register a new user (doctor or patient) - Step 1: Create account and send OTP
 *
 * Public endpoint - no authentication required
 * Validates required fields with comprehensive format checking:
 * - Name: 2-50 chars, only letters/spaces/hyphens/apostrophes
 * - Email: Valid email format with domain validation
 * - Password: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
 * - Phone: 10-digit Indian mobile number (optional)
 * - Role-specific: Doctor (specialization, experience 0-60, qualification)
 *                  Patient (dateOfBirth, gender, bloodGroup - all optional)
 *
 * Creates user account with hashed password and sends OTP to email for verification
 * User must verify OTP before they can login (no direct login allowed)
 *
 * @route POST /api/auth/register
 * @access Public
 * @param {string} name - User's full name
 * @param {string} email - User's email (must be unique)
 * @param {string} password - User's password
 * @param {string} role - User role ('doctor' or 'patient')
 * @param {string} contactNumber - Phone number (optional)
 * @param {Object} additionalData - Role-specific fields
 * @returns {Object} Confirmation that account created and OTP sent to email
 */
router.post('/register', validateRegister, register);

/**
 * POST /api/auth/login
 * Authenticate user login - Step 1: Validate credentials and send OTP
 *
 * Public endpoint - validates credentials and sends OTP to user's email
 * Validates email format and password presence
 * Searches appropriate collection based on role
 * Sends OTP to email for verification (no direct login allowed)
 *
 * @route POST /api/auth/login
 * @access Public
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} role - User role ('doctor' or 'patient')
 * @returns {Object} Confirmation that OTP was sent to email
 */
router.post('/login', validateLogin, login);

/**
 * POST /api/auth/verify-otp
 * Verify OTP and complete authentication
 *
 * Public endpoint - verifies OTP code sent to user's email
 * For registration: marks email as verified, sends welcome email
 * For login: issues JWT token and creates session
 * Maximum 3 attempts allowed per OTP, 10-minute expiry
 *
 * @route POST /api/auth/verify-otp
 * @access Public
 * @param {string} email - User's email
 * @param {string} otp - 6-digit OTP code
 * @param {string} role - User role ('doctor' or 'patient')
 * @param {string} purpose - OTP purpose ('registration' or 'login')
 * @returns {Object} User data with JWT cookie (for login) or confirmation (for registration)
 */
router.post('/verify-otp', validateVerifyOTP, verifyOTP);

/**
 * POST /api/auth/resend-otp
 * Resend OTP to user's email
 *
 * Public endpoint - generates and sends a new OTP
 * Rate limited to 1 OTP per minute per email/purpose combination
 * Previous OTPs for same purpose are invalidated
 *
 * @route POST /api/auth/resend-otp
 * @access Public
 * @param {string} email - User's email
 * @param {string} role - User role ('doctor' or 'patient')
 * @param {string} purpose - OTP purpose ('registration' or 'login')
 * @returns {Object} Confirmation that new OTP was sent
 */
router.post('/resend-otp', validateResendOTP, resendOTP);

/**
 * POST /api/auth/logout
 * Log out current user
 *
 * Protected endpoint - requires valid JWT token
 * Clears authentication cookie to end user session
 *
 * @route POST /api/auth/logout
 * @access Private
 * @returns {Object} Success confirmation message
 */
router.post('/logout', protect, logout);

/**
 * POST /api/auth/admin/login
 * Authenticate admin login
 *
 * Public endpoint - validates admin credentials with email format validation
 * Only for admin users with admin or super_admin role
 * Sets JWT token as httpOnly cookie upon successful authentication
 *
 * @route POST /api/auth/admin/login
 * @access Public
 * @param {string} email - Admin email
 * @param {string} password - Admin password
 * @returns {Object} Authenticated admin data with JWT cookie set
 */
router.post('/admin/login', validateAdminLogin, adminLogin);

/**
 * GET /api/auth/me
 * Get current authenticated user information
 *
 * Protected endpoint - requires valid JWT token
 * Returns user profile data populated by auth middleware
 *
 * @route GET /api/auth/me
 * @access Private
 * @returns {Object} Current user profile data
 */
router.get('/me', protect, getCurrentUser);

/**
 * POST /api/auth/forgot-password
 * Request password reset
 *
 * Public endpoint - sends password reset link to user's email
 * Generates secure reset token and sends via email
 * Token expires in 1 hour
 *
 * @route POST /api/auth/forgot-password
 * @access Public
 * @param {string} email - User's email address
 * @param {string} role - User role ('doctor', 'patient', or 'admin')
 * @returns {Object} Confirmation that reset link was sent
 */
router.post('/forgot-password', validateForgotPassword, forgotPassword);

/**
 * POST /api/auth/reset-password/:token
 * Reset password with token
 *
 * Public endpoint - validates token and updates password
 * Token must be valid and not expired
 * Password must meet strength requirements
 *
 * @route POST /api/auth/reset-password/:token
 * @access Public
 * @param {string} token - Password reset token from email (URL parameter)
 * @param {string} password - New password
 * @param {string} confirmPassword - Password confirmation
 * @param {string} role - User role ('doctor', 'patient', or 'admin')
 * @returns {Object} Confirmation that password was reset
 */
router.post('/reset-password', validateResetPassword, resetPassword);

/**
 * PUT /api/auth/change-password
 * Change password (authenticated user)
 *
 * Protected endpoint - requires valid JWT token
 * User must provide current password for verification
 * New password must meet strength requirements
 *
 * @route PUT /api/auth/change-password
 * @access Private
 * @param {string} currentPassword - Current password for verification
 * @param {string} newPassword - New password
 * @param {string} confirmPassword - Password confirmation
 * @returns {Object} Confirmation that password was changed
 */
router.put('/change-password', protect, validateChangePassword, changePassword);

// ============================================
// SESSION MANAGEMENT ROUTES (Protected)
// ============================================
// Include session management routes - must be at the end to avoid conflicts
router.use('/', sessionRoutes);

export default router;
