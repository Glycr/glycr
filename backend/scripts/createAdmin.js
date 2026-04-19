// scripts/createAdmin.js
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const adminEmail = 'admin@glycr.com';
    const plainPassword = 'admin123';   // Change this immediately after creation!

    let user = await User.findOne({ email: adminEmail });

    if (user) {
      // Update existing user
      user.isAdmin = true;
      user.role = 'admin';
      user.isOrganizer = false;

      // ←←← Bypass middleware here
      await user.save({ middleware: false });

      console.log('✅ Existing user updated to Admin (middleware bypassed)');
    } else {
      // Create new admin
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      user = new User({
        name: 'Admin User',
        email: adminEmail,
        password: hashedPassword,
        phone: '+233501234567',
        role: 'admin',
        isAdmin: true,
        isOrganizer: false,
      });

      // ←←← Bypass middleware here
      await user.save({ middleware: false });

      console.log('✅ New Admin user created successfully (middleware bypassed)');
      console.log(`   Email    : ${adminEmail}`);
      console.log(`   Password : ${plainPassword}  (CHANGE THIS NOW!)`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

createAdmin();
