
/**
 * AdminActionLog Model
 *
 * Mongoose schema for admin action logs.
 * Tracks all administrative actions for audit and compliance.
 *
 * @module models/AdminActionLog
 */
import mongoose from 'mongoose';

/**
 * AdminActionLog Schema
 * @typedef {Object} AdminActionLog
 * @property {ObjectId} adminId - Reference to admin who performed action
 * @property {String} actionType - Type of action (user_verification, suspension, etc.)
 * @property {ObjectId} targetUserId - ID of affected user
 * @property {String} targetUserType - Type of affected user ('Doctor', 'Patient', 'Admin')
 * @property {Object} previousData - Data before change
 * @property {Object} newData - Data after change
 * @property {String} reason - Reason for action
 * @property {String} ipAddress - IP address of admin
 * @property {String} userAgent - Browser/device info
 */
const adiminActionLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
  },
  actionType: {
    type: String,
    required: true,
    enum: [
      'user_verification',
      'user_suspension',
      'user_activation',
      'role_change',
      'account_deletion',
      'password_reset',
      'profile_update',
    ],
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  targetUserType: {
    type: String,
    required: true,
    enum: ['Doctor', 'Patient', 'Admin'],
  },
  previousData: {
    type: mongoose.Schema.Types.Mixed,
  },
  newData: {
    type: mongoose.Schema.Types.Mixed,
  },
  reason: {
    type: String,
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
}, {
  timestamps: true,
});

adiminActionLogSchema.index({ adminId: 1, createdAt: -1 });
adiminActionLogSchema.index({ targetUserId: 1, createdAt: -1 });


/**
 * AdminActionLog Mongoose Model
 */
export default mongoose.model('AdminActionLog', adiminActionLogSchema);
