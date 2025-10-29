
/**
 * Admin Model
 *
 * Mongoose schema for system administrators.
 * Handles authentication, password management, and admin role/permissions.
 *
 * @module models/Admin
 */
import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

/**
 * Admin Schema
 * @typedef {Object} Admin
 * @property {String} name - Admin's full name
 * @property {String} email - Unique email address
 * @property {String} password - Hashed password
 * @property {String} passwordResetToken - Hashed reset token for password recovery
 * @property {Date} passwordResetExpires - Expiration time for reset token
 * @property {Date} passwordChangedAt - Last password change timestamp
 * @property {Number} passwordResetCount - Number of times password has been reset
 * @property {Date} passwordResetUsedAt - When password reset was used
 * @property {String} role - 'admin' or 'super_admin'
 * @property {Boolean} isActive - Account active status
 * @property {String[]} Permissions - Array of admin permissions
 * @property {Date} lastlogin - Last login timestamp
 * @property {Date} lastLogout - Last logout timestamp
 * @property {ObjectId} createdBy - Reference to creator admin
 */
const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
  },
  // Password reset functionality
  role: {
    type: String,
    default: 'admin',
    enum: ['admin', 'super_admin'],
  },
  isActive: {
    type: Boolean,
    default: true,
  },

  lastlogin: {
    type: Date,
  },
  lastLogout: {
    type: Date,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
}, {
  timestamps: true,
});


/**
 * Hash password before saving admin document
 */
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcryptjs.hash(this.password, 12);
});


/**
 * Compare candidate password with stored hash
 * @param {String} candidatepassword - Password to compare
 * @returns {Promise<Boolean>} True if match
 */
adminSchema.methods.comparePassword = async function (candidatepassword) {
  return bcryptjs.compare(candidatepassword, this.password);
};


/**
 * Admin Mongoose Model
 */
export default mongoose.model('Admin', adminSchema);
