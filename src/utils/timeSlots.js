/**
 * Time Slots Utility
 * 
 * Centralized configuration for appointment time slots.
 * Generates 48 fixed 15-minute slots from 9 AM to 9 PM.
 * 
 * Slot organization:
 * - 12 hours of operation (9 AM - 9 PM)
 * - 4 slots per hour (15-minute intervals)
 * - Total: 48 slots
 * 
 * Time blocks (for UI grouping):
 * - Block 1: 9:00-11:00 (slots 1-8)
 * - Block 2: 11:00-13:00 (slots 9-16)
 * - Block 3: 13:00-15:00 (slots 17-24)
 * - Block 4: 15:00-17:00 (slots 25-32)
 * - Block 5: 17:00-19:00 (slots 33-40)
 * - Block 6: 19:00-21:00 (slots 41-48)
 * 
 * @module utils/timeSlots
 */

/**
 * Generate all 48 time slots (15-minute intervals from 9 AM to 9 PM)
 * 
 * @returns {Array} Array of slot objects with slotNumber, startTime, endTime
 */
const generateTimeSlots = () => {
  const slots = [];
  const startHour = 9; // 9 AM
  const endHour = 21; // 9 PM
  const intervalMinutes = 15;
  
  let slotNumber = 1;
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Calculate end time (15 minutes later)
      let endHour = hour;
      let endMinute = minute + intervalMinutes;
      
      if (endMinute >= 60) {
        endHour++;
        endMinute -= 60;
      }
      
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
      
      slots.push({
        slotNumber,
        startTime,
        endTime
      });
      
      slotNumber++;
    }
  }
  
  return slots;
};

/**
 * Fixed time slots array (96 slots of 15 minutes each)
 */
export const FIXED_TIME_SLOTS = generateTimeSlots();

/**
 * Time block definitions for UI grouping
 * Groups 8 consecutive 15-minute slots into 2-hour blocks
 */
export const TIME_BLOCKS = [
  { label: '9:00 AM - 11:00 AM', startSlot: 1, endSlot: 8, startTime: '09:00', endTime: '11:00' },
  { label: '11:00 AM - 1:00 PM', startSlot: 9, endSlot: 16, startTime: '11:00', endTime: '13:00' },
  { label: '1:00 PM - 3:00 PM', startSlot: 17, endSlot: 24, startTime: '13:00', endTime: '15:00' },
  { label: '3:00 PM - 5:00 PM', startSlot: 25, endSlot: 32, startTime: '15:00', endTime: '17:00' },
  { label: '5:00 PM - 7:00 PM', startSlot: 33, endSlot: 40, startTime: '17:00', endTime: '19:00' },
  { label: '7:00 PM - 9:00 PM', startSlot: 41, endSlot: 48, startTime: '19:00', endTime: '21:00' }
];

/**
 * Get slots for a specific time block
 * 
 * @param {number} blockIndex - Index of time block (0-5)
 * @returns {Array} Array of slot objects for that block
 */
export const getSlotsForBlock = (blockIndex) => {
  if (blockIndex < 0 || blockIndex >= TIME_BLOCKS.length) {
    return [];
  }
  
  const block = TIME_BLOCKS[blockIndex];
  return FIXED_TIME_SLOTS.filter(
    slot => slot.slotNumber >= block.startSlot && slot.slotNumber <= block.endSlot
  );
};

/**
 * Get time block for a given slot number
 * 
 * @param {number} slotNumber - Slot number (1-48)
 * @returns {Object|null} Time block object or null if not found
 */
export const getBlockForSlot = (slotNumber) => {
  return TIME_BLOCKS.find(
    block => slotNumber >= block.startSlot && slotNumber <= block.endSlot
  ) || null;
};

/**
 * Format time for display (convert 24h to 12h format)
 * 
 * @param {string} time - Time in HH:MM format
 * @returns {string} Time in 12-hour format with AM/PM
 */
export const formatTime12Hour = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export default {
  FIXED_TIME_SLOTS,
  TIME_BLOCKS,
  getSlotsForBlock,
  getBlockForSlot,
  formatTime12Hour
};
