/**
 * Reset Admin Password Script
 * Updates password for an existing admin account
 * Usage: node src/scripts/resetAdminPassword.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import readline from 'readline';
import Admin from '../models/Admin.js';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => {
  rl.question(query, resolve);
});

const resetAdminPassword = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // List all admins
    const admins = await Admin.find().select('email name');

    if (admins.length === 0) {
      console.log('❌ No admin accounts found in database!');
      console.log('💡 Create an admin first using: node src/scripts/createTestAdmin.js');
      process.exit(1);
    }

    console.log('📋 Available admin accounts:\n');
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.name} (${admin.email})`);
    });
    console.log('');

    // Get admin email
    const email = await question('Enter admin email to reset password: ');

    const admin = await Admin.findOne({ email: email.trim() });

    if (!admin) {
      console.log(`\n❌ Admin with email "${email}" not found!`);
      process.exit(1);
    }

    // Get new password
    const newPassword = await question('Enter new password: ');

    if (newPassword.length < 6) {
      console.log('\n❌ Password must be at least 6 characters long!');
      process.exit(1);
    }

    // Update password (will be hashed automatically by pre-save hook)
    admin.password = newPassword;
    await admin.save();

    console.log('\n✅ Password updated successfully!');
    console.log('\nYou can now login with:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: ${newPassword}`);
    console.log('\n🔗 Login at: http://localhost:5173/admin/login');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    rl.close();
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

resetAdminPassword();
