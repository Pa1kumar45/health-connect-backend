/**
 * Check Admin Accounts Script
 * Lists all admin accounts in the database
 * Usage: node src/scripts/checkAdmins.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

dotenv.config();

const checkAdmins = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const admins = await Admin.find().select('+password'); // Include password to show hash

    console.log(`📊 Found ${admins.length} admin(s) in database:\n`);

    if (admins.length === 0) {
      console.log('❌ No admin accounts found!');
      console.log('\n💡 You can create an admin using: node src/scripts/createTestAdmin.js');
    } else {
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. Admin Account:`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Name: ${admin.name}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   Status: ${admin.isActive ? '✅ Active' : '❌ Inactive'}`);
        console.log(`   Password Hash: ${admin.password}`);
        console.log(`   Created: ${admin.createdAt}\n`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

checkAdmins();
