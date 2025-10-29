/**
 * Test Script for Appointment Reminder Email
 * 
 * This script:
 * 1. Creates a test appointment 15 minutes from now
 * 2. Sends a test reminder email immediately
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Appointment } from '../models/Appointment.js';
import { Patient } from '../models/Patient.js';
import { Doctor } from '../models/Doctor.js';
import { sendAppointmentReminderEmail } from '../services/emailService.js';

dotenv.config();

const testAppointmentReminder = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get current time and calculate 15 minutes from now
    const now = new Date();
    const reminderTime = new Date(now.getTime() + 15 * 60 * 1000);
    
    const todayStr = now.toISOString().split('T')[0];
    const startTime = `${reminderTime.getHours().toString().padStart(2, '0')}:${reminderTime.getMinutes().toString().padStart(2, '0')}`;
    const endTimeDate = new Date(reminderTime.getTime() + 15 * 60 * 1000);
    const endTime = `${endTimeDate.getHours().toString().padStart(2, '0')}:${endTimeDate.getMinutes().toString().padStart(2, '0')}`;

    console.log('⏰ Current Time:', now.toLocaleTimeString());
    console.log('⏰ Test Appointment Time:', startTime, '-', endTime);
    console.log('📅 Date:', todayStr, '\n');

    // Find specific patient by email and any doctor from database
    const patient = await Patient.findOne({ email: 'udayramkarella@gmail.com' });
    const doctor = await Doctor.findOne();

    if (!patient || !doctor) {
      console.error('❌ Need at least one patient and one doctor in database');
      return;
    }

    console.log('👤 Patient:', patient.name, '(', patient.email, ')');
    console.log('👨‍⚕️ Doctor:', doctor.name, '-', doctor.specialization, '\n');

    // Check if test appointment already exists
    let appointment = await Appointment.findOne({
      patientId: patient._id,
      doctorId: doctor._id,
      date: todayStr,
      startTime: startTime,
      status: 'scheduled'
    });

    if (appointment) {
      console.log('📋 Found existing test appointment:', appointment._id);
      // Reset reminderSent flag for testing
      appointment.reminderSent = false;
      await appointment.save();
      console.log('🔄 Reset reminderSent flag\n');
    } else {
      // Create a test appointment
      appointment = new Appointment({
        patientId: patient._id,
        doctorId: doctor._id,
        date: todayStr,
        startTime: startTime,
        endTime: endTime,
        slotNumber: 1, // Dummy slot number
        reason: 'TEST REMINDER - This is a test appointment',
        status: 'scheduled',
        mode: 'video',
        reminderSent: false
      });

      await appointment.save();
      console.log('✅ Created test appointment:', appointment._id, '\n');
    }

    // Format date for email
    const dateObj = new Date(appointment.date);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log('📧 Sending test reminder email...\n');

    // Send reminder email
    const result = await sendAppointmentReminderEmail({
      patientEmail: patient.email,
      patientName: patient.name,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization,
      appointmentDate: formattedDate,
      appointmentTime: `${appointment.startTime} - ${appointment.endTime}`,
    });

    if (result.success) {
      console.log('✅ Reminder email sent successfully!');
      console.log('📬 Check inbox:', patient.email);
      console.log('📧 Message ID:', result.info?.messageId);
      
      // Mark reminder as sent
      appointment.reminderSent = true;
      await appointment.save();
      console.log('✅ Marked reminder as sent in database');
    } else {
      console.error('❌ Failed to send reminder email:', result.message);
    }

    console.log('\n📋 Test Appointment Details:');
    console.log('   ID:', appointment._id);
    console.log('   Date:', appointment.date);
    console.log('   Time:', appointment.startTime, '-', appointment.endTime);
    console.log('   Patient:', patient.name);
    console.log('   Doctor:', doctor.name);
    console.log('   Reminder Sent:', appointment.reminderSent);

    console.log('\n💡 To delete this test appointment, run:');
    console.log(`   db.appointments.deleteOne({ _id: ObjectId("${appointment._id}") })`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
};

testAppointmentReminder();
