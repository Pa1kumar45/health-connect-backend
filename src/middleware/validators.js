/**
 * Custom Validation Utilities
 *
 * This module provides custom validation functions for user input validation:
 * - Password strength validation (8+ chars, uppercase, lowercase, number, special character)
 * - Phone number format validation (10 digits)
 * - Name format validation (only letters, spaces, hyphens, apostrophes)
 * - Email domain validation
 * - Blood group validation
 * - Date validation
 *
 * @module validators
 */

/**
 * Validates password strength requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 *
 * @param {string} password - Password to validate
 * @returns {boolean} True if password meets all requirements
 * @throws {Error} Error message describing which requirement failed
 */
export const validatePasswordStrength = (password) => {
  if (!password) {
    throw new Error('Password is required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    throw new Error('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    throw new Error('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    throw new Error('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
    throw new Error('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  return true;
};

/**
 * Validates Indian phone number format:
 * - Exactly 10 digits
 * - Only numeric characters
 * - Optional: Can start with country code +91 or 91
 *
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if phone number is valid
 * @throws {Error} Error message if phone number is invalid
 */
export const validatePhoneNumber = (phone) => {
  if (!phone) {
    return true; // Phone is optional in some contexts
  }

  // Remove spaces, hyphens, and parentheses
  const cleanedPhone = phone.replace(/[\s\-()]/g, '');

  // Check for country code and remove it
  let phoneDigits = cleanedPhone;
  if (cleanedPhone.startsWith('+91')) {
    phoneDigits = cleanedPhone.substring(3);
  } else if (cleanedPhone.startsWith('91') && cleanedPhone.length === 12) {
    phoneDigits = cleanedPhone.substring(2);
  }

  // Validate exactly 10 digits
  if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
    throw new Error('Phone number must be a valid 10-digit Indian mobile number starting with 6-9');
  }

  return true;
};

/**
 * Validates name format:
 * - Only letters (a-z, A-Z)
 * - Spaces, hyphens (-), and apostrophes (') allowed
 * - No numbers or special characters
 * - Minimum 2 characters
 * - Maximum 50 characters
 *
 * @param {string} name - Name to validate
 * @returns {boolean} True if name format is valid
 * @throws {Error} Error message if name format is invalid
 */
export const validateNameFormat = (name) => {
  if (!name) {
    throw new Error('Name is required');
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    throw new Error('Name must be at least 2 characters long');
  }

  if (trimmedName.length > 50) {
    throw new Error('Name must not exceed 50 characters');
  }

  // Allow only letters, spaces, hyphens, and apostrophes
  if (!/^[a-zA-Z\s\-']+$/.test(trimmedName)) {
    throw new Error('Name can only contain letters, spaces, hyphens, and apostrophes');
  }

  // Ensure name doesn't start or end with space/hyphen/apostrophe
  if (/^[\s\-']|[\s\-']$/.test(trimmedName)) {
    throw new Error('Name cannot start or end with spaces, hyphens, or apostrophes');
  }

  return true;
};

/**
 * Validates email format and domain:
 * - Valid email format (username@domain.extension)
 * - No spaces or special characters except @ and .
 * - Proper domain structure
 *
 * @param {string} email - Email to validate
 * @returns {boolean} True if email format is valid
 * @throws {Error} Error message if email format is invalid
 */
export const validateEmailFormat = (email) => {
  if (!email) {
    throw new Error('Email is required');
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Basic email regex (more permissive than express-validator for custom domains)
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(trimmedEmail)) {
    throw new Error('Please provide a valid email address');
  }

  // Check for consecutive dots
  if (/\.\./.test(trimmedEmail)) {
    throw new Error('Email address cannot contain consecutive dots');
  }

  // Check for valid characters in local part (before @)
  const [localPart, domain] = trimmedEmail.split('@');

  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    throw new Error('Email address cannot start or end with a dot');
  }

  if (domain.startsWith('.') || domain.endsWith('.')) {
    throw new Error('Email domain cannot start or end with a dot');
  }

  return true;
};

/**
 * Validates blood group format:
 * - Must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-
 *
 * @param {string} bloodGroup - Blood group to validate
 * @returns {boolean} True if blood group is valid
 * @throws {Error} Error message if blood group is invalid
 */
export const validateBloodGroup = (bloodGroup) => {
  if (!bloodGroup) {
    return true; // Blood group is optional
  }

  const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  if (!validBloodGroups.includes(bloodGroup.toUpperCase())) {
    throw new Error('Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-');
  }

  return true;
};

/**
 * Validates date of birth:
 * - Must be a valid date
 * - Cannot be in the future
 * - Age must be between 0 and 150 years
 *
 * @param {string|Date} dateOfBirth - Date of birth to validate
 * @returns {boolean} True if date of birth is valid
 * @throws {Error} Error message if date of birth is invalid
 */
export const validateDateOfBirth = (dateOfBirth) => {
  if (!dateOfBirth) {
    return true; // DOB is optional
  }

  const dob = new Date(dateOfBirth);
  const today = new Date();

  // Check if date is valid
  if (Number.isNaN(dob.getTime())) {
    throw new Error('Invalid date of birth format');
  }

  // Check if date is not in the future
  if (dob > today) {
    throw new Error('Date of birth cannot be in the future');
  }

  // Calculate age
  const age = Math.floor((today - dob) / (365.25 * 24 * 60 * 60 * 1000));

  if (age < 0 || age > 150) {
    throw new Error('Please provide a valid date of birth');
  }

  return true;
};

/**
 * Validates doctor's years of experience:
 * - Must be a number
 * - Must be between 0 and 60 years
 *
 * @param {number} experience - Years of experience
 * @returns {boolean} True if experience is valid
 * @throws {Error} Error message if experience is invalid
 */
export const validateExperience = (experience) => {
  if (experience === undefined || experience === null) {
    throw new Error('Experience is required for doctors');
  }

  const exp = Number(experience);

  if (Number.isNaN(exp)) {
    throw new Error('Experience must be a number');
  }

  if (exp < 0) {
    throw new Error('Experience cannot be negative');
  }

  if (exp > 60) {
    throw new Error('Experience cannot exceed 60 years');
  }

  return true;
};

/**
 * Validates gender:
 * - Must be one of: male, female, other
 *
 * @param {string} gender - Gender to validate
 * @returns {boolean} True if gender is valid
 * @throws {Error} Error message if gender is invalid
 */
export const validateGender = (gender) => {
  if (!gender) {
    return true; // Gender is optional
  }

  const validGenders = ['male', 'female', 'other'];

  if (!validGenders.includes(gender.toLowerCase())) {
    throw new Error('Gender must be one of: male, female, other');
  }

  return true;
};

/**
 * Validates medical specialization:
 * - Must be a valid medical specialization
 * - Minimum 2 characters
 *
 * @param {string} specialization - Specialization to validate
 * @returns {boolean} True if specialization is valid
 * @throws {Error} Error message if specialization is invalid
 */
export const validateSpecialization = (specialization) => {
  if (!specialization) {
    throw new Error('Specialization is required for doctors');
  }

  const trimmed = specialization.trim();

  if (trimmed.length < 2) {
    throw new Error('Specialization must be at least 2 characters long');
  }

  if (trimmed.length > 100) {
    throw new Error('Specialization must not exceed 100 characters');
  }

  // Allow letters, spaces, hyphens, parentheses, and ampersand
  if (!/^[a-zA-Z\s\-()&]+$/.test(trimmed)) {
    throw new Error('Specialization can only contain letters, spaces, hyphens, parentheses, and ampersand');
  }

  return true;
};

/**
 * Validates qualification:
 * - Must be provided
 * - Minimum 2 characters
 *
 * @param {string} qualification - Qualification to validate
 * @returns {boolean} True if qualification is valid
 * @throws {Error} Error message if qualification is invalid
 */
export const validateQualification = (qualification) => {
  if (!qualification) {
    throw new Error('Qualification is required for doctors');
  }

  const trimmed = qualification.trim();

  if (trimmed.length < 2) {
    throw new Error('Qualification must be at least 2 characters long');
  }

  if (trimmed.length > 200) {
    throw new Error('Qualification must not exceed 200 characters');
  }

  return true;
};
