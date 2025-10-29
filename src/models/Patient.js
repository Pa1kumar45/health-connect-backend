/**
 * Patient Model
 *
 * This module defines the MongoDB schema for patient entities in the healthcare system.
 * It includes:
 * - Patient personal information (name, email, demographics)
 * - Authentication (password hashing and comparison)
 * - Medical information (allergies, blood group, emergency contacts)
 * - Profile completion tracking
 *
 * @module Patient
 * @requires mongoose - MongoDB object modeling library
 * @requires bcrypt - Password hashing library
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * Emergency Contact Sub-schema
 *
 * Defines the structure for patient emergency contact information.
 * Each patient can have multiple emergency contacts.
 */
const EmergencyContactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true, // Emergency contact's full name
  },
  relationship: {
    type: String,
    required: true,
    trim: true, // Relationship to patient (e.g., "spouse", "parent", "sibling")
  },
  phone: {
    type: String,
    required: true,
    trim: true, // Emergency contact's phone number
  },
});
/**
 * Patient Schema Definition
 *
 * Defines the structure and validation rules for patient documents in MongoDB.
 * Includes personal information, medical history, and authentication.
 */
const patientSchema = new mongoose.Schema({
  // Basic identification and authentication
  name: {
    type: String,
    required: true,
    trim: true, // Patient's full name
  },
  email: {
    type: String,
    required: true,
    unique: true, // Ensures no duplicate emails across the system
    lowercase: true, // Normalize email to lowercase
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 1, // Minimum password length for security
  },

  // Personal demographic information
  dateOfBirth: {
    type: String,
    required: false, // Optional field, can be added during profile completion
  },
  gender: {
    type: String,
    enum: ['male', 'female', ''], // Allowed values, empty string for "prefer not to say"
    required: false,
  },

  // Medical information
  allergies: {
    type: String,
    required: false, // Medical allergies (free text field)
    trim: true,
  },

  // Contact information
  contactNumber: {
    type: String,
    required: false, // Optional phone number
    trim: true,
  },
  emergencyContact: {
    type: [EmergencyContactSchema], // Array of emergency contacts
    required: false,
    default: [], // Initialize as empty array
  },

  // Medical details
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''], // Standard blood types
    required: false,
  },
  // Profile management
  profileCompleted: {
    type: Boolean,
    default: false, // Tracks whether patient has completed their profile
  },
  avatar: {
    type: String,
    required: false, // Cloudinary URL for profile picture
  },

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
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  verifiedAt: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  suspensionReason: {
    type: String,
  },
  suspendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
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
 * This middleware automatically hashes the patient's password before saving to database.
 * Uses bcrypt with 12 salt rounds for secure password storage.
 * Only runs when password field is modified to avoid unnecessary re-hashing.
 *
 * @async
 * @function
 * @param {Function} next - Mongoose middleware next function
 */
patientSchema.pre('save', async function (next) {
  // Skip hashing if password hasn't been modified
  if (!this.isModified('password')) return next();

  // Hash password with 12 salt rounds
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/**
 * Instance method to verify password against stored hash
 *
 * This method compares a plain text password with the stored hashed password.
 * Used during patient authentication to verify login credentials.
 *
 * @async
 * @function comparePassword
 * @param {string} candidatePassword - Plain text password to verify
 * @returns {Promise<boolean>} True if password matches, false otherwise
 */
patientSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Patient Model
 *
 * Creates and exports the Patient model from the schema.
 * Model name follows MongoDB convention: singular and capitalized.
 *
 * @type {mongoose.Model<Patient>}
 */
export const Patient = mongoose.model('Patient', patientSchema);

// Default export for convenience
export default Patient;
