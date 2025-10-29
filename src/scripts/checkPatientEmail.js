/**
 * Script to check patient email fields in database
 */

import mongoose from 'mongoose';
import { Patient } from '../models/Patient.js';
import dotenv from 'dotenv';

dotenv.config();

const checkPatientEmails = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the patient with ID from logs
    const patientId = '69006382f4e28342e560e415';
    const patient = await Patient.findById(patientId);

    if (!patient) {
      console.log('❌ Patient not found');
      return;
    }

    console.log('\n📋 Patient Document:');
    console.log('ID:', patient._id);
    console.log('Name:', patient.name);
    console.log('Email:', patient.email);
    console.log('Has email field:', patient.hasOwnProperty('email'));
    console.log('\n📄 Full Patient Object (selected fields):');
    console.log(JSON.stringify({
      _id: patient._id,
      name: patient.name,
      email: patient.email,
      contactNumber: patient.contactNumber,
      isEmailVerified: patient.isEmailVerified
    }, null, 2));

    // Check all patients
    console.log('\n📊 Checking all patients...');
    const allPatients = await Patient.find({});
    console.log(`Total patients: ${allPatients.length}`);
    
    allPatients.forEach((p, index) => {
      console.log(`\n${index + 1}. ${p.name}`);
      console.log(`   ID: ${p._id}`);
      console.log(`   Email: ${p.email || 'UNDEFINED'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
};

checkPatientEmails();
