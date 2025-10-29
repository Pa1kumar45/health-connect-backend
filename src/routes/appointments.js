/**
 * Appointment Routes
 *
 * This module defines all REST API endpoints related to appointment management.
 * All routes require authentication and provide comprehensive CRUD operations
 * for appointments between doctors and patients.
 *
 * Base path: /api/appointments
 *
 * @module appointmentRoutes
 * @requires express - Express.js web framework
 * @requires express-validator - Input validation middleware
 * @requires appointmentController - Controller functions for appointment operations
 * @requires authMiddleware - Authentication middleware
 */

import express from 'express';
import {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getDoctorAppointments,
  getPatientAppointments,
  getAvailableSlots,
  getTodayUpcomingCount,
  getPendingCount,
  // updateAppointmentStatus
} from '../controllers/appointmentController.js';
import { protect } from '../middleware/auth.js';

// Initialize Express router for appointment endpoints
const router = express.Router();

/**
 * Global middleware - All appointment routes require authentication
 * This ensures only logged-in users can access appointment data
 */
router.use(protect);

/**
 * General Appointment Routes
 * These routes provide access to appointment data based on user context
 */

/**
 * GET /api/appointments/available-slots/:doctorId
 * Get available time slots for a doctor on a specific date
 *
 * @route GET /api/appointments/available-slots/:doctorId?date=YYYY-MM-DD
 * @access Private (Any authenticated user can check availability)
 * @middleware protect - JWT authentication required
 * @param {string} doctorId - Doctor's unique identifier
 * @query {string} date - Date in YYYY-MM-DD format
 * @description Get available 1-hour slots (9 AM - 9 PM) for a doctor on a specific date
 * @returns {Object} List of available slots with slotNumber, startTime, endTime
 */
router.get('/available-slots/:doctorId', getAvailableSlots);

/**
 * GET /api/appointments
 * Retrieve appointments for the authenticated user
 *
 * @route GET /api/appointments
 * @access Private (Any authenticated user)
 * @middleware protect - JWT authentication required
 * @description Get appointments based on user role (doctor sees their appointments, patient sees their appointments)
 * @returns {Object} List of appointments with populated doctor/patient information
 */
router.get('/', getAppointments);

/**
 * GET /api/appointments/doctor
 * Retrieve appointments for the authenticated doctor
 *
 * @route GET /api/appointments/doctor
 * @access Private (Doctor only - enforced by controller logic)
 * @middleware protect - JWT authentication required
 * @description Get all appointments where the authenticated user is the doctor
 * @returns {Object} List of doctor's appointments with patient details
 */
router.get('/doctor/', getDoctorAppointments);

/**
 * GET /api/appointments/patient
 * Retrieve appointments for the authenticated patient
 *
 * @route GET /api/appointments/patient
 * @access Private (Patient only - enforced by controller logic)
 * @middleware protect - JWT authentication required
 * @description Get all appointments where the authenticated user is the patient
 * @returns {Object} List of patient's appointments with doctor details
 */
router.get('/patient/', getPatientAppointments);

/**
 * GET /api/appointments/doctor/today-count
 * Get count of upcoming appointments for today
 *
 * @route GET /api/appointments/doctor/today-count
 * @access Private (Doctor only)
 * @middleware protect - JWT authentication required
 * @description Get the count of scheduled appointments for today that haven't started yet
 * @returns {Object} Count of upcoming appointments
 */
router.get('/doctor/today-count', getTodayUpcomingCount);

/**
 * GET /api/appointments/doctor/pending-count
 * Get count of pending appointment requests
 *
 * @route GET /api/appointments/doctor/pending-count
 * @access Private (Doctor only)
 * @middleware protect - JWT authentication required
 * @description Get the count of pending appointments that require doctor approval
 * @returns {Object} Count of pending appointments
 */
router.get('/doctor/pending-count', getPendingCount);

/**
 * GET /api/appointments/:id
 * Retrieve specific appointment details by ID
 *
 * @route GET /api/appointments/:id
 * @access Private (Appointment participants only)
 * @middleware protect - JWT authentication required
 * @param {string} id - Appointment's unique identifier
 * @description Get detailed information about a specific appointment
 * @returns {Object} Appointment details with doctor and patient information
 */
router.get('/:id', getAppointment);

/**
 * Appointment Management Routes
 * These routes handle creation, modification, and deletion of appointments
 */

/**
 * POST /api/appointments
 * Create a new appointment
 *
 * @route POST /api/appointments
 * @access Private (Patient only - enforced by controller logic)
 * @middleware protect - JWT authentication required
 * @body {string} doctorId - ID of the doctor for the appointment
 * @body {Date} date - Appointment date and time (ISO 8601 format)
 * @body {string} reason - Reason for the appointment
 * @body {string} [type='consultation'] - Type of appointment
 * @description Create a new appointment (only patients can create appointments)
 * @returns {Object} Created appointment with confirmation
 */
router.post('/', createAppointment);

/**
 * PUT /api/appointments/:id
 * Update existing appointment
 *
 * @route PUT /api/appointments/:id
 * @access Private (Appointment participants only)
 * @middleware protect - JWT authentication required
 * @param {string} id - Appointment's unique identifier
 * @body {Date} [date] - Updated appointment date and time
 * @body {string} [reason] - Updated reason for appointment
 * @body {string} [status] - Updated appointment status
 * @body {string} [type] - Updated appointment type
 * @description Update appointment details (participants only)
 * @returns {Object} Updated appointment information
 */
router.put('/:id', updateAppointment);

/**
 * DELETE /api/appointments/:id
 * Cancel/delete an appointment
 *
 * @route DELETE /api/appointments/:id
 * @access Private (Appointment participants only)
 * @middleware protect - JWT authentication required
 * @param {string} id - Appointment's unique identifier
 * @description Cancel an appointment (participants only)
 * @returns {Object} Cancellation confirmation message
 */
router.delete('/:id', deleteAppointment);

/**
 * Future Enhancement Routes
 * These routes are planned for future implementation
 */

// Future route for appointment status updates only
// router.put('/:id/status', updateAppointmentStatus);

export default router;
