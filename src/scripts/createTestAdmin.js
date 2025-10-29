import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

// Load environment variables
dotenv.config();

/**
 * Create Test Admin User
 * Run this script to create the first admin account
 *
 * Usage: npm run create-admin
 */
const createTestAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[SUCCESS] Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@healthconnect.com' });

    if (existingAdmin) {
      console.log('\n[WARNING] Admin user already exists!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Email:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      console.log('ID:', existingAdmin._id);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n[INFO] If you need to reset the password, delete this admin and run the script again.');
      await mongoose.connection.close();
      return;
    }

    // Create new admin
    const admin = await Admin.create({
      name: 'System Administrator',
      email: 'admin@healthconnect.com',
      password: '#1ap@NITK', // Change this password after first login!
      role: 'super_admin',
      isActive: true,
      permissions: [
        'manage_users',
        'verify_users',
        'suspend_users',
        'view_analytics',
        'manage_admins',
        'system_settings',
      ],
    });

    console.log('\n[SUCCESS] Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:', admin.email);
    console.log('Password: #1ap@NITK');
    console.log('Role:', admin.role);
    console.log('ID:', admin._id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n[WARNING] IMPORTANT: Change the password after first login!');
    console.log('\n[INFO] To login:');
    console.log('   POST http://localhost:5000/api/auth/admin/login');
    console.log('   Body: {');
    console.log('     "email": "admin@healthconnect.com",');
    console.log('     "password": "#1ap@NITK"');
    console.log('   }');
    console.log('\nOr use the frontend:');
    console.log('   1. Go to http://localhost:5173/login');
    console.log('   2. Login with admin credentials');
    console.log('   3. Navigate to http://localhost:5173/admin');

    await mongoose.connection.close();
    console.log('\n[SUCCESS] Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n[ERROR] Error creating admin:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
createTestAdmin();
