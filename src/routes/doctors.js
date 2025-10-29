/**
 * Doctor Routes
 *
 * This module defines all REST API endpoints related to doctor operations.
 * Routes include public access for browsing doctors and protected routes for
 * doctor profile management and patient reviews.
 *
 * Base path: /api/doctors
 *
 * @module doctorRoutes
 * @requires express - Express.js web framework
 * @requires express-validator - Input validation middleware
 * @requires doctorController - Controller functions for doctor operations
 * @requires authMiddleware - Authentication and authorization middleware
 */

import express from 'express';
import { body } from 'express-validator';
import {
  getDoctors,
  getDoctor,
  updateDoctor,
  deleteDoctor,
  updateDoctorProfile,
  addReview,
} from '../controllers/doctorController.js';
import { protect, doctorOnly, patientOnly } from '../middleware/auth.js';

// Initialize Express router for doctor endpoints
const router = express.Router();

/**
 * Public Routes - No authentication required
 * These endpoints allow public access to browse available doctors
 */

/**
 * GET /api/doctors
 * Retrieve list of all doctors with optional filtering
 *
 * @route GET /api/doctors
 * @access Public
 * @description Get paginated list of doctors with specialization filtering
 * @query {string} [specialization] - Filter by doctor specialization
 * @query {number} [page=1] - Page number for pagination
 * @query {number} [limit=10] - Number of doctors per page
 * @returns {Object} List of doctors with pagination info
 */
router.get('/', getDoctors);

/**
 * GET /api/doctors/:id
 * Retrieve specific doctor details by ID
 *
 * @route GET /api/doctors/:id
 * @access Public
 * @description Get detailed information about a specific doctor
 * @param {string} id - Doctor's unique identifier
 * @returns {Object} Doctor details including profile, specialization, and reviews
 */
router.get('/:id', getDoctor);

/**
 * Protected Doctor Routes - Require doctor authentication
 * These endpoints are restricted to authenticated doctors only
 */

/**
 * PUT /api/doctors/:id
 * Update doctor information (admin-level update)
 *
 * @route PUT /api/doctors/:id
 * @access Private (Doctor only)
 * @middleware protect - JWT authentication required
 * @middleware doctorOnly - Restricts access to doctors
 * @param {string} id - Doctor's unique identifier
 * @body {Object} Doctor update data (any field)
 * @returns {Object} Updated doctor information
 */
router.put('/:id', protect, doctorOnly, updateDoctor);

/**
 * DELETE /api/doctors/:id
 * Delete doctor account
 *
 * @route DELETE /api/doctors/:id
 * @access Private (Doctor only)
 * @middleware protect - JWT authentication required
 * @middleware doctorOnly - Restricts access to doctors
 * @param {string} id - Doctor's unique identifier
 * @returns {Object} Deletion confirmation message
 */
router.delete('/:id', protect, doctorOnly, deleteDoctor);

/**
 * PUT /api/doctors/profile/update
 * Update doctor's own profile information
 *
 * @route PUT /api/doctors/profile/update
 * @access Private (Doctor only)
 * @middleware protect - JWT authentication required
 * @middleware doctorOnly - Restricts access to doctors
 * @body {Object} Profile update data (whitelisted fields only)
 * @returns {Object} Updated doctor profile
 */
router.put('/profile/update', protect, doctorOnly, updateDoctorProfile);

/**
 * Protected Patient Routes - Require patient authentication
 * These endpoints allow patients to interact with doctor profiles
 */

/**
 * POST /api/doctors/:id/reviews
 * Add review and rating for a doctor
 *
 * @route POST /api/doctors/:id/reviews
 * @access Private (Patient only)
 * @middleware protect - JWT authentication required
 * @middleware patientOnly - Restricts access to patients
 * @param {string} id - Doctor's unique identifier
 * @body {number} rating - Rating between 1-5 (required)
 * @body {string} comment - Review comment text (required)
 * @validation rating - Must be float between 1 and 5
 * @validation comment - Must be non-empty string after trimming
 * @returns {Object} Added review with confirmation
 */
router.post('/:id/reviews', protect, patientOnly, [
  // Input validation for review data
  body('rating')
    .isFloat({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .trim()
    .notEmpty()
    .withMessage('Review comment is required'),
], addReview);

export default router;
