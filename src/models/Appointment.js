/**
 * Appointment Model
 *
 * This module defines the MongoDB schema for appointment entities in the healthcare system.
 * It manages:
 * - Appointment scheduling between doctors and patients
 * - Appointment status tracking (pending, scheduled, completed, cancelled)
 *
 * @module Appointment
 * @requires mongoose - MongoDB object modeling library
 */

import mongoose from 'mongoose';

/**
 * Appointment Schema Definition
 *
 * Defines the structure for appointment documents in MongoDB.
 * Links doctors and patients through ObjectId references and tracks
 * appointment details, status, and feedback.
 */
const appointmentSchema = new mongoose.Schema({
  // Relationship references
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor', // Reference to Doctor model
    required: true,
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient', // Reference to Patient model
    required: true,
  },

  // Scheduling information
  date: {
    type: String,
    required: true, // Appointment date (format: YYYY-MM-DD)
  },
  slotNumber: {
    type: Number,
    required: true, // Which slot (1-48) corresponding to 9 AM - 9 PM (12 hours) in 15-min intervals
    min: 1,
    max: 48,
  },
  startTime: {
    type: String,
    required: true, // Appointment start time (format: HH:MM)
  },
  endTime: {
    type: String,
    required: true, // Appointment end time (format: HH:MM, always 15 minutes after start)
  },

  // Appointment management
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'completed', 'cancelled'],
    default: 'pending', // Default status for new appointments
  },

  // Appointment details
  reason: {
    type: String,
    required: false, // Patient's reason for the appointment
    trim: true,
  },
}, {
  timestamps: true, // Automatically add createdAt and updatedAt fields
});

/**
 * Database Indexes for Performance Optimization
 *
 * These indexes improve query performance for common appointment searches:
 * - doctorId + date: For finding doctor's appointments on specific dates
 * - patientId + date: For finding patient's appointments on specific dates
 */
appointmentSchema.index({ doctorId: 1, date: 1 });
appointmentSchema.index({ patientId: 1, date: 1 });

/**
 * Appointment Model
 *
 * Creates and exports the Appointment model from the schema.
 * This model manages the relationship between doctors and patients
 * through scheduled appointments.
 *
 * @type {mongoose.Model<Appointment>}
 */
export const Appointment = mongoose.model('Appointment', appointmentSchema);

// Default export for convenience
export default Appointment;
