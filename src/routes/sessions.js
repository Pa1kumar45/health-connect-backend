/**
 * Session Routes
 *
 * Defines routes for session management operations.
 * All routes require authentication.
 *
 * @module routes/sessions
 */

import express from 'express';
import {
  getSessions,
  revokeSession,
  revokeAllSessions,
  getCurrentSession,
} from '../controllers/sessionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/auth/sessions
 * @desc    Get all active sessions for the authenticated user
 * @access  Private
 */
router.get('/sessions', getSessions);

/**
 * @route   GET /api/auth/sessions/current
 * @desc    Get current session information
 * @access  Private
 */
router.get('/sessions/current', getCurrentSession);

/**
 * @route   DELETE /api/auth/sessions/all
 * @desc    Revoke all sessions except the current one
 * @access  Private
 */
router.delete('/sessions/all', revokeAllSessions);

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    Revoke a specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId', revokeSession);

export default router;
