/**
 * Express-Validator Validation Middleware
 *
 * This module provides validation middleware chains for all authentication routes:
 * - User registration (with role-specific validation)
 * - User login
 * - Admin login
 * - Password reset request
 * - Password reset confirmation
 *
 * Uses custom validators from validators.js for complex validation logic
 *
 * @module validation
 * @requires express-validator
 * @requires validators
 */

import { body, validationResult } from 'express-validator';
import {
  validatePasswordStrength,
  validatePhoneNumber,
  validateNameFormat,
  validateEmailFormat,
  validateBloodGroup,
  validateDateOfBirth,
  validateExperience,
  validateGender,
  validateSpecialization,
  validateQualification,
} from './validators.js';

/**
 * Middleware to handle validation results
 * Checks if there are validation errors and returns formatted error response
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with validation errors or calls next()
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Format errors into a readable structure
    const formattedErrors = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
    });
  }

  next();
};

/**
 * Validation rules for user registration
 * Validates common fields for all users (name, email, password, role)
 * Role-specific fields are validated conditionally in the controller
 */
export const validateRegister = [
  // Name validation
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .custom(validateNameFormat)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

  // Email validation
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .custom(validateEmailFormat),

  // Password validation with strength requirements
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .custom(validatePasswordStrength),

  // Role validation
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['doctor', 'patient'])
    .withMessage('Role must be either "doctor" or "patient"'),

  // Contact Number validation (optional for registration)
  body('contactNumber')
    .optional({ checkFalsy: true })
    .custom(validatePhoneNumber),

  // Doctor-specific fields (validated only when role is 'doctor')
  body('specialization')
    .if(body('role').equals('doctor'))
    .notEmpty()
    .withMessage('Specialization is required for doctors')
    .custom(validateSpecialization),

  body('experience')
    .if(body('role').equals('doctor'))
    .notEmpty()
    .withMessage('Experience is required for doctors')
    .isNumeric()
    .withMessage('Experience must be a number')
    .custom(validateExperience),

  body('qualification')
    .if(body('role').equals('doctor'))
    .notEmpty()
    .withMessage('Qualification is required for doctors')
    .custom(validateQualification),

  // Patient-specific fields (optional but validated if provided)
  body('dateOfBirth')
    .if(body('role').equals('patient'))
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
    .custom(validateDateOfBirth),

  body('gender')
    .if(body('role').equals('patient'))
    .optional({ checkFalsy: true })
    .custom(validateGender),

  body('bloodGroup')
    .if(body('role').equals('patient'))
    .optional({ checkFalsy: true })
    .custom(validateBloodGroup),

  // Handle validation errors
  handleValidationErrors,
];

/**
 * Validation rules for user login
 * Validates email, password, and role
 */
export const validateLogin = [
  // Email validation
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  // Password validation (not checking strength on login, just presence)
  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  // Role validation
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['doctor', 'patient'])
    .withMessage('Role must be either "doctor" or "patient"'),

  // Handle validation errors
  handleValidationErrors,
];

/**
 * Validation rules for admin login
 * Validates email and password only (no role needed)
 */
export const validateAdminLogin = [
  // Email validation
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  // Password validation
  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  // Handle validation errors
  handleValidationErrors,
];

/**
 * Validation rules for password reset request
 * Validates email and role
 */
export const validatePasswordResetRequest = [
  // Email validation
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  // Role validation
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['doctor', 'patient', 'admin'])
    .withMessage('Role must be either "doctor", "patient", or "admin"'),

  // Handle validation errors
  handleValidationErrors,
];

/**
 * Validation rules for password reset confirmation
 * Validates OTP/token and new password strength
 */
export const validatePasswordReset = [
  // Token/OTP validation
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Reset token must be 6 digits')
    .isNumeric()
    .withMessage('Reset token must contain only numbers'),

  // New password validation with strength requirements
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .custom(validatePasswordStrength),

  // Confirm password validation
  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your new password')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  // Handle validation errors
  handleValidationErrors,
];

/**
 * Validation rules for OTP verification
 * Validates OTP code format
 */
export const validateOTP = [
  // Email validation
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  // OTP validation
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),

  // Role validation
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['doctor', 'patient'])
    .withMessage('Role must be either "doctor" or "patient"'),

  // Handle validation errors
  handleValidationErrors,
];

/**
 * Validation rules for resending OTP
 *
 * Validates:
 * - Email: Required, valid format
 * - Role: Required, must be 'doctor' or 'patient'
 * - Purpose: Required, must be 'registration' or 'login'
 *
 * @type {Array<ValidationChain>}
 */
export const validateResendOTP = [
  // Email validation
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .custom(validateEmailFormat),

  // Role validation
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['doctor', 'patient'])
    .withMessage('Role must be either doctor or patient'),

  // Purpose validation
  body('purpose')
    .notEmpty()
    .withMessage('Purpose is required')
    .isIn(['registration', 'login'])
    .withMessage('Purpose must be either registration or login'),

  // Handle validation errors
  handleValidationErrors,
];

/**
 * Validation rules for OTP verification
 *
 * Validates:
 * - Email: Required, valid format
 * - OTP: Required, 6 digits only
 * - Role: Required, must be 'doctor' or 'patient'
 * - Purpose: Required, must be 'registration' or 'login'
 *
 * @type {Array<ValidationChain>}
 */
export const validateVerifyOTP = [
  // Email
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .custom(validateEmailFormat),

  // OTP
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .matches(/^[0-9]{6}$/)
    .withMessage('OTP must contain only numbers'),

  // Role
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['doctor', 'patient'])
    .withMessage('Role must be either doctor or patient'),

  // Purpose
  body('purpose')
    .notEmpty()
    .withMessage('Purpose is required')
    .isIn(['registration', 'login'])
    .withMessage('Purpose must be either registration or login'),

  // Handle validation errors
  handleValidationErrors,
];

/**
 * Validation rules for updating user profile
 * Validates fields that can be updated
 */
export const validateProfileUpdate = [
  // Name validation (optional)
  body('name')
    .optional()
    .trim()
    .custom(validateNameFormat),

  // Contact number validation (optional)
  body('contactNumber')
    .optional({ checkFalsy: true })
    .custom(validatePhoneNumber),

  // Date of birth validation (optional, for patients)
  body('dateOfBirth')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
    .custom(validateDateOfBirth),

  // Gender validation (optional)
  body('gender')
    .optional({ checkFalsy: true })
    .custom(validateGender),

  // Blood group validation (optional)
  body('bloodGroup')
    .optional({ checkFalsy: true })
    .custom(validateBloodGroup),

  // Handle validation errors
  handleValidationErrors,
];

/**
 * Validation rules for changing password
 * Validates current password and new password strength
 */
export const validateChangePassword = [
  // Current password
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  // New password with strength validation
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .custom(validatePasswordStrength)
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),

  // Confirm password
  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your new password')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  // Handle validation errors
  handleValidationErrors,
];

/**
 * Validation rules for forgot password
 * Validates email and role
 */
export const validateForgotPassword = [
  // Email validation
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .custom(validateEmailFormat),

  // Role validation
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['doctor', 'patient', 'admin'])
    .withMessage('Role must be either doctor, patient, or admin'),

  // Handle validation errors
  handleValidationErrors,
];

/**
 * Validation rules for reset password
 * Validates new password and confirmation
 */
export const validateResetPassword = [
  // New password with strength validation
  body('password')
    .notEmpty()
    .withMessage('New password is required')
    .custom(validatePasswordStrength),

  // Confirm password
  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your new password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  // Role validation
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['doctor', 'patient', 'admin'])
    .withMessage('Role must be either doctor, patient, or admin'),

  // Handle validation errors
  handleValidationErrors,
];
