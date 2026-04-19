const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const crypto = require('crypto');



class UserService {
  async register(userData) {
    const existing = await User.findOne({ email: userData.email });
    if (existing) throw new Error('User already exists');

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const role = userData.isOrganizer ? 'organizer' : 'customer';
    const user = new User({
      ...userData,
      password: hashedPassword,
      role,
    });
    await user.save();

    const { password, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword;
  }

  async login(email, password) {
    const user = await User.findOne({ email });
    if (!user) throw new Error('Invalid credentials');
    if (user.suspended) throw new Error('Account suspended');

    // Only apply lockout for admin/moderator
    const isPrivileged = user.role === 'admin' || user.role === 'moderator';

    // Check if account is locked (only for privileged roles)
    if (isPrivileged && user.isLocked) {
      const unlockTime = user.lockUntil;
      throw new Error(`Account temporarily locked. Try again after ${unlockTime.toLocaleTimeString()}`);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      if (isPrivileged) {
        // Increment failed attempts
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 3) {
          // Lock for 15 minutes
          user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
          await user.save();
          throw new Error('Too many failed attempts. Account locked for 15 minutes.');
        }
        await user.save();
      }
      throw new Error('Invalid credentials');
    }

    // Successful login – reset attempts and lock (if privileged)
    if (isPrivileged) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        isOrganizer: user.isOrganizer,
        isAdmin: user.isAdmin
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    const userObj = user.toObject({ virtuals: true });
    delete userObj.password;
    return { token, user: userObj };
  }



  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    const userObj = user.toObject({ virtuals: true });
    delete userObj.password;
    return userObj;
  }




  async updateProfile(userId, updates) {
    // Prevent role change via profile update
    delete updates.role;
    const user = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
    if (!user) throw new Error('User not found');
    return user;
  }

// New method to change role (admin only)
  async changeRole(userId, newRole) {
    const allowedRoles = ['customer', 'organizer', 'moderator', 'admin'];
    if (!allowedRoles.includes(newRole)) throw new Error('Invalid role');
    const user = await User.findByIdAndUpdate(userId, { role: newRole }, { new: true });
    if (!user) throw new Error('User not found');
    return user;
  }

  async getAllUsers(filters = {}) {
    let query = {};
    if (filters.isOrganizer !== undefined) query.isOrganizer = filters.isOrganizer;
    if (filters.suspended !== undefined) query.suspended = filters.suspended;
    const users = await User.find(query).select('-password');
    return users;
  }

  async generatePasswordResetToken(email) {
    const user = await User.findOne({ email });
    if (!user) throw new Error('User not found');

    const token = jwt.sign(
      { userId: user._id, type: 'reset' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    // Optionally store token in a separate collection – we'll rely on JWT self‑contained.
    return { token, user };
  }

  async resetPassword(token, newPassword) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      if (decoded.type !== 'reset') throw new Error('Invalid token type');

      const user = await User.findById(decoded.userId);
      if (!user) throw new Error('User not found');

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();
      return user;
    } catch (err) {
      throw new Error('Invalid or expired token');
    }
  }

  async suspendUser(userId) {
    const user = await User.findByIdAndUpdate(userId, { suspended: true }, { new: true }).select('-password');
    if (!user) throw new Error('User not found');
    return user;
  }

  async unsuspendUser(userId) {
    const user = await User.findByIdAndUpdate(userId, { suspended: false }, { new: true }).select('-password');
    if (!user) throw new Error('User not found');
    return user;
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new Error('Current password is incorrect');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    return user;
  }




}

module.exports = new UserService();
