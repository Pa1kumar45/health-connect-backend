
/**
 * AuthLog Model
 *
 * Mongoose schema for authentication logs and events.
 * Tracks login, logout, failed attempts, and other auth actions for security monitoring.
 *
 * @module models/AuthLog
 */
import mongoose from 'mongoose';

/**
 * AuthLog Schema
 * @typedef {Object} AuthLog
 * @property {ObjectId} userId - Reference to user (Doctor, Patient, Admin)
 * @property {String} userType - Type of user ('Doctor', 'Patient', 'Admin')
 * @property {String} email - Email used for authentication
 * @property {String} action - Auth action type (login, logout, failed_login, etc.)
 * @property {String} ipAddress - IP address of request
 * @property {String} userAgent - Browser/device info
 * @property {Boolean} success - Whether action succeeded
 * @property {String} failureReason - Reason for failure
 * @property {Object} metadata - Additional event metadata
 */
const authLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'userType',
    default: null, // Null for failed login attempts where user doesn't exist
  },
  userType: {
    type: String,
    enum: ['Doctor', 'Patient', 'Admin'],
    default: null,
  },
  email: {
    type: String,
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'register',
      'failed_login',
      'otp_verification',
      'failed_otp',
      'otp_resend',
      'password_reset_request',
      'password_reset_success',
      'password_reset_failed',
      'password_change',
      'admin_login',
      'failed_admin_login',
    ],
    index: true,
  },
  // ipAddress: {
  //   type: String,
  //   required: true,
  // },
  // userAgent: {
  //   type: String,
  //   required: true,
  // },
  success: {
    type: Boolean,
    required: true,
    default: true,
    index: true,
  },
  failureReason: {
    type: String,
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
authLogSchema.index({ userId: 1, createdAt: -1 });
authLogSchema.index({ email: 1, createdAt: -1 });
authLogSchema.index({ action: 1, createdAt: -1 });
authLogSchema.index({ success: 1, createdAt: -1 });
authLogSchema.index({ createdAt: -1 });


/**
 * Log authentication event
 * @param {Object} eventData - Event data to log
 * @returns {Promise<AuthLog|null>} Saved log or null on error
 */
authLogSchema.statics.logEvent = async function (eventData) {
  try {
    const log = new this(eventData);
    await log.save();
    return log;
  } catch (error) {
    console.error('Error logging auth event:', error);
    // Don't throw error - logging should not break authentication flow
    return null;
  }
};

/**
 * Get logs with pagination
 * @param {Object} filters - Query filters
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Logs and pagination info
 */
authLogSchema.statics.getLogs = async function (filters = {}, options = {}) {
  const {
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = -1,
  } = options;

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    this.find(filters)
      .populate('userId', 'name email')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(filters),
  ]);

  return {
    logs,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get logs for a specific user
 * @param {ObjectId} userId - User ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Logs and pagination info
 */
authLogSchema.statics.getUserLogs = async function (userId, options = {}) {
  return this.getLogs({ userId }, options);
};

/**
 * Get logs by email (for failed login attempts)
 * @param {String} email - Email address
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Logs and pagination info
 */
authLogSchema.statics.getLogsByEmail = async function (email, options = {}) {
  return this.getLogs({ email }, options);
};

/**
 * Get failed login attempts for an email
 * @param {String} email - Email address
 * @param {Number} timeWindow - Minutes to look back
 * @returns {Promise<AuthLog[]>} Array of failed attempts
 */
authLogSchema.statics.getFailedAttempts = async function (email, timeWindow = 15) {
  const cutoffTime = new Date(Date.now() - timeWindow * 60 * 1000);

  return this.find({
    email,
    action: { $in: ['failed_login', 'failed_admin_login', 'failed_otp'] },
    success: false,
    createdAt: { $gte: cutoffTime },
  }).sort({ createdAt: -1 });
};

/**
 * Get authentication statistics
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object[]>} Array of stats by action
 */
authLogSchema.statics.getStats = async function (startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        successCount: {
          $sum: { $cond: ['$success', 1, 0] },
        },
        failureCount: {
          $sum: { $cond: ['$success', 0, 1] },
        },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);

  return stats;
};


/**
 * AuthLog Mongoose Model
 */
const AuthLog = mongoose.model('AuthLog', authLogSchema);

export default AuthLog;
