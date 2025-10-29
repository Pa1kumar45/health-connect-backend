/**
 * Appointment Reminder Scheduler
 *
 * This module handles automated appointment reminder emails.
 * It checks for upcoming appointments and sends reminder emails 15 minutes before.
 *
 * Features:
 * - Runs every minute to check for appointments
 * - Sends reminders 15 minutes before appointment time
 * - Prevents duplicate reminders
 * - Handles timezone considerations
 *
 * @module appointmentReminder
 */

import { Appointment } from '../models/Appointment.js';
import { sendAppointmentReminderEmail } from '../services/emailService.js';

/**
 * Check and send appointment reminders
 *
 * This function checks for appointments that are:
 * - Scheduled for today
 * - Starting in approximately 15 minutes
 * - In 'scheduled' status
 * - Haven't had a reminder sent yet
 */
export const checkAndSendReminders = async () => {
  try {
    const now = new Date();
    
    // Calculate time 15 minutes from now
    const reminderTime = new Date(now.getTime() + 15 * 60 * 1000);
    
    // Get today's date in YYYY-MM-DD format
    const todayStr = now.toISOString().split('T')[0];
    
    // Calculate time range (14-16 minutes from now to account for job frequency)
    const minTime = new Date(now.getTime() + 14 * 60 * 1000);
    const maxTime = new Date(now.getTime() + 16 * 60 * 1000);
    
    // Format times as HH:MM
    const minTimeStr = `${minTime.getHours().toString().padStart(2, '0')}:${minTime.getMinutes().toString().padStart(2, '0')}`;
    const maxTimeStr = `${maxTime.getHours().toString().padStart(2, '0')}:${maxTime.getMinutes().toString().padStart(2, '0')}`;
    
    console.log(`🔍 Checking for appointments between ${minTimeStr} and ${maxTimeStr} on ${todayStr}`);
    
    // Find appointments that need reminders
    const appointments = await Appointment.find({
      date: todayStr,
      status: 'scheduled',
      startTime: {
        $gte: minTimeStr,
        $lte: maxTimeStr
      },
      reminderSent: { $ne: true } // Only get appointments without reminder sent
    })
      .populate('doctorId', 'name specialization')
      .populate('patientId', 'name email');
    
    console.log(`📧 Found ${appointments.length} appointments needing reminders`);
    
    // Send reminder emails
    for (const appointment of appointments) {
      try {
        // Format date for email
        const dateObj = new Date(appointment.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        // Send reminder email
        const result = await sendAppointmentReminderEmail({
          patientEmail: appointment.patientId.email,
          patientName: appointment.patientId.name,
          doctorName: appointment.doctorId.name,
          doctorSpecialization: appointment.doctorId.specialization,
          appointmentDate: formattedDate,
          appointmentTime: `${appointment.startTime} - ${appointment.endTime}`,
        });
        
        if (result.success) {
          // Mark reminder as sent
          appointment.reminderSent = true;
          await appointment.save();
          console.log(`✅ Reminder sent for appointment ${appointment._id}`);
        } else {
          console.error(`⚠️ Failed to send reminder for appointment ${appointment._id}:`, result.message);
        }
      } catch (error) {
        console.error(`❌ Error sending reminder for appointment ${appointment._id}:`, error);
        // Continue with other appointments even if one fails
      }
    }
  } catch (error) {
    console.error('❌ Error in checkAndSendReminders:', error);
  }
};

/**
 * Start the appointment reminder scheduler
 *
 * Runs checkAndSendReminders every minute to catch appointments
 * that need reminders sent.
 *
 * @param {number} intervalMinutes - How often to check (default: 1 minute)
 * @returns {NodeJS.Timeout} Interval reference
 */
export const startAppointmentReminderScheduler = (intervalMinutes = 1) => {
  console.log(`⏰ Appointment reminder scheduler started (checking every ${intervalMinutes} minute(s))`);
  
  // Run immediately on startup
  checkAndSendReminders().catch(console.error);
  
  // Then run at specified interval
  const interval = setInterval(() => {
    checkAndSendReminders().catch(console.error);
  }, intervalMinutes * 60 * 1000);
  
  return interval;
};

export default {
  checkAndSendReminders,
  startAppointmentReminderScheduler,
};
