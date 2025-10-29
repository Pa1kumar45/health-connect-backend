/**
 * Authentication Controller
 *
 * This module handles all authentication-related operations including:
 * - User registration with OTP verification
 * - User login with OTP verification
 * - OTP generation, verification, and resending
 * - JWT token management
 * - Current user retrieval
 *
 * @module authController
 * @requires Doctor - Doctor model for database operations
 * @requires Patient - Patient model for database operations
 * @requires OTP - OTP model for verification
 * @requires emailService - Email service for sending OTPs
 * @requires generateToken - Utility function for JWT token generation
 */

import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import Admin from '../models/Admin.js';
import OTP from '../models/OTP.js';
import Session from '../models/Session.js';
import {
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
} from '../services/emailService.js';
import { generateToken, logAuthEvent } from '../lib/utils.js';

/**
 * Helper function to get User Model based on role
 * @param {string} role - User role ('doctor', 'patient', or 'admin')
 * @returns {Model} Mongoose model for the specified role
 */
const getUserModel = (role) => {
  if (role === 'doctor') return Doctor;
  if (role === 'patient') return Patient;
  return Admin;
};

/**
 * Helper function to get user type string based on role
 * @param {string} role - User role ('doctor', 'patient', or 'admin')
 * @returns {string} Capitalized user type string
 */
const getUserType = (role) => {
  if (role === 'doctor') return 'Doctor';
  if (role === 'patient') return 'Patient';
  return 'Admin';
};

/**
 * Formats user data for API response based on user role
 *
 * @param {Object} user - User document from database (Doctor or Patient)
 * @param {string} role - User role ('doctor' or 'patient')
 * @returns {Object} Formatted user object with role-specific fields
 *
 * For doctors, includes: specialization, experience, qualification, about, contactNumber, schedule
 * For patients, includes: dateOfBirth, gender, contactNumber, emergencyContact, bloodGroup, allergies
 */
const formatUserResponse = (user, role) => ({
  name: user.name,
  email: user.email,
  role,
  avatar: user.avatar || '',
  isEmailVerified: user.isEmailVerified || false,
  // Conditional spread: include doctor-specific fields if role is 'doctor'
  ...(role === 'doctor' ? {
    specialization: user.specialization,
    experience: user.experience,
    qualification: user.qualification,
    about: user.about || '',
    contactNumber: user.contactNumber || '',
    schedule: user.schedule || [], // Doctor's availability schedule
  } : {
    // Patient-specific fields
    dateOfBirth: user.dateOfBirth || '',
    gender: user.gender || '',
    contactNumber: user.contactNumber || '',
    emergencyContact: user.emergencyContact || [],
    bloodGroup: user.bloodGroup || '',
    allergies: user.allergies || '',
    // profileCompleted: user.profileCompleted || false
  }),
});

/**
 * Register a new user (doctor or patient) - Step 1
 *
 * This function handles user registration with email verification via OTP.
 * User account is created but marked as unverified until OTP is confirmed.
 *
 * Flow:
 * 1. Validate input data
 * 2. Check if user already exists
 * 3. Create user account (isEmailVerified = false)
 * 4. Generate 6-digit OTP
 * 5. Send OTP to user's email
 * 6. Return success message (user must verify OTP to login)
 *
 * @async
 * @function register
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing user registration data
 * @param {string} req.body.name - User's full name (required)
 * @param {string} req.body.email - User's email address (required, must be unique)
 * @param {string} req.body.password - User's password (required, will be hashed)
 * @param {string} req.body.role - User role: 'doctor' or 'patient' (required)
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with message to verify OTP
 * @throws {400} If required fields are missing or user already exists
 * @throws {500} If database operation fails
 */
export const register = async (req, res) => {
  try {
    console.log('Register endpoint hit with data:', req.body);

    const {
      name,
      email,
      password,
      role,
      ...additionalData
    } = req.body;

    // Validation is already done by middleware
    // No need for manual validation here

    // Check for existing users with same email across both collections
    const existingDoctor = await Doctor.findOne({ email });
    const existingPatient = await Patient.findOne({ email });

    if (existingDoctor || existingPatient) {
      // Log failed registration attempt
      await logAuthEvent({
        req,
        action: 'register',
        email,
        success: false,
        failureReason: 'Email already registered',
        metadata: { role },
      });

      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }

    // Select appropriate model based on role
    const UserModel = role === 'doctor' ? Doctor : Patient;

    // Create new user instance (email not verified yet)
    const user = new UserModel({
      name,
      email,
      password, // Will be hashed by pre-save middleware
      isEmailVerified: false, // User needs to verify email
      ...additionalData, // Role-specific fields
    });

    // Save user to database
    console.log('Saving user to database:', { name, email, role });
    await user.save();
    console.log('✅ User saved successfully');

    // Generate and send OTP
    const { otp } = await OTP.createOTP(email, role, 'registration');
    console.log(`📧 OTP generated for ${email}: ${otp}`);

    // Send OTP email
    const emailResult = await sendOTPEmail({
      email,
      name,
      otp,
      purpose: 'registration',
    });

    if (!emailResult.success) {
      // If email fails, still return success but inform user
      console.warn('⚠️  Email service failed, but user registered');
      return res.status(201).json({
        success: true,
        message: 'Registration successful. Email service temporarily unavailable. Please contact support for OTP.',
        data: {
          email,
          role,
          requiresVerification: true,
          otp: process.env.NODE_ENV === 'development' ? otp : undefined, // Only show OTP in development
        },
      });
    }

    console.log(`✅ OTP email sent to ${email}`);

    // Log successful registration
    await logAuthEvent({
      req,
      action: 'register',
      email,
      success: true,
      userId: user._id,
      userType: role === 'doctor' ? 'Doctor' : 'Patient',
      metadata: { requiresVerification: true },
    });

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email for the OTP to verify your account.',
      data: {
        email,
        role,
        requiresVerification: true,
        // In development, include OTP in response for testing
        ...(process.env.NODE_ENV === 'development' && { otp }),
      },
    });
  } catch (error) {
    console.error('❌ Register endpoint ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error in registration process',
      error: error.message,
    });
  }
};

/**
 * Authenticate user login - Step 1: Validate credentials and send OTP
 *
 * This function validates user credentials and sends an OTP for verification.
 * Direct login is no longer allowed - OTP verification is mandatory.
 *
 * @async
 * @function login
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing login credentials
 * @param {string} req.body.email - User's email address
 * @param {string} req.body.password - User's password (plain text)
 * @param {string} req.body.role - User role ('doctor' or 'patient')
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with OTP sent confirmation
 * @throws {400} If credentials are invalid or email not verified
 * @throws {403} If account is suspended
 * @throws {429} If OTP rate limit exceeded
 * @throws {500} If database operation or email sending fails
 */
export const login = async (req, res) => {
  try {
    console.log('login hit');

    const { email, password, role } = req.body;

    // Find user in the appropriate collection based on role
    const UserModel = role === 'doctor' ? Doctor : Patient;
    const user = await UserModel.findOne({ email });

    // Return generic error if user not found (security: don't reveal if email exists)
    if (!user) {
      // Log failed login attempt
      await logAuthEvent({
        req,
        action: 'failed_login',
        email,
        success: false,
        failureReason: 'User not found',
        metadata: { role },
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if email is verified (required for login)
    if (!user.isEmailVerified) {
      // Log failed login attempt
      await logAuthEvent({
        req,
        action: 'failed_login',
        email,
        success: false,
        userId: user._id,
        userType: role === 'doctor' ? 'Doctor' : 'Patient',
        failureReason: 'Email not verified',
        metadata: { role },
      });

      return res.status(400).json({
        success: false,
        message: 'Email not verified. Please verify your email first.',
        requiresVerification: true,
      });
    }

    // Check if account is suspended/inactive
    if (!user.isActive) {
      // Fetch admin details who suspended the account
      let adminContact = {
        email: 'support@healthconnect.com',
        name: 'System Administrator'
      };
      
      if (user.suspendedBy) {
        try {
          const admin = await Admin.findById(user.suspendedBy).select('name email');
          if (admin) {
            adminContact = {
              email: admin.email,
              name: admin.name
            };
          }
        } catch (adminError) {
          console.error('Error fetching admin details:', adminError);
          // Use default contact if admin lookup fails
        }
      }

      // Log failed login attempt due to suspension
      await logAuthEvent({
        req,
        action: 'failed_login',
        email,
        success: false,
        userId: user._id,
        userType: role === 'doctor' ? 'Doctor' : 'Patient',
        failureReason: 'Account suspended',
        metadata: {
          role,
          suspensionReason: user.suspensionReason,
        },
      });

      return res.status(403).json({
        success: false,
        message: 'Account suspended',
        suspended: true,
        suspensionReason: user.suspensionReason || 'Your account has been suspended by an administrator. Please contact support for more information.',
        suspendedAt: user.suspendedAt,
        adminContact: adminContact
      });
    }

    // Verify password using the model's comparePassword method
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Log failed login attempt due to invalid password
      await logAuthEvent({
        req,
        action: 'failed_login',
        email,
        success: false,
        userId: user._id,
        userType: role === 'doctor' ? 'Doctor' : 'Patient',
        failureReason: 'Invalid password',
        metadata: { role },
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check OTP rate limiting
    const rateLimitCheck = await OTP.checkRateLimit(email, 'login');
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${rateLimitCheck.waitTime} seconds before requesting a new OTP`,
        waitTime: rateLimitCheck.waitTime,
      });
    }

    // Generate and send OTP
    const otpDoc = await OTP.createOTP(email, role, 'login');

    // Send OTP via email
    await sendOTPEmail({
      email: user.email,
      name: user.name || user.firstName || 'User',
      otp: otpDoc.otp,
      purpose: 'login',
    });

    // Log successful login OTP request
    await logAuthEvent({
      req,
      action: 'login',
      email,
      success: true,
      userId: user._id,
      userType: role === 'doctor' ? 'Doctor' : 'Patient',
      metadata: {
        role,
        otpSent: true,
        requiresOTP: true,
      },
    });

    // Prepare response
    const response = {
      success: true,
      message: 'OTP sent to your email. Please verify to complete login.',
      email: user.email,
      requiresOTP: true,
    };

    // In development mode, include OTP in response for testing
    if (process.env.NODE_ENV === 'development') {
      response.otp = otpDoc.otp;
      response.devNote = 'OTP included for development testing only';
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Login error:', error);

    // Handle specific error cases
    if (error.message.includes('Email service')) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error in login process',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Verify OTP and complete authentication
 *
 * This function verifies the OTP code and completes the authentication process.
 * For registration OTPs, it marks the email as verified and sends a welcome email.
 * For login OTPs, it generates a JWT token to create the session.
 *
 * @async
 * @function verifyOTP
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User's email address
 * @param {string} req.body.otp - 6-digit OTP code
 * @param {string} req.body.role - User role ('doctor' or 'patient')
 * @param {string} req.body.purpose - OTP purpose ('registration' or 'login')
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with authentication token (login) or confirmation (registration)
 * @throws {400} If OTP is invalid, expired, or verification fails
 * @throws {404} If user not found
 * @throws {500} If database operation fails
 */
export const verifyOTP = async (req, res) => {
  try {
    const {
      email, otp, role, purpose,
    } = req.body;

    // Verify the OTP
    const verification = await OTP.verifyOTP(email, otp, purpose);

    if (!verification.success) {
      // Log failed OTP verification
      await logAuthEvent({
        req,
        action: 'failed_otp',
        email,
        success: false,
        failureReason: verification.message,
        metadata: {
          purpose,
          role,
          attemptsRemaining: verification.attemptsRemaining,
        },
      });

      return res.status(400).json({
        success: false,
        message: verification.message,
        attemptsRemaining: verification.attemptsRemaining,
      });
    }

    // Find the user
    const UserModel = role === 'doctor' ? Doctor : Patient;
    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Handle registration OTP verification
    if (purpose === 'registration') {
      // Mark email as verified
      user.isEmailVerified = true;
      user.emailVerifiedAt = new Date();
      await user.save();

      // Send welcome email
      try {
        await sendWelcomeEmail({
          email: user.email,
          name: user.name || user.firstName || 'User',
          role,
        });
      } catch (emailError) {
        console.error('Welcome email error:', emailError);
        // Don't fail the registration if welcome email fails
      }

      // Log successful OTP verification for registration
      await logAuthEvent({
        req,
        action: 'otp_verification',
        email,
        success: true,
        userId: user._id,
        userType: role === 'doctor' ? 'Doctor' : 'Patient',
        metadata: { purpose, emailVerified: true },
      });

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully! You can now login.',
        data: formatUserResponse(user, role),
      });
    }

    // Handle login OTP verification
    if (purpose === 'login') {
      // Store previous login timestamp BEFORE updating
      const previousLoginTime = user.lastLogin;

      // Update lastLogin timestamp
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT token and set as httpOnly cookie (also creates session)
      // This will automatically enforce single device login (FR-1.4)
      await generateToken(user._id, role, res, req);

      // Check if there were previous sessions (for notification)
      const deviceInfo = req.headers['user-agent'] || 'Unknown device';

      // Log successful OTP verification for login
      await logAuthEvent({
        req,
        action: 'otp_verification',
        email,
        success: true,
        userId: user._id,
        userType: role === 'doctor' ? 'Doctor' : 'Patient',
        metadata: {
          purpose,
          loginCompleted: true,
          singleDeviceEnforced: true,
          deviceInfo,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: formatUserResponse(user, role),
        sessionInfo: {
          singleDeviceEnforcement: true,
          message: 'You have been logged in from this device. All other sessions have been terminated for security.',
        },
        loginInfo: {
          previousLogin: previousLoginTime,
          lastLogout: user.lastLogout,
        },
      });
    }

    // Invalid purpose
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP purpose',
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Resend OTP
 *
 * This function generates and sends a new OTP to the user's email.
 * It respects rate limiting to prevent abuse.
 *
 * @async
 * @function resendOTP
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User's email address
 * @param {string} req.body.role - User role ('doctor' or 'patient')
 * @param {string} req.body.purpose - OTP purpose ('registration' or 'login')
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with OTP sent confirmation
 * @throws {404} If user not found
 * @throws {429} If rate limit exceeded
 * @throws {500} If OTP generation or email sending fails
 */
export const resendOTP = async (req, res) => {
  try {
    const { email, role, purpose } = req.body;

    // Find the user to verify they exist
    const UserModel = role === 'doctor' ? Doctor : Patient;
    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check rate limiting
    const rateLimitCheck = await OTP.checkRateLimit(email, purpose);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${rateLimitCheck.waitTime} seconds before requesting a new OTP`,
        waitTime: rateLimitCheck.waitTime,
      });
    }

    // Generate new OTP
    const otpDoc = await OTP.createOTP(email, role, purpose);

    // Send OTP via email
    await sendOTPEmail({
      email: user.email,
      name: user.name || user.firstName || 'User',
      otp: otpDoc.otp,
      purpose,
    });

    // Log OTP resend event
    await logAuthEvent({
      req,
      action: 'otp_resend',
      email,
      success: true,
      userId: user._id,
      userType: role === 'doctor' ? 'Doctor' : 'Patient',
      metadata: { purpose },
    });

    // Prepare response
    const response = {
      success: true,
      message: 'New OTP sent to your email',
      email: user.email,
    };

    // In development mode, include OTP in response
    if (process.env.NODE_ENV === 'development') {
      response.otp = otpDoc.otp;
      response.devNote = 'OTP included for development testing only';
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Resend OTP error:', error);

    if (error.message.includes('Email service')) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error resending OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get current authenticated user information
 *
 * This function retrieves the current user's data from the request object.
 * The user object is populated by the authentication middleware.
 *
 * @async
 * @function getCurrentUser
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object (set by auth middleware)
 * @param {string} req.userRole - User role (set by auth middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with current user data
 * @throws {404} If user not found in request object
 * @throws {500} If operation fails
 */
export const getCurrentUser = async (req, res) => {
  try {
    // User object is populated by the protect middleware
    const { user } = req;

    if (!user) {
      console.log('error');
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Return user data with role information
    res.json({
      success: true,
      data: { ...user.toObject(), role: req.userRole }, // Include role from JWT
    });
  } catch (error) {
    console.log('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message,
    });
  }
};

/**
 * Log out current user
 *
 * This function clears the JWT authentication cookie to log out the user.
 * It sets the cookie value to empty and expires it immediately.
 *
 * @async
 * @function logout
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response confirming successful logout
 * @throws {500} If cookie clearing operation fails
 */
export const logout = async (req, res) => {
  try {
    const { token } = req.cookies;
    const userId = req.user?._id;
    const { userRole } = req;

    // Update lastLogout timestamp for the user
    if (userId && userRole) {
      let UserModel;
      if (userRole === 'doctor') {
        UserModel = Doctor;
      } else if (userRole === 'patient') {
        UserModel = Patient;
      } else {
        UserModel = Admin;
      }
      await UserModel.findByIdAndUpdate(userId, {
        lastLogout: new Date(),
      });
      console.log(`✓ Updated lastLogout for user ${userId}`);
    }

    // Revoke session in database if token exists
    if (token) {
      await Session.updateOne(
        { token, isActive: true },
        { isActive: false },
      );
      console.log('✓ Session revoked on logout');
    }

    // Clear the JWT token cookie by setting it to empty with maxAge 0
    // Must use same options as when cookie was set for proper clearing
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Clear with current environment settings
    res.cookie('token', '', {
      maxAge: 0,
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
    });

    // Also try to clear with opposite secure setting (for cookies set with different env)
    // This handles cases where cookie was set with secure:true but now in development
    res.cookie('token', '', {
      maxAge: 0,
      httpOnly: true,
      sameSite: 'strict',
      secure: !isProduction,
    });

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.log('error in logout', err);
    res.status(500).json({ success: false, message: 'Error during logout' });
  }
};

/**
 * Admin Login
 *
 * Authenticates admin users and generates JWT token
 *
 * @async
 * @function adminLogin
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - Admin email
 * @param {string} req.body.password - Admin password
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with admin data and JWT token
 * @throws {400} If required fields missing
 * @throws {401} If invalid credentials
 * @throws {403} If account suspended
 * @throws {500} If database error
 */
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find admin by email (include password for verification)
    const admin = await Admin.findOne({ email }).select('+password');

    if (!admin) {
      // Log failed admin login attempt
      await logAuthEvent({
        req,
        action: 'failed_admin_login',
        email,
        success: false,
        failureReason: 'Admin not found',
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if admin account is active
    if (!admin.isActive) {
      // Log failed admin login attempt due to suspension
      await logAuthEvent({
        req,
        action: 'failed_admin_login',
        email,
        success: false,
        userId: admin._id,
        userType: 'Admin',
        failureReason: 'Account suspended',
      });

      return res.status(403).json({
        success: false,
        message: 'Account is suspended. Please contact support.',
      });
    }

    // Verify password
    const isPasswordValid = await admin.comparePassword(password);

    if (!isPasswordValid) {
      // Log failed admin login attempt due to invalid password
      await logAuthEvent({
        req,
        action: 'failed_admin_login',
        email,
        success: false,
        userId: admin._id,
        userType: 'Admin',
        failureReason: 'Invalid password',
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Capture previous login time before updating
    const previousLoginTime = admin.lastlogin;

    // Update last login timestamp
    const currentLoginTime = new Date();
    admin.lastlogin = currentLoginTime;
    await admin.save();

    // Log successful admin login
    await logAuthEvent({
      req,
      action: 'admin_login',
      email,
      success: true,
      userId: admin._id,
      userType: 'Admin',
      metadata: {
        role: admin.role,
        permissions: admin.Permissions || [],
      },
    });

    // Generate JWT token with admin role and set cookie (also creates session)
    await generateToken(admin._id, admin.role, res, req);

    // Prepare login info with timestamps (only previous login and last logout)
    const loginInfo = {
      previousLogin: previousLoginTime ? previousLoginTime.toISOString() : undefined,
      lastLogout: admin.lastLogout ? admin.lastLogout.toISOString() : undefined,
    };

    // Prepare admin data for response (exclude password)
    const adminData = {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      permissions: admin.Permissions || [],
      avatar: admin.avatar || '',
      lastLogin: admin.lastlogin,
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: adminData,
      data: adminData,
      loginInfo,
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
    });
  }
};

/**
 * Request password reset - Step 1: Send OTP for password reset
 *
 * This function handles forgot password requests by generating and sending
 * an OTP to the user's email address for verification.
 *
 * @async
 * @function forgotPassword
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User's email address
 * @param {string} req.body.role - User role ('doctor', 'patient', or 'admin')
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response confirming OTP was sent
 * @throws {400} If email not found
 * @throws {500} If OTP generation or email sending fails
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email, role } = req.body;

    // Find user based on role
    let UserModel;
    if (role === 'doctor') {
      UserModel = Doctor;
    } else if (role === 'patient') {
      UserModel = Patient;
    } else {
      UserModel = Admin;
    }
    const user = await UserModel.findOne({ email });

    if (!user) {
      // Log failed password reset request
      await logAuthEvent({
        req,
        action: 'password_reset_request',
        email,
        success: false,
        failureReason: 'User not found',
        metadata: { role },
      });

      // Return generic message for security (don't reveal if email exists)
      return res.status(400).json({
        success: false,
        message: 'If an account exists with this email, a password reset OTP has been sent.',
      });
    }

    // ✅ CHECK: Has user already used password reset? (LIFETIME LIMIT)
    if (user.passwordResetCount && user.passwordResetCount >= 1) {
      // Log failed password reset request
      await logAuthEvent({
        req,
        action: 'password_reset_request',
        email,
        success: false,
        failureReason: 'Password reset limit exceeded (lifetime limit: 1)',
        userId: user._id,
        userType: getUserType(role),
        metadata: {
          role,
          resetCount: user.passwordResetCount,
          lastResetAt: user.passwordResetUsedAt,
        },
      });

      return res.status(403).json({
        success: false,
        message: 'Your 1 attempt for password reset has been completed. You cannot reset your password again. Please contact support if you need assistance.',
        resetLimitReached: true,
        resetCount: user.passwordResetCount,
        lastResetDate: user.passwordResetUsedAt,
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTP for this email and purpose
    await OTP.deleteMany({
      email,
      purpose: 'password-reset',
    });

    // Save OTP to database (expires in 10 minutes)
    const otpDoc = await OTP.create({
      email,
      otp,
      purpose: 'password-reset',
      role,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Send OTP email
    try {
      await sendOTPEmail({
        email: user.email,
        name: user.name || user.firstName || 'User',
        otp,
        purpose: 'Password Reset',
      });

      // Log successful password reset request
      await logAuthEvent({
        req,
        action: 'password_reset_otp_sent',
        email,
        success: true,
        userId: user._id,
        userType: getUserType(role),
        metadata: { role, purpose: 'password-reset' },
      });

      res.status(200).json({
        success: true,
        message: 'Password reset OTP sent to your email. Please check your inbox.',
        email: user.email,
      });
    } catch (emailError) {
      // If email fails, delete OTP from database
      await OTP.deleteOne({ _id: otpDoc._id });

      throw new Error('Failed to send OTP email. Please try again later.');
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error processing password reset request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Reset password - Step 2: Verify OTP and update password
 *
 * This function validates the OTP for password reset and updates the user's password.
 *
 * @async
 * @function resetPassword
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User's email address
 * @param {string} req.body.otp - OTP code from email
 * @param {string} req.body.password - New password
 * @param {string} req.body.confirmPassword - Password confirmation
 * @param {string} req.body.role - User role ('doctor', 'patient', or 'admin')
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response confirming password was reset
 * @throws {400} If OTP is invalid or expired
 * @throws {500} If password update fails
 */
export const resetPassword = async (req, res) => {
  try {
    const {
      email, otp, password, confirmPassword, role,
    } = req.body;

    // Validate passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Find and validate OTP - ensure it hasn't been used already
    const otpDoc = await OTP.findOne({
      email,
      otp,
      purpose: 'password-reset',
      verified: false, // Only find OTPs that haven't been used yet
    });

    if (!otpDoc) {
      // Log failed password reset attempt
      await logAuthEvent({
        req,
        action: 'password_reset_failed',
        email,
        success: false,
        failureReason: 'Invalid or already used OTP',
        metadata: { role },
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid, expired, or already used OTP. Please request a new password reset.',
      });
    }

    // Check if OTP is expired
    if (new Date() > otpDoc.expiresAt) {
      await OTP.deleteOne({ _id: otpDoc._id });

      await logAuthEvent({
        req,
        action: 'password_reset_failed',
        email,
        success: false,
        failureReason: 'OTP expired',
        metadata: { role },
      });

      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new password reset.',
      });
    }

    // Find user based on role
    const UserModel = getUserModel(role);
    const user = await UserModel.findOne({ email });

    if (!user) {
      await OTP.deleteOne({ _id: otpDoc._id });

      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    // Mark OTP as verified BEFORE changing password (prevents reuse even if password change fails)
    await otpDoc.markAsVerified();

    // Update password (will be hashed by pre-save middleware)
    user.password = password;
    user.passwordChangedAt = Date.now(); // Record password change time

    // ✅ INCREMENT PASSWORD RESET COUNTER (LIFETIME TRACKING)
    user.passwordResetCount = (user.passwordResetCount || 0) + 1;
    user.passwordResetUsedAt = new Date();

    // Clear any reset tokens if they exist
    if (user.passwordResetToken) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
    }

    await user.save();

    // Delete used OTP after successful password reset
    await OTP.deleteOne({ _id: otpDoc._id });

    // Send confirmation email
    try {
      await sendPasswordChangedEmail({
        email: user.email,
        name: user.name || user.firstName || 'User',
      });
    } catch (emailError) {
      console.error('Password changed email error:', emailError);
      // Don't fail the reset if email fails
    }

    // Log successful password reset
    await logAuthEvent({
      req,
      action: 'password_reset_success',
      email: user.email,
      success: true,
      userId: user._id,
      userType: getUserType(role),
      metadata: { role },
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successful! You can now login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Change password (authenticated user)
 *
 * This function allows authenticated users to change their password.
 * Requires current password verification.
 *
 * @async
 * @function changePassword
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user (from protect middleware)
 * @param {string} req.userRole - User role (from protect middleware)
 * @param {Object} req.body - Request body
 * @param {string} req.body.currentPassword - Current password for verification
 * @param {string} req.body.newPassword - New password
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response confirming password was changed
 * @throws {400} If current password is incorrect
 * @throws {401} If user not authenticated
 * @throws {500} If password update fails
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;
    const role = req.userRole;

    // Find user with password field included
    const UserModel = getUserModel(role);
    const user = await UserModel.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      // Log failed password change attempt
      await logAuthEvent({
        req,
        action: 'password_change',
        email: user.email,
        success: false,
        userId: user._id,
        userType: getUserType(role),
        failureReason: 'Current password incorrect',
        metadata: { role },
      });

      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Check if new password is same as current
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
      });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    // Send confirmation email
    try {
      await sendPasswordChangedEmail({
        email: user.email,
        name: user.name || user.firstName || 'User',
      });
    } catch (emailError) {
      console.error('Password changed email error:', emailError);
      // Don't fail if email fails
    }

    // Log successful password change
    await logAuthEvent({
      req,
      action: 'password_change',
      email: user.email,
      success: true,
      userId: user._id,
      userType: getUserType(role),
      metadata: { role },
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
