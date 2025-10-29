import express from 'express';
import {
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
} from '../controllers/adminController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Apply admin protection to all routes
router.use(protect);
router.use(adminOnly);

// Dashboard routes
router.get('/dashboard/stats', getDashboardStats);

// User management routes
router.get('/users', getAllUsers);
router.put('/users/:id/verify', verifyUser);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.put('/users/:id/role', updateUserRole);

// Admin logs
router.get('/logs', getAdminLogs);

// Authentication logs - IMPORTANT: Specific routes MUST come before parameterized routes
router.get('/auth-logs/stats', getAuthStats);
router.get('/auth-logs/failed-attempts', getFailedLoginAttempts);
router.get('/auth-logs/user/:userId', getUserAuthLogs);
router.get('/auth-logs/email/:email', getAuthLogsByEmail);
router.get('/auth-logs', getAuthLogs);

export default router;
