/**
 * Doctor Controller
 *
 * This module handles all doctor-related operations including:
 * - Retrieving doctor profiles and listings
 * - Updating doctor profiles
 * - Managing doctor reviews and ratings
 * - Doctor profile management and validation
 *
 * @module doctorController
 * @requires Doctor - Doctor model for database operations
 * @requires validationResult - Express validator for input validation
 */

import { validationResult } from 'express-validator';
import { Doctor } from '../models/Doctor.js';

/**
 * Get all doctors with public profile information
 *
 * This function retrieves all doctors from the database and returns
 * their public profile information (excluding sensitive data like passwords).
 *
 * @async
 * @function getDoctors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 *
 * @returns {Array} JSON array of doctor profiles with selected fields
 * @throws {500} If database query fails
 */
export const getDoctors = async (req, res) => {
  try {
    // Retrieve only active (non-suspended) doctors with selected public fields
    // Password is excluded for security, specific fields are selected for optimization
    const doctors = await Doctor.find({ isActive: true })
      .select('-password') // Exclude password field
      .select('name email specialization experience qualification about contactNumber avatar schedule');

    res.json(doctors);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching doctors' });
  }
};

/**
 * Get a specific doctor by ID
 *
 * This function retrieves a single doctor's profile information by their ObjectId.
 * Returns public profile data excluding sensitive information.
 *
 * @async
 * @function getDoctor
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Doctor's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON object with doctor profile data
 * @throws {404} If doctor not found
 * @throws {500} If database query fails
 */
export const getDoctor = async (req, res) => {
  try {
    // Find doctor by ID with selected public fields
    const doctor = await Doctor.findById(req.params.id)
      .select('-password') // Security: exclude password
      .select('name email specialization experience qualification about contactNumber avatar schedule');

    // Handle case where doctor doesn't exist
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Check if doctor account is suspended
    if (!doctor.isActive) {
      return res.status(403).json({ success: false, message: 'This doctor account is currently suspended' });
    }

    res.json(doctor);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching doctor' });
  }
};

/**
 * Update doctor profile (admin function)
 *
 * This function allows updating a doctor's profile information.
 * Currently uses the authenticated user's ID rather than the route parameter.
 *
 * @async
 * @function updateDoctor
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object (from middleware)
 * @param {Object} req.body - Updated doctor profile data
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON object with updated doctor profile
 * @throws {404} If doctor not found
 * @throws {500} If database update fails
 */
export const updateDoctor = async (req, res) => {
  try {
    // Get doctor ID from authenticated user (set by auth middleware)
    const id = req.user._id;
    const doctor = await Doctor.findById(id);

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const updates = req.body;

    // Dynamically update all provided fields
    // Note: This allows updating any field - consider field validation for production
    Object.keys(updates).forEach((key) => {
      doctor[key] = updates[key];
    });

    // Save updated doctor (triggers validation and middleware)
    await doctor.save();
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating doctor profile' });
  }
};

/**
 * Delete doctor profile
 *
 * This function allows a doctor to delete their own profile.
 * Includes authorization check to ensure only the profile owner can delete it.
 *
 * @async
 * @function deleteDoctor
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Doctor's ObjectId to delete
 * @param {Object} req.user - Authenticated user object (from middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON confirmation message
 * @throws {404} If doctor not found
 * @throws {403} If user not authorized to delete this profile
 * @throws {500} If database deletion fails
 */
export const deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Authorization: Only allow doctors to delete their own profile
    // Compare ObjectIds as strings to ensure proper comparison
    if (doctor._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this profile' });
    }

    // Delete the doctor document
    await doctor.deleteOne();
    res.json({ message: 'Doctor profile deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting doctor profile' });
  }
};

/**
 * Update doctor's own profile (self-service)
 *
 * This function allows an authenticated doctor to update their own profile.
 * Only allows updating specific whitelisted fields for security.
 *
 * @async
 * @function updateDoctorProfile
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated doctor object (from middleware)
 * @param {Object} req.body - Profile update data
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with updated doctor profile including role
 * @throws {500} If database update fails
 */
export const updateDoctorProfile = async (req, res) => {
  try {
    // Get the authenticated doctor from middleware
    const doctor = req.user;

    // Whitelist of fields that can be updated by the doctor
    // This prevents updating sensitive fields like _id, password, etc.
    const allowedUpdates = [
      'name',
      'specialization',
      'experience',
      'qualification',
      'about',
      'contactNumber',
      'avatar',
      'schedule',
    ];

    const updates = req.body;

    // Only update whitelisted fields for security
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        doctor[key] = updates[key];
      }
    });

    // Save updated doctor profile (this triggers Mongoose validation)
    await doctor.save();

    console.log('Doctor profile updated successfully', doctor._id);

    // Return updated profile with role information
    res.status(200).json({ success: true, data: { ...doctor.toObject(), role: 'doctor' } });
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }
    res.status(500).json({ success: false, message: 'Error updating profile', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

/**
 * Add a patient review for a doctor
 *
 * This function allows patients to add reviews and ratings for doctors.
 * Prevents duplicate reviews from the same patient and updates overall rating.
 *
 * @async
 * @function addReview
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Doctor's ObjectId to review
 * @param {Object} req.body - Review data
 * @param {number} req.body.rating - Rating from 1-5
 * @param {string} req.body.comment - Review comment text
 * @param {Object} req.user - Authenticated patient object (from middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with updated doctor data including new review
 * @throws {400} If validation fails or duplicate review exists
 * @throws {404} If doctor not found
 * @throws {500} If database operation fails
 */
export const addReview = async (req, res) => {
  try {
    // Validate request data using express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { rating, comment } = req.body;
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Check if patient has already reviewed this doctor
    // Prevents duplicate reviews from the same patient
    const existingReview = doctor.reviews.find(
      (review) => review.patientId.toString() === req.user._id.toString(),
    );

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this doctor' });
    }

    // Create new review object
    const review = {
      patientId: req.user._id,
      rating: Number(rating), // Ensure rating is stored as number
      comment,
      date: new Date(),
    };

    // Add review to doctor's reviews array
    doctor.reviews.push(review);

    // Recalculate overall rating based on all reviews
    const totalRating = doctor.reviews.reduce((sum, rev) => sum + rev.rating, 0);
    doctor.rating = totalRating / doctor.reviews.length;

    // Save updated doctor with new review and rating
    await doctor.save();
    res.status(201).json({ success: true, doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding review' });
  }
};
