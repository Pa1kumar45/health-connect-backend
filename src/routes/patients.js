/**
 * Patient Routes
 *
 * This module defines all REST API endpoints related to patient operations.
 * Routes include public access for patient lookup and protected routes for
 * patient profile management and medical history updates.
 *
 * Base path: /api/patients
 *
 * @module patientRoutes
 * @requires express - Express.js web framework
 * @requires express-validator - Input validation middleware
 * @requires patientController - Controller functions for patient operations
 * @requires authMiddleware - Authentication and authorization middleware
 */

import express from 'express';
import {
  getPatients,
  getPatient,
  updatePatient,
  deletePatient,
  updateMedicalHistory,
} from '../controllers/patientController.js';
import { protect, patientOnly } from '../middleware/auth.js';

// Initialize Express router for patient endpoints
const router = express.Router();

/**
 * Public Routes - No authentication required
 * These endpoints allow public access to browse patient information
 * (typically used by doctors for patient lookup)
 */

/**
 * GET /api/patients
 * Retrieve list of all patients
 *
 * @route GET /api/patients
 * @access Public
 * @description Get list of patients (typically for doctor reference)
 * @returns {Object} List of patients with basic information
 */
router.get('/', getPatients);

/**
 * GET /api/patients/:id
 * Retrieve specific patient details by ID
 *
 * @route GET /api/patients/:id
 * @access Public
 * @description Get detailed information about a specific patient
 * @param {string} id - Patient's unique identifier
 * @returns {Object} Patient details including profile and medical history
 */
router.get('/:id', getPatient);

/**
 * Protected Patient Routes - Require patient authentication
 * These endpoints are restricted to authenticated patients for their own data
 */

/**
 * PUT /api/patients/profile
 * Update patient's own profile information
 *
 * @route PUT /api/patients/profile
 * @access Private (Patient only)
 * @middleware protect - JWT authentication required
 * @middleware patientOnly - Restricts access to patients
 * @body {string} [name] - Patient's full name
 * @body {Date} [dateOfBirth] - Patient's date of birth (ISO 8601 format)
 * @body {string} [gender] - Patient's gender ('male', 'female', 'other')
 * @body {string} [contactNumber] - Patient's contact phone number
 * @body {string} [address] - Patient's residential address
 * @body {Object} [emergencyContact] - Emergency contact information
 * @returns {Object} Updated patient profile
 *
 * @note Currently validation is disabled, all fields are optional
 */
// Commented validation for flexibility - can be re-enabled if needed:
// router.put('/profile', protect, patientOnly, [
//   body('name').optional().trim().notEmpty(),
//   body('dateOfBirth').optional().isISO8601().toDate(),
//   body('gender').optional().isIn(['male', 'female', 'other']),
//   body('contactNumber').optional().trim().notEmpty()
// ], updatePatient);
router.put('/profile', protect, patientOnly, updatePatient);

/**
 * DELETE /api/patients/:id
 * Delete patient account
 *
 * @route DELETE /api/patients/:id
 * @access Private (Patient only)
 * @middleware protect - JWT authentication required
 * @middleware patientOnly - Restricts access to patients
 * @param {string} id - Patient's unique identifier
 * @returns {Object} Deletion confirmation message
 */
router.delete('/:id', protect, patientOnly, deletePatient);

/**
 * PUT /api/patients/medical-history
 * Update patient's medical history information
 *
 * @route PUT /api/patients/medical-history
 * @access Private (Patient only)
 * @middleware protect - JWT authentication required
 * @middleware patientOnly - Restricts access to patients
 * @body {Array} [conditions] - List of medical conditions
 * @body {Array} [allergies] - List of known allergies
 * @body {Array} [medications] - List of current medications
 * @body {Array} [surgeries] - List of past surgeries
 * @body {string} [bloodType] - Patient's blood type
 * @returns {Object} Updated medical history
 *
 * @note Currently validation is disabled for flexibility
 */
router.put('/medical-history', protect, patientOnly, [
  // Commented validation - can be re-enabled for stricter input control:
  // body('conditions').optional().isArray(),
  // body('allergies').optional().isArray(),
  // body('medications').optional().isArray()
], updateMedicalHistory);

export default router;
