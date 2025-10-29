// backend/src/controllers/adminController.js
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import AdminActionLog from '../models/AdminActionLog.js';
import { Appointment } from '../models/Appointment.js';
import AuthLog from '../models/AuthLog.js';

/**
 * Get dashboard statistics
 *
 * Returns user, appointment, and recent activity stats for admin dashboard.
 *
 * @route GET /api/admin/dashboard/stats
 * @access Admin only
 * @returns {Object} Dashboard statistics
 */
const getDashboardStats = async (req, res) => {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Get user counts
    const [
      totalDoctors,
      totalPatients,
      pendingDoctors,
      pendingPatients,
      suspendedDoctors,
      suspendedPatients,
      todaysAppointments,
      totalAppointments,
    ] = await Promise.all([
      Doctor.countDocuments({ isActive: true }),
      Patient.countDocuments({ isActive: true }),
      Doctor.countDocuments({ verificationStatus: 'pending' }),
      Patient.countDocuments({ verificationStatus: 'pending' }),
      Doctor.countDocuments({ isActive: false }),
      Patient.countDocuments({ isActive: false }),
      Appointment.countDocuments({ date: today }),
      Appointment.countDocuments(),
    ]);

    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRegistrations = await Promise.all([
      Doctor.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Patient.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    res.json({
      success: true,
      data: {
        users: {
          totalDoctors,
          totalPatients,
          pendingVerification: pendingDoctors + pendingPatients,
          suspended: suspendedDoctors + suspendedPatients,
        },
        appointments: {
          today: todaysAppointments,
          total: totalAppointments,
        },
        recentActivity: {
          newDoctors: recentRegistrations[0],
          newPatients: recentRegistrations[1],
        },
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
    });
  }
};

/**
 * Get all users with filtering and pagination
 *
 * Returns paginated list of users (doctors, patients) with filters for role, status, verification, and search.
 *
 * @route GET /api/admin/users
 * @access Admin only
 * @returns {Object[]} Array of user objects
 */
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      status,
      verificationStatus,
      search,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const users = [];
    let totalUsers = 0;

    // Build query filter
    const buildFilter = () => {
      const filter = {};

      if (status) {
        filter.isActive = status === 'active';
      }

      if (verificationStatus) {
        filter.verificationStatus = verificationStatus;
      }

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { contactNumber: { $regex: search, $options: 'i' } },
        ];
      }

      return filter;
    };

    // Get users based on role filter
    if (!role || role === 'doctor') {
      const filter = buildFilter();
      const doctors = await Doctor.find(filter)
        .select('name email contactNumber specialization verificationStatus isActive createdAt')
        .skip(skip)
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .lean();

      users.push(...doctors.map((doc) => ({
        ...doc,
        userType: 'doctor',
        fullName: doc.name,
      })));

      if (!role) {
        totalUsers += await Doctor.countDocuments(filter);
      } else {
        totalUsers = await Doctor.countDocuments(filter);
      }
    }

    if (!role || role === 'patient') {
      const filter = buildFilter();
      const patients = await Patient.find(filter)
        .select('name email contactNumber verificationStatus isActive createdAt')
        .skip(skip)
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .lean();

      users.push(...patients.map((pat) => ({
        ...pat,
        userType: 'patient',
        fullName: pat.name,
      })));

      if (!role) {
        totalUsers += await Patient.countDocuments(filter);
      } else {
        totalUsers = await Patient.countDocuments(filter);
      }
    }

    const totalPages = Math.ceil(totalUsers / limitNum);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalUsers,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
    });
  }
};

/**
 * Verify/Update user status
 *
 * Updates verification status for a user (doctor/patient).
 *
 * @route PUT /api/admin/users/:id/verify
 * @access Admin only
 * @returns {Object} Updated user object
 */
const verifyUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, reason, userType } = req.body;
    const adminId = req.user._id;

    // Determine the model based on userType
    const Model = userType === 'doctor' ? Doctor : Patient;

    // Get current user data for logging
    const currentUser = await Model.findById(id);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Store previous data for audit log
    const previousData = {
      verificationStatus: currentUser.verificationStatus,
      isActive: currentUser.isActive,
    };

    // Update user
    const updatedUser = await Model.findByIdAndUpdate(
      id,
      {
        verificationStatus,
        verifiedBy: adminId,
        verifiedAt: new Date(),
        ...(verificationStatus === 'rejected' && { isActive: false }),
      },
      { new: true },
    );

    // Log admin action
    await AdminActionLog.create({
      adminId,
      actionType: 'user_verification',
      targetUserId: id,
      targetUserType: userType === 'doctor' ? 'Doctor' : 'Patient',
      previousData,
      newData: {
        verificationStatus: updatedUser.verificationStatus,
        isActive: updatedUser.isActive,
      },
      reason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // TODO: Send notification email to user
    // await sendVerificationEmail(updatedUser, verificationStatus);

    res.json({
      success: true,
      message: `User ${verificationStatus} successfully`,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user verification status',
    });
  }
};

/**
 * Cancel future appointments for suspended user
 *
 * Cancels all pending/confirmed future appointments for a suspended doctor or patient.
 *
 * @param {String} userId - User ID
 * @param {String} userType - 'doctor' or 'patient'
 * @returns {Promise<void>}
 */
const cancelFutureAppointments = async (userId, userType) => {
  const query = userType === 'doctor' ? { doctorId: userId } : { patientId: userId };

  await Appointment.updateMany(
    {
      ...query,
      date: { $gte: new Date() },
      status: { $in: ['pending', 'confirmed'] },
    },
    {
      status: 'cancelled',
      cancellationReason: `Account ${userType === 'doctor' ? 'doctor' : 'patient'} suspended by admin`,
      cancelledAt: new Date(),
    },
  );
};

/**
 * Suspend/Activate user account
 *
 * Toggles active status for a user (doctor/patient), suspending or reactivating account.
 *
 * @route PUT /api/admin/users/:id/toggle-status
 * @access Admin only
 * @returns {Object} Updated user object
 */
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason, userType } = req.body; // action: 'suspend' | 'activate'
    const adminId = req.user._id;

    const Model = userType === 'doctor' ? Doctor : Patient;

    const currentUser = await Model.findById(id);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isActive = action === 'activate';
    const updateData = {
      isActive,
      ...(action === 'suspend' && {
        suspensionReason: reason,
        suspendedBy: adminId,
        suspendedAt: new Date(),
      }),
    };

    const updatedUser = await Model.findByIdAndUpdate(id, updateData, { new: true });

    // If suspending a doctor, cancel their future appointments
    if (action === 'suspend' && userType === 'doctor') {
      await cancelFutureAppointments(id, 'doctor');
    }

    // Log admin action
    await AdminActionLog.create({
      adminId,
      actionType: action === 'suspend' ? 'user_suspension' : 'user_activation',
      targetUserId: id,
      targetUserType: userType === 'doctor' ? 'Doctor' : 'Patient',
      previousData: { isActive: currentUser.isActive },
      newData: { isActive },
      reason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: `User ${action}d successfully`,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
    });
  }
};

/**
 * Update user role (for role management)
 *
 * Changes role for a user (doctor, patient, admin) by super admin.
 *
 * @route PUT /api/admin/users/:id/role
 * @access Super Admin only
 * @returns {Object} Updated user object
 */
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { newRole, userType } = req.body;
    const adminId = req.user._id;

    // Only super admin can change roles
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can change user roles',
      });
    }

    const Model = userType === 'doctor' ? Doctor : Patient;
    const currentUser = await Model.findById(id);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // For now, we're managing role within the same collection
    // In future, you might want to implement role migration between collections

    // Log the action
    await AdminActionLog.create({
      adminId,
      actionType: 'role_change',
      targetUserId: id,
      targetUserType: userType === 'doctor' ? 'Doctor' : 'Patient',
      previousData: { userType },
      newData: { userType: newRole },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Role update logged (feature in development)',
      data: currentUser,
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user role',
    });
  }
};

/**
 * Get admin action logs
 *
 * Returns logs of all admin actions for audit and compliance.
 *
 * @route GET /api/admin/logs
 * @access Admin only
 * @returns {Object[]} Array of admin action logs
 */
const getAdminLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      actionType,
      targetUserId,
      adminId,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (actionType) query.actionType = actionType;
    if (targetUserId) query.targetUserId = targetUserId;
    if (adminId) query.adminId = adminId;

    const [logs, total] = await Promise.all([
      AdminActionLog.find(query)
        .populate('adminId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      AdminActionLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get admin logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin logs',
    });
  }
};

/**
 * Get authentication logs
 *
 * Returns all authentication logs with filtering and pagination.
 *
 * @route GET /api/admin/auth-logs
 * @access Admin only
 * @returns {Object[]} Array of authentication logs
 */
const getAuthLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      success,
      email,
      userId,
      userType,
      startDate,
      endDate,
    } = req.query;

    // Build filter query
    const filters = {};

    if (action) filters.action = action;
    if (success !== undefined) filters.success = success === 'true';
    if (email) filters.email = { $regex: email, $options: 'i' }; // Case-insensitive search
    if (userId) filters.userId = userId;
    if (userType) filters.userType = userType;

    // Date range filter
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    // Pagination options
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy: 'createdAt',
      sortOrder: -1, // Most recent first
    };

    // Get logs using the model's static method
    const result = await AuthLog.getLogs(filters, options);

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
      filters: {
        action,
        success,
        email,
        userId,
        userType,
        startDate,
        endDate,
      },
    });
  } catch (error) {
    console.error('Get auth logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching authentication logs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get authentication logs for a specific user
 *
 * Returns all authentication logs for a specific user.
 *
 * @route GET /api/admin/auth-logs/user/:userId
 * @access Admin only
 * @returns {Object[]} Array of authentication logs
 */
const getUserAuthLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy: 'createdAt',
      sortOrder: -1,
    };

    // Get user-specific logs
    const result = await AuthLog.getUserLogs(userId, options);

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
      userId,
    });
  } catch (error) {
    console.error('Get user auth logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user authentication logs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get authentication logs by email
 *
 * Returns all authentication logs for a specific email (useful for failed login attempts).
 *
 * @route GET /api/admin/auth-logs/email/:email
 * @access Admin only
 * @returns {Object[]} Array of authentication logs
 */
const getAuthLogsByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy: 'createdAt',
      sortOrder: -1,
    };

    // Get email-specific logs
    const result = await AuthLog.getLogsByEmail(email, options);

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
      email,
    });
  } catch (error) {
    console.error('Get auth logs by email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching authentication logs by email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get authentication statistics
 *
 * Returns authentication statistics and analytics for security monitoring.
 *
 * @route GET /api/admin/auth-logs/stats
 * @access Admin only
 * @returns {Object} Authentication statistics
 */
const getAuthStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Get statistics
    const stats = await AuthLog.getStats(startDate, endDate);

    // Get total counts
    const filters = {};
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    const [totalLogs, successfulLogs, failedLogs] = await Promise.all([
      AuthLog.countDocuments(filters),
      AuthLog.countDocuments({ ...filters, success: true }),
      AuthLog.countDocuments({ ...filters, success: false }),
    ]);

    // Get top failure reasons
    const failureReasons = await AuthLog.aggregate([
      {
        $match: {
          ...filters,
          success: false,
          failureReason: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$failureReason',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          total: totalLogs,
          successful: successfulLogs,
          failed: failedLogs,
          successRate: totalLogs > 0 ? ((successfulLogs / totalLogs) * 100).toFixed(2) : 0,
        },
        actionStats: stats,
        topFailureReasons: failureReasons,
        dateRange: {
          startDate: startDate || 'all time',
          endDate: endDate || 'present',
        },
      },
    });
  } catch (error) {
    console.error('Get auth stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching authentication statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get failed login attempts for security monitoring
 *
 * Returns recent failed login attempts for security monitoring.
 *
 * @route GET /api/admin/auth-logs/failed-attempts
 * @access Admin only
 * @returns {Object[]} Array of failed login attempts
 */
const getFailedLoginAttempts = async (req, res) => {
  try {
    const { email, timeWindow = 15 } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email parameter is required',
      });
    }

    const attempts = await AuthLog.getFailedAttempts(email, parseInt(timeWindow, 10));

    res.json({
      success: true,
      data: {
        email,
        failedAttempts: attempts.length,
        timeWindow: `${timeWindow} minutes`,
        attempts,
      },
    });
  } catch (error) {
    console.error('Get failed attempts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching failed login attempts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export {
  getDashboardStats,
  getAllUsers,
  verifyUser,
  toggleUserStatus,
  updateUserRole,
  getAdminLogs,
  getAuthLogs,
  getUserAuthLogs,
  getAuthLogsByEmail,
  getAuthStats,
  getFailedLoginAttempts,

};
