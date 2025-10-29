/**
 * Doctor Model
 *
 * This module defines the MongoDB schema for doctor entities in the healthcare system.
 * It includes:
 * - Doctor profile information (name, email, specialization, etc.)
 * - Authentication (password hashing and comparison)
 * - Professional details (experience, qualifications, schedule)
 * - Pre-save middleware for password security
 *
 * @module Doctor
 * @requires mongoose - MongoDB object modeling library
 * @requires bcrypt - Password hashing library
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * Doctor Schema Definition
 *
 * Defines the structure and validation rules for doctor documents in MongoDB.
 * Includes professional information, authentication, and availability scheduling.
 */
const doctorSchema = new mongoose.Schema({
  // Basic identification fields
  name: {
    type: String,
    required: true,
    trim: true, // Remove whitespace
  },
  email: {
    type: String,
    required: true,
    unique: true, // Ensures no duplicate emails
    lowercase: true, // Convert to lowercase for consistency
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 1, // Minimum password length
  },

  // Professional information
  specialization: {
    type: String,
    required: true,
    trim: true, // Medical specialization (e.g., "Cardiology", "Neurology")
  },
  experience: {
    type: Number,
    required: true,
    min: 0, // Years of experience (non-negative)
  },
  qualification: {
    type: String,
    required: true,
    trim: true, // Educational qualifications (e.g., "MBBS, MD")
  },

  // Optional profile fields
  about: {
    type: String,
    trim: true, // Professional bio or description
  },
  contactNumber: {
    type: String,
    trim: true, // Phone number for contact
  },
  avatar: {
    type: String, // Cloudinary URL for profile picture
  },

  // Doctor availability schedule
  schedule: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    slots: [{ // Available time slots for each day (fixed 15-min slots from 9 AM to 9 PM)
      slotNumber: {
        type: Number,
        required: true,
        min: 1,
        max: 48, // 48 slots total (12 hours * 4 slots per hour)
      },
      startTime: {
        type: String,
        required: true,
      }, // Format: "09:00", "09:15", "09:30", etc. (24-hour format)
      endTime: {
        type: String,
        required: true,
      }, // Format: "09:15", "09:30", "09:45", etc. (always 15 minutes after start)
      isAvailable: {
        type: Boolean,
        default: true,
      }, // Doctor's preference - whether they want to work this slot
    }],
  }],
  // Email verification for OTP authentication
  isEmailVerified: {
    type: Boolean,
    default: false, // Set to true after OTP verification
  },
  emailVerifiedAt: {
    type: Date, // Timestamp of email verification
  },

  // Password reset functionality
  passwordResetToken: {
    type: String, // Hashed reset token for password recovery
  },
  passwordResetExpires: {
    type: Date, // Expiration time for reset token (1 hour)
  },
  passwordChangedAt: {
    type: Date, // Timestamp of last password change
  },
  passwordResetCount: {
    type: Number,
    default: 0, // Track number of times password has been reset via forgot password
  },
  passwordResetUsedAt: {
    type: Date, // Timestamp when password reset was used
  },

  // Admin verification status (separate from email verification)
  verificationStatus: {
    type: String,
    enum: ['pending', ' verified', 'rejected', 'under_review'],
    default: 'pending',
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  verifiedAt: {
    type: Date,
  },
  suspensionReason: {
    type: String,
  },
  suspendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  suspendedAt: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: {
    type: Date,
  },
  lastLogout: {
    type: Date,
  },
}, {
  timestamps: true, // Automatically add createdAt and updatedAt fields
});

/**
 * Pre-save middleware for password hashing
 *
 * This middleware automatically hashes the doctor's password before saving to database.
 * It only runs when the password field has been modified to avoid unnecessary hashing.
 * Uses bcrypt with salt rounds of 14 for strong security.
 *
 * @async
 * @function
 * @param {Function} next - Mongoose middleware next function
 */
doctorSchema.pre('save', async function (next) {
  // Only hash password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  // Generate salt with 14 rounds for strong security
  const salt = await bcrypt.genSalt(14);

  // Hash password with the generated salt
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * Instance method to verify password against stored hash
 *
 * This method compares a plain text password with the stored hashed password.
 * Used during authentication to verify login credentials.
 *
 * @async
 * @function comparePassword
 * @param {string} candidatePassword - Plain text password to verify
 * @returns {Promise<boolean>} True if password matches, false otherwise
 */
doctorSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Doctor Model
 *
 * Creates and exports the Doctor model from the schema.
 * Model name follows MongoDB convention: singular and capitalized.
 *
 * @type {mongoose.Model<Doctor>}
 */
export const Doctor = mongoose.model('Doctor', doctorSchema);

// Default export for convenience
export default Doctor;
