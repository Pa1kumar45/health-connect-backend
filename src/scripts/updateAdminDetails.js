import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

dotenv.config();

/**
 * Update Admin Details
 * Updates the existing admin account with new credentials
 */
const updateAdminDetails = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the existing admin
    const existingAdmin = await Admin.findOne({ email: 'admin@healthconnect.com' });

    if (!existingAdmin) {
      console.log('\n❌ Admin not found! Creating new admin...');

      // Create new admin with updated details
      const newAdmin = await Admin.create({
        name: 'Adminppk',
        email: 'Adminppk@gmail.com',
        password: 'p12142005',
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

      console.log('\n✅ New admin created successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('👤 Name:', newAdmin.name);
      console.log('📧 Email:', newAdmin.email);
      console.log('🔑 Password: p12142005');
      console.log('👔 Role:', newAdmin.role);
      console.log('🆔 ID:', newAdmin._id);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      // Update existing admin details
      existingAdmin.name = 'Adminppk';
      existingAdmin.email = 'Adminppk@gmail.com';
      existingAdmin.password = 'p12142005'; // Will be hashed by pre-save middleware
      existingAdmin.isActive = true;

      await existingAdmin.save();

      console.log('\n✅ Admin details updated successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('👤 Name:', existingAdmin.name);
      console.log('📧 Email:', existingAdmin.email);
      console.log('🔑 Password: p12142005');
      console.log('👔 Role:', existingAdmin.role);
      console.log('🆔 ID:', existingAdmin._id);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    console.log('\n📝 Login Instructions:');
    console.log('   POST http://localhost:5000/api/auth/admin/login');
    console.log('   Body: {');
    console.log('     "email": "Adminppk@gmail.com",');
    console.log('     "password": "p12142005"');
    console.log('   }');
    console.log('\n🌐 Or use browser console:');
    console.log('   Run the login code with updated credentials');

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error updating admin:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
updateAdminDetails();
