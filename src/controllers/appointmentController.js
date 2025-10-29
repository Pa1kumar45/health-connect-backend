/**
 * Appointment Controller
 *
 * This module handles all appointment-related operations including:
 * - Creating, reading, updating, and deleting appointments
 * - Managing appointment status and scheduling
 * - Handling doctor and patient appointment views
 * - Appointment authorization and access control
 *
 * @module appointmentController
 * @requires Appointment - Appointment model for database operations
 * @requires Doctor - Doctor model for validation and population
 */

import { Appointment } from '../models/Appointment.js';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import { FIXED_TIME_SLOTS } from '../utils/timeSlots.js';
import { sendAppointmentAcceptanceEmail } from '../services/emailService.js';

/**
 * Get available slots for a doctor on a specific date
 *
 * Returns only the slots that:
 * 1. The doctor has marked as available in their schedule
 * 2. Are not already booked for that date (no accepted/scheduled appointment)
 *
 * @async
 * @function getAvailableSlots
 * @param {Object} req - Express request object
 * @param {string} req.params.doctorId - Doctor's ObjectId
 * @param {string} req.query.date - Date in YYYY-MM-DD format
 * @param {Object} res - Express response object
 *
 * @returns {Array} Array of available slot objects with slotNumber, startTime, endTime
 * @throws {400} If date parameter is missing
 * @throws {404} If doctor not found
 * @throws {500} If database query fails
 */
export const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required' });
    }

    // Find the doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Check if doctor account is suspended
    if (!doctor.isActive) {
      return res.status(403).json({ message: 'This doctor account is currently suspended and not available for appointments' });
    }

    // Get the day of week for the requested date
    const dateObj = new Date(`${date}T00:00:00`);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[dateObj.getDay()];

    // Find doctor's schedule for that day
    const daySchedule = doctor.schedule?.find((s) => s.day === dayOfWeek);

    if (!daySchedule || daySchedule.slots.length === 0) {
      return res.json({
        message: 'Doctor does not work on this day',
        availableSlots: [],
      });
    }

    // Get doctor's preferred slots (those marked as available)
    const doctorAvailableSlots = daySchedule.slots
      .filter((slot) => slot.isAvailable)
      .map((slot) => slot.slotNumber);

    // Get already booked/accepted slots for this date
    const bookedAppointments = await Appointment.find({
      doctorId,
      date,
      status: { $in: ['scheduled', 'pending'] }, // Both pending and accepted appointments block the slot
    });

    const bookedSlotNumbers = bookedAppointments.map((apt) => apt.slotNumber);

    // Filter out booked slots from doctor's available slots
    const availableSlotNumbers = doctorAvailableSlots.filter(
      (slotNum) => !bookedSlotNumbers.includes(slotNum),
    );

    // Map to full slot information
    const availableSlots = availableSlotNumbers.map((slotNum) => {
      const slotInfo = FIXED_TIME_SLOTS.find((s) => s.slotNumber === slotNum);
      return slotInfo;
    }).filter(Boolean); // Remove any undefined entries

    res.json({
      date,
      dayOfWeek,
      availableSlots,
    });
  } catch (error) {
    console.error('Error getting available slots:', error);
    res.status(500).json({ message: 'Error fetching available slots' });
  }
};

/**
 * Get all appointments for the authenticated user
 *
 * This function retrieves all appointments where the authenticated user
 * is either the doctor or the patient. Results include populated doctor
 * and patient information.
 *
 * @async
 * @function getAppointments
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object (from middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Array} JSON array of appointments with populated doctor/patient data
 * @throws {500} If database query fails
 */
export const getAppointments = async (req, res) => {
  try {
    // Find appointments where user is either doctor or patient
    // Uses $or operator to search both doctorId and patientId fields
    const appointments = await Appointment.find({
      $or: [
        { doctorId: req.user._id },
        { patientId: req.user._id },
      ],
    })
    // Populate related doctor and patient data with selected fields
      .populate('doctorId', 'name specialization') // Doctor info
      .populate('patientId', 'name'); // Patient info

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching appointments' });
  }
};

/**
 * Get a specific appointment by ID
 *
 * This function retrieves a single appointment with authorization check.
 * Only the doctor or patient involved in the appointment can view it.
 *
 * @async
 * @function getAppointment
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Appointment ObjectId
 * @param {Object} req.user - Authenticated user object (from middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON object with appointment data and populated references
 * @throws {404} If appointment not found
 * @throws {403} If user not authorized to view this appointment
 * @throws {500} If database query fails
 */
export const getAppointment = async (req, res) => {
  try {
    // Find appointment by ID and populate related data
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctorId', 'name specialization')
      .populate('patientId', 'name');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Authorization check: Only doctor or patient involved can view appointment
    if (appointment.doctorId._id.toString() !== req.user._id.toString()
        && appointment.patientId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this appointment' });
    }

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching appointment' });
  }
};

/**
 * Create a new appointment (patients only)
 *
 * This function allows patients to book appointments with doctors.
 * Validates doctor existence and user role before creating the appointment.
 *
 * @async
 * @function createAppointment
 * @param {Object} req - Express request object
 * @param {Object} req.body - Appointment data
 * @param {string} req.body.doctorId - Target doctor's ObjectId
 * @param {string} req.body.date - Appointment date
 * @param {string} req.body.startTime - Appointment start time
 * @param {string} req.body.endTime - Appointment end time
 * @param {string} [req.body.status] - Appointment status (defaults to 'pending')
 * @param {string} [req.body.mode] - Appointment mode ('video' or 'chat')
 * @param {string} [req.body.reason] - Reason for appointment
 * @param {Object} req.user - Authenticated patient object (from middleware)
 * @param {string} req.userRole - User role (from middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with created appointment and populated data
 * @throws {404} If doctor not found
 * @throws {403} If user is not a patient
 * @throws {500} If database operation fails
 */
export const createAppointment = async (req, res) => {
  try {
    console.log('createAppointment:', req.body);

    const {
      doctorId, date, slotNumber, reason,
    } = req.body;

    // Validate required fields
    if (!slotNumber || slotNumber < 1 || slotNumber > 96) {
      return res.status(400).json({ message: 'Valid slot number (1-96) is required' });
    }

    // Validate that the target doctor exists
    const doctor = await Doctor.findById(doctorId);
    console.log('found appointment doctor', doctor._id);

    if (!doctor) {
      console.log('Doctor not found');
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Check if doctor account is suspended
    if (!doctor.isActive) {
      console.log('Doctor account is suspended');
      return res.status(403).json({ message: 'This doctor account is currently suspended and not available for appointments' });
    }

    // Authorization: Only patients can create appointments
    if (req.userRole !== 'patient') {
      console.log('Only patients can create appointments');
      return res.status(403).json({ message: 'Only patients can create appointments' });
    }

    // Get the day of week for the requested date
    const dateObj = new Date(`${date}T00:00:00`);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[dateObj.getDay()];

    // Check if doctor works on this day and has this slot available
    const daySchedule = doctor.schedule?.find((s) => s.day === dayOfWeek);
    if (!daySchedule) {
      return res.status(400).json({ message: 'Doctor does not work on this day' });
    }

    const doctorSlot = daySchedule.slots.find((s) => s.slotNumber === slotNumber);
    if (!doctorSlot || !doctorSlot.isAvailable) {
      return res.status(400).json({ message: 'This time slot is not available in doctor\'s schedule' });
    }

    // Check if slot is already booked for this date
    const existingAppointment = await Appointment.findOne({
      doctorId,
      date,
      slotNumber,
      status: { $in: ['scheduled', 'pending'] },
    });

    if (existingAppointment) {
      return res.status(400).json({ message: 'This time slot is already booked' });
    }

    // Get start and end times from the fixed slots
    const slotInfo = FIXED_TIME_SLOTS.find((s) => s.slotNumber === slotNumber);

    // Create new appointment document
    const appointment = new Appointment({
      doctorId,
      patientId: req.user._id,
      date,
      slotNumber,
      startTime: slotInfo.startTime,
      endTime: slotInfo.endTime,
      reason,
      status: 'pending', // Doctor needs to accept it
    });

    // Save appointment to database
    await appointment.save();

    // Populate doctor and patient information for response
    const populatedAppointment = await appointment.populate([
      { path: 'doctorId', select: 'name specialization' },
      { path: 'patientId', select: 'name' },
    ]);

    res.status(200).json({ data: populatedAppointment });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error creating appointment' });
  }
};

/**
 * Update an existing appointment
 *
 * This function allows authorized users (doctor or patient involved) to update
 * appointment details such as status, notes, ratings, etc.
 *
 * @async
 * @function updateAppointment
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Appointment ObjectId to update
 * @param {Object} req.body - Updated appointment data
 * @param {Object} req.user - Authenticated user object (from middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with updated appointment and populated data
 * @throws {404} If appointment not found
 * @throws {403} If user not authorized to update this appointment
 * @throws {500} If database operation fails
 */
export const updateAppointment = async (req, res) => {
  try {
    console.log('updateAppointment:hit');

    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Get doctor and patient details separately
    const doctor = await Doctor.findById(appointment.doctorId);
    const patient = await Patient.findById(appointment.patientId);

    // Authorization: Only doctor or patient involved can update appointment
    if (appointment.doctorId.toString() !== req.user._id.toString()
        && appointment.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this appointment' });
    }

    const updates = req.body;
    const oldStatus = appointment.status;

    // Apply all provided updates to the appointment
    Object.keys(updates).forEach((key) => {
      appointment[key] = updates[key];
    });

    // Save updated appointment
    await appointment.save();

    // If status changed from 'pending' to 'scheduled', send acceptance email
    if (oldStatus === 'pending' && appointment.status === 'scheduled') {
      console.log('[EMAIL] Sending appointment acceptance email...');
      console.log('Patient Data:', {
        id: patient._id,
        name: patient.name,
        email: patient.email
      });
      console.log('Doctor Data:', {
        id: doctor._id,
        name: doctor.name,
        specialization: doctor.specialization
      });
      
      // Format date for email
      const dateObj = new Date(appointment.date);
      const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Send acceptance email to patient
      try {
        if (!patient.email) {
          console.error('[ERROR] Patient email is undefined!');
          throw new Error('Patient email not found');
        }
        
        await sendAppointmentAcceptanceEmail({
          patientEmail: patient.email,
          patientName: patient.name,
          doctorName: doctor.name,
          doctorSpecialization: doctor.specialization,
          appointmentDate: formattedDate,
          appointmentTime: `${appointment.startTime} - ${appointment.endTime}`,
        });
        console.log('[SUCCESS] Appointment acceptance email sent successfully to:', patient.email);
      } catch (emailError) {
        console.error('[ERROR] Error sending appointment acceptance email:', emailError.message);
        // Don't fail the request if email fails - appointment is still updated
      }
    }

    // Populate again for final response
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('doctorId', 'name specialization')
      .populate('patientId', 'name');

    res.json(populatedAppointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ message: 'Error updating appointment' });
  }
};

/**
 * Delete an appointment
 *
 * This function allows authorized users (doctor or patient involved) to delete
 * an appointment from the system.
 *
 * @async
 * @function deleteAppointment
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Appointment ObjectId to delete
 * @param {Object} req.user - Authenticated user object (from middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON confirmation message
 * @throws {404} If appointment not found
 * @throws {403} If user not authorized to delete this appointment
 * @throws {500} If database operation fails
 */
export const deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Authorization: Only doctor or patient involved can delete appointment
    if (appointment.doctorId.toString() !== req.user._id.toString()
        && appointment.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this appointment' });
    }

    // Delete the appointment document
    await appointment.deleteOne();
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting appointment' });
  }
};

/**
 * Get all appointments for a specific doctor
 *
 * This function retrieves all appointments where the authenticated user is the doctor.
 * Results are sorted by date and start time, and include populated patient information.
 *
 * @async
 * @function getDoctorAppointments
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated doctor object (from middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Array} JSON array of doctor's appointments with patient data
 * @throws {404} If doctor not found
 * @throws {500} If database query fails
 */
export const getDoctorAppointments = async (req, res) => {
  try {
    console.log('getDoctorAppointments');
    const doctorId = req.user._id;

    // Verify that the doctor exists in the database
    const doctor = await Doctor.findById(doctorId);
    console.log(doctor._id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Note: Authorization check commented out - currently allows any authenticated user
    // Uncomment below for stricter authorization:
    // if (doctorId !== req.user._id.toString() && req.user.role !== 'admin') {
    //   return res.status(403).json({ message: 'Not authorized to view these appointments' });
    // }

    // Find all appointments for this doctor, populate patient info, and sort chronologically
    const appointments = await Appointment.find({ doctorId })
      .populate('patientId', 'name') // Include patient name only
      .sort({ date: 1, startTime: 1 }); // Sort by date and time ascending

    res.json(appointments);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching doctor appointments' });
  }
};
/**
 * Get all appointments for the authenticated patient
 *
 * This function retrieves all appointments where the authenticated user is the patient.
 * Results are sorted by date and start time, and include populated doctor information.
 *
 * @async
 * @function getPatientAppointments
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated patient object (from middleware)
 * @param {string} req.userRole - User role (from middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Array} JSON array of patient's appointments with doctor data
 * @throws {403} If user is not a patient
 * @throws {500} If database query fails
 */
export const getPatientAppointments = async (req, res) => {
  try {
    console.log('getPatientAppointments hit');
    const userId = req.user._id;

    // Authorization: Only patients can access this endpoint
    if (req.userRole !== 'patient') {
      console.log('Only patients can get appointments');
      return res.status(403).json({ message: 'Only patients can create appointments' });
    }

    // Find all appointments for this patient, populate doctor info, and sort chronologically
    const appointments = await Appointment.find({ patientId: userId })
      .populate('doctorId', 'name specialization') // Include doctor name and specialization
      .sort({ date: 1, startTime: 1 }); // Sort by date and time ascending

    res.json(appointments);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching patient appointments' });
  }
};

/**
 * Get count of upcoming appointments for doctor today
 * 
 * Returns the count of scheduled appointments for the current day
 * that are in the future (haven't started yet).
 * 
 * @async
 * @function getTodayUpcomingCount
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated doctor object (from middleware)
 * @param {Object} res - Express response object
 * 
 * @returns {Object} JSON object with count of upcoming appointments
 * @throws {500} If database query fails
 */
export const getTodayUpcomingCount = async (req, res) => {
  try {
    const doctorId = req.user._id;
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Get current time in HH:MM format
    const currentTime = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}`;
    
    // Find all scheduled appointments for today that haven't started yet
    const upcomingAppointments = await Appointment.find({
      doctorId,
      date: todayStr,
      status: 'scheduled',
      startTime: { $gt: currentTime }
    });
    
    res.json({ 
      count: upcomingAppointments.length,
      date: todayStr,
      currentTime
    });
  } catch (error) {
    console.error('Error fetching upcoming count:', error);
    res.status(500).json({ message: 'Error fetching upcoming appointments count' });
  }
};

/**
 * Get Pending Appointments Count for Doctor
 * 
 * Returns the count of all pending (not yet approved) appointment requests
 * for the authenticated doctor. Pending appointments are those with status 'pending'
 * that require doctor approval.
 * 
 * @function getPendingCount
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated doctor object (from middleware)
 * @param {Object} res - Express response object
 * 
 * @returns {Object} JSON object with count of pending appointments
 * @throws {500} If database query fails
 */
export const getPendingCount = async (req, res) => {
  try {
    const doctorId = req.user._id;
    
    // Find all pending appointments for this doctor
    const pendingAppointments = await Appointment.find({
      doctorId,
      status: 'pending'
    });
    
    res.json({ 
      count: pendingAppointments.length
    });
  } catch (error) {
    console.error('Error fetching pending count:', error);
    res.status(500).json({ message: 'Error fetching pending appointments count' });
  }
};
