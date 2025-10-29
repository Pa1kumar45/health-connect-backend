/**
 * Script to recreate MongoDB collections with proper indexes
 * Run this after deleting collections to ensure proper database structure
 *
 * Usage: node src/scripts/recreateCollections.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import Session from '../models/Session.js';
import OTP from '../models/OTP.js';
import AuthLog from '../models/AuthLog.js';
import AdminActionLog from '../models/AdminActionLog.js';

// Load environment variables
dotenv.config();

const recreateCollections = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n📋 Recreating collections and indexes...\n');

    // Create indexes for all models
    const models = [
      { name: 'Doctor', model: Doctor },
      { name: 'Patient', model: Patient },
      { name: 'Session', model: Session },
      { name: 'OTP', model: OTP },
      { name: 'AuthLog', model: AuthLog },
      { name: 'AdminActionLog', model: AdminActionLog },
    ];

    // Create indexes for all models in sequence
    await models.reduce(async (previousPromise, { name, model }) => {
      await previousPromise;
      try {
        console.log(`📦 Creating ${name} collection...`);

        // Create collection if it doesn't exist
        await model.createCollection();

        // Ensure all indexes are created
        await model.createIndexes();

        console.log(`✅ ${name} collection created with indexes`);
      } catch (error) {
        if (error.code === 48) {
          // Collection already exists
          console.log(`ℹ️  ${name} collection already exists, ensuring indexes...`);
          await model.syncIndexes();
        } else {
          console.error(`❌ Error creating ${name}:`, error.message);
        }
      }
    }, Promise.resolve());

    console.log('\n✅ All collections and indexes created successfully!');
    console.log('\n📊 Database structure:');

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    collections.forEach((col) => {
      console.log(`   - ${col.name}`);
    });

    console.log('\n✨ Database is ready for use!');
  } catch (error) {
    console.error('❌ Error recreating collections:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
recreateCollections();
