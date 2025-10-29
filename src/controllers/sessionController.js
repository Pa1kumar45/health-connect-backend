/**
 * Session Controller
 *
 * This module handles session management operations including:
 * - Viewing active sessions
 * - Revoking specific sessions
 * - Revoking all sessions
 * - Session activity tracking
 *
 * @module sessionController
 */

import Session from '../models/Session.js';

/**
 * Get all active sessions for the authenticated user
 *
 * @route GET /api/auth/sessions
 * @access Private (requires authentication)
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {string} req.userRole - User role from middleware
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with user's active sessions
 * @returns {boolean} returns.success - Success status
 * @returns {Array} returns.data - Array of session objects
 * @returns {number} returns.count - Total number of active sessions
 */
export const getSessions = async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.userRole;

    // Map role to userType
    let userType = 'Patient';
    if (role === 'doctor') userType = 'Doctor';
    else if (role === 'super_admin' || role === 'user_management') userType = 'Admin';

    // Get all active sessions for the user
    const sessions = await Session.getUserSessions(userId, userType);

    // Get current token from cookie
    const currentToken = req.cookies.token;

    // Format sessions for response
    const formattedSessions = sessions.map((session) => ({
      _id: session._id,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: session.token === currentToken,
      duration: calculateDuration(session.createdAt),
    }));

    res.json({
      success: true,
      data: formattedSessions,
      count: formattedSessions.length,
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Revoke a specific session
 *
 * @route DELETE /api/auth/sessions/:sessionId
 * @access Private (requires authentication)
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.sessionId - Session ID to revoke
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response confirming session revocation
 * @returns {boolean} returns.success - Success status
 * @returns {string} returns.message - Success message
 */
export const revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;
    const currentToken = req.cookies.token;

    // Find the session to revoke
    const session = await Session.findOne({
      _id: sessionId,
      userId,
      isActive: true,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or already revoked',
      });
    }

    // Prevent revoking current session
    if (session.token === currentToken) {
      return res.status(400).json({
        success: false,
        message: 'Cannot revoke current session. Please use logout instead.',
      });
    }

    // Revoke the session
    await Session.revokeSession(sessionId, userId);

    res.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error revoking session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Revoke all sessions except the current one
 *
 * @route DELETE /api/auth/sessions/all
 * @access Private (requires authentication)
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.cookies - Request cookies
 * @param {string} req.cookies.token - Current session token
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response confirming all sessions revoked
 * @returns {boolean} returns.success - Success status
 * @returns {string} returns.message - Success message
 * @returns {number} returns.revokedCount - Number of sessions revoked
 */
export const revokeAllSessions = async (req, res) => {
  try {
    const userId = req.user._id;
    const currentToken = req.cookies.token;

    // Revoke all sessions except current
    const result = await Session.revokeAllSessions(userId, currentToken);

    res.json({
      success: true,
      message: `Successfully revoked ${result.modifiedCount} session(s)`,
      revokedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error revoking sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get current session information
 *
 * @route GET /api/auth/sessions/current
 * @access Private (requires authentication)
 *
 * @param {Object} req - Express request object
 * @param {Object} req.cookies - Request cookies
 * @param {string} req.cookies.token - Current session token
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with current session info
 */
export const getCurrentSession = async (req, res) => {
  try {
    const currentToken = req.cookies.token;

    if (!currentToken) {
      return res.status(401).json({
        success: false,
        message: 'No active session found',
      });
    }

    const session = await Session.findByToken(currentToken);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or expired',
      });
    }

    res.json({
      success: true,
      data: {
        _id: session._id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        lastActivity: session.lastActivity,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        duration: calculateDuration(session.createdAt),
      },
    });
  } catch (error) {
    console.error('Get current session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching current session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Helper function to calculate session duration
 *
 * @param {Date} createdAt - Session creation date
 * @returns {string} Human-readable duration string
 */
function calculateDuration(createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const durationMs = now - created;

  const durationSeconds = Math.floor(durationMs / 1000);
  const durationMinutes = Math.floor(durationSeconds / 60);
  const durationHours = Math.floor(durationMinutes / 60);
  const durationDays = Math.floor(durationHours / 24);

  if (durationDays > 0) {
    return `${durationDays} day${durationDays > 1 ? 's' : ''} ago`;
  } if (durationHours > 0) {
    return `${durationHours} hour${durationHours > 1 ? 's' : ''} ago`;
  } if (durationMinutes > 0) {
    return `${durationMinutes} minute${durationMinutes > 1 ? 's' : ''} ago`;
  }
  return 'Just now';
}

export default {
  getSessions,
  revokeSession,
  revokeAllSessions,
  getCurrentSession,
};
