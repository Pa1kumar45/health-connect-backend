/**
 * Verify Admin Account Script
 * Checks if admin exists and verifies password hashing
 * Usage: node src/scripts/verifyAdmin.js
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

dotenv.config();

const verifyAdmin = async () => {
  try {
    console.log('[INFO] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[SUCCESS] Connected to MongoDB\n');

    const email = 'admin@healthconnect.com';
    const testPassword = 'admin123';

    // Find admin with password field
    const admin = await Admin.findOne({ email }).select('+password');

    if (!admin) {
      console.log(`[ERROR] Admin with email "${email}" not found!`);
      process.exit(1);
    }

    console.log('[INFO] Admin Account Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Name:       ${admin.name}`);
    console.log(`Email:      ${admin.email}`);
    console.log(`Role:       ${admin.role}`);
    console.log(`Active:     ${admin.isActive}`);
    console.log(`Created:    ${admin.createdAt}`);
    console.log(`Password:   ${admin.password.substring(0, 20)}...`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test password comparison using model method
    console.log('[INFO] Testing password verification...\n');
    const isValid = await admin.comparePassword(testPassword);
    console.log(`Test Password: "${testPassword}"`);
    console.log(`Result: ${isValid ? '[SUCCESS] VALID' : '[ERROR] INVALID'}\n`);

    // Also test direct bcrypt comparison
    const directCompare = await bcrypt.compare(testPassword, admin.password);
    console.log(`Direct bcrypt compare: ${directCompare ? '✅ VALID' : '❌ INVALID'}\n`);

    if (isValid && directCompare) {
      console.log('✅ Password verification is working correctly!');
      console.log('\n🔗 You can login at: http://localhost:5173/admin/login');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password: ${testPassword}`);
    } else {
      console.log('❌ Password verification failed!');
      console.log('💡 Run quickResetAdmin.js again to reset the password.');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

verifyAdmin();
