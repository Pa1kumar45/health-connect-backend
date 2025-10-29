/**
 * OTP (One-Time Password) Model
 *
 * This model stores OTP codes for email verification during:
 * - User registration (email verification)
 * - User login (two-factor authentication)
 * - Password reset (future implementation)
 *
 * Features:
 * - 6-digit numeric OTP
 * - 10-minute expiration
 * - Automatic cleanup of expired OTPs
 * - Rate limiting (prevent OTP spam)
 *
 * @module OTP
 */

import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  /**
   * Email address associated with this OTP
   * @type {String}
   * @required
   */
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    index: true, // Index for faster lookups
  },

  /**
   * 6-digit OTP code
   * @type {String}
   * @required
   */
  otp: {
    type: String,
    required: [true, 'OTP is required'],
    length: 6,
  },

  /**
   * User role (doctor/patient) for context
   * @type {String}
   * @enum ['doctor', 'patient']
   */
  role: {
    type: String,
    enum: ['doctor', 'patient'],
    required: true,
  },

  /**
   * Purpose of OTP
   * @type {String}
   * @enum ['registration', 'login', 'password-reset']
   */
  purpose: {
    type: String,
    enum: ['registration', 'login', 'password-reset'],
    required: true,
    default: 'login',
  },

  /**
   * Whether this OTP has been verified
   * @type {Boolean}
   * @default false
   */
  verified: {
    type: Boolean,
    default: false,
  },

  /**
   * Number of verification attempts
   * @type {Number}
   * @default 0
   */
  attempts: {
    type: Number,
    default: 0,
    max: 3, // Maximum 3 attempts
  },

  /**
   * OTP expiration time (10 minutes from creation)
   * @type {Date}
   */
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

/**
 * Index for compound queries (find OTP by email and purpose)
 */
otpSchema.index({ email: 1, purpose: 1 });

/**
 * Index for automatic cleanup of expired OTPs
 * MongoDB will automatically delete documents after expiresAt time
 */
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Check if OTP is expired
 * @returns {Boolean} True if expired
 */
otpSchema.methods.isExpired = function () {
  return Date.now() > this.expiresAt.getTime();
};

/**
 * Check if OTP can still be attempted
 * @returns {Boolean} True if attempts remaining
 */
otpSchema.methods.canAttempt = function () {
  return this.attempts < 3;
};

/**
 * Increment attempt counter
 */
otpSchema.methods.incrementAttempts = async function () {
  this.attempts += 1;
  await this.save();
};

/**
 * Mark OTP as verified
 */
otpSchema.methods.markAsVerified = async function () {
  this.verified = true;
  await this.save();
};

/**
 * Static method: Generate a random 6-digit OTP
 * @returns {String} 6-digit OTP
 */
otpSchema.statics.generateOTP = function () {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Static method: Create and save a new OTP
 * @param {String} email - User email
 * @param {String} role - User role (doctor/patient)
 * @param {String} purpose - OTP purpose (registration/login/password-reset)
 * @returns {Object} { otp: String, otpDoc: Document }
 */
otpSchema.statics.createOTP = async function (email, role, purpose = 'login') {
  // Delete any existing unverified OTPs for this email and purpose
  await this.deleteMany({
    email,
    purpose,
    verified: false,
  });

  // Generate new OTP
  const otp = this.generateOTP();

  // Create OTP document
  const otpDoc = await this.create({
    email,
    role,
    otp,
    purpose,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });

  return { otp, otpDoc };
};

/**
 * Static method: Verify OTP
 * @param {String} email - User email
 * @param {String} otp - OTP to verify
 * @param {String} purpose - OTP purpose
 * @returns {Object} { success: Boolean, message: String, otpDoc: Document }
 */
otpSchema.statics.verifyOTP = async function (email, otp, purpose = 'login') {
  // Find the most recent OTP for this email and purpose
  const otpDoc = await this.findOne({
    email,
    purpose,
    verified: false,
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    return {
      success: false,
      message: 'OTP not found or already verified. Please request a new OTP.',
    };
  }

  // Check if OTP is expired
  if (otpDoc.isExpired()) {
    await otpDoc.deleteOne();
    return {
      success: false,
      message: 'OTP has expired. Please request a new OTP.',
    };
  }

  // Check if max attempts reached
  if (!otpDoc.canAttempt()) {
    await otpDoc.deleteOne();
    return {
      success: false,
      message: 'Maximum verification attempts exceeded. Please request a new OTP.',
    };
  }

  // Verify OTP
  if (otpDoc.otp !== otp) {
    await otpDoc.incrementAttempts();
    const attemptsLeft = 3 - otpDoc.attempts;
    return {
      success: false,
      message: `Invalid OTP. ${attemptsLeft} attempt(s) remaining.`,
    };
  }

  // OTP is valid - mark as verified
  await otpDoc.markAsVerified();

  return {
    success: true,
    message: 'OTP verified successfully',
    otpDoc,
  };
};

/**
 * Static method: Check rate limiting (prevent OTP spam)
 * @param {String} email - User email
 * @param {String} purpose - OTP purpose
 * @returns {Object} { allowed: Boolean, message: String, waitTime: Number }
 */
otpSchema.statics.checkRateLimit = async function (email, purpose) {
  // Find the most recent OTP for this email
  const recentOTP = await this.findOne({
    email,
    purpose,
  }).sort({ createdAt: -1 });

  if (!recentOTP) {
    return { allowed: true };
  }

  // Check if less than 1 minute since last OTP
  const timeSinceLastOTP = Date.now() - recentOTP.createdAt.getTime();
  const oneMinute = 60 * 1000;

  if (timeSinceLastOTP < oneMinute) {
    const waitTime = Math.ceil((oneMinute - timeSinceLastOTP) / 1000);
    return {
      allowed: false,
      message: `Please wait ${waitTime} seconds before requesting a new OTP.`,
      waitTime,
    };
  }

  return { allowed: true };
};

const OTP = mongoose.model('OTP', otpSchema);

export default OTP;
