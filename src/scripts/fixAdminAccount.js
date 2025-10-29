import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

dotenv.config();

const fixAdminAccount = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Update the existing admin to set isActive = true
    const result = await Admin.updateMany(
      { email: 'admin@healthconnect.com' },
      { $set: { isActive: true } },
    );

    console.log('\n✅ Admin account fixed!');
    console.log('Updated', result.modifiedCount, 'admin account(s)');
    console.log('\n📧 You can now login with:');
    console.log('   Email: admin@healthconnect.com');
    console.log('   Password: #1ap@NITK');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

fixAdminAccount();
