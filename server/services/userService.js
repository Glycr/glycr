const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Payout = require('../models/Payout');
const Refund = require('../models/Refund');
const Waitlist = require('../models/Waitlist');
const Favorite = require('../models/Favorite');
const Review = require('../models/Review');
const config = require('../config');
const { AppError } = require('../utils/appError');
const { logger } = require('../config/logger');
const { sendEmail } = require('./notificationService');
const { escapeHtml } = require('../utils/htmlSecurity');
const { isObjectIdString } = require('../utils/validators');

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class UserService {
  async register(userData) {
    const { name, email, password, phone, username, isOrganizer, acceptedTerms } = userData;

    const normalizedEmail = String(email || '').toLowerCase().trim();
    if (!normalizedEmail) throw new AppError('Email is required', 400);

    const existingEmail = await User.findOne({
      email: { $regex: `^${escapeRegex(normalizedEmail)}$`, $options: 'i' },
    }).select('_id').lean();
    if (existingEmail) throw new AppError('Email already registered', 409);

    const normalizedUsername = String(username || '').toLowerCase().trim();
    if (normalizedUsername) {
      const existingUsername = await User.findOne({ username: normalizedUsername }).select('_id').lean();
      if (existingUsername) throw new AppError('Username already taken', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // role and isOrganizer must always agree — the frontend, JWT and payout
    // checks all read isOrganizer.
    const isOrg = isOrganizer === true;
    const role = isOrg ? 'organizer' : 'customer';

    const user = new User({
      name,
      email: normalizedEmail,
      username: normalizedUsername || undefined,
      password: hashedPassword,
      phone,
      role,
      isOrganizer: isOrg,
      termsAcceptedAt: acceptedTerms ? new Date() : null,
    });

    try {
      await user.save();
    } catch (err) {
      if (err.code === 11000) {
        if (err.keyPattern?.email)    throw new AppError('Email already registered', 409);
        if (err.keyPattern?.username) throw new AppError('Username already taken', 409);
        throw new AppError('User already exists', 409);
      }
      throw err;
    }

    const welcomeHtml = `
  <h1>Welcome to Glycr, ${escapeHtml(user.name)}!</h1>
  <p>You've successfully created an account on Ghana's premier event ticketing platform.</p>
  <p>Start exploring events and discover amazing experiences.</p>
  <p><a href="${process.env.FRONTEND_URL}">Get started</a></p>
`;
    sendEmail(user.email, 'Welcome to Glycr!', welcomeHtml)
      .catch((e) => logger.error('Welcome email failed', { err: e.message }));

    const { password: _pw, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword;
  }

  async login(identifier, password) {
    const trimmed = String(identifier || '').trim();
    const lower = trimmed.toLowerCase();
    if (!lower) throw new AppError('Invalid credentials', 401);

    const escaped = escapeRegex(trimmed);
    const user = await User.findOne({
      $or: [
        { email: { $regex: `^${escaped}$`, $options: 'i' } },
        { username: lower },
      ],
    }).select('+password');   // needed because User.password has select: false

    if (!user) throw new AppError('Invalid credentials', 401);
    if (user.suspended) throw new AppError('Account suspended', 403);

    const isPrivileged = user.role === 'admin' || user.role === 'moderator';

    if (
      isPrivileged &&
      user.failedLoginAttempts > 0 &&
      user.lockUntil &&
      user.lockUntil <= new Date()
    ) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
    }

    if (isPrivileged && user.isLocked) {
      throw new AppError(
        `Account temporarily locked. Try again after ${user.lockUntil.toLocaleTimeString()}`,
        423
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      if (isPrivileged) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 3) {
          user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
          await user.save();
          throw new AppError('Too many failed attempts. Account locked for 15 minutes.', 423);
        }
        await user.save();
      }
      throw new AppError('Invalid credentials', 401);
    }

    if (isPrivileged) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    // Self-deactivated accounts come back to life on a successful sign-in.
    // This sits AFTER the password check so a wrong password can never
    // reactivate someone else's account. `suspended` (admin action) was
    // already rejected above and is never cleared here.
    let reactivated = false;
    if (user.deactivatedAt) {
      await User.updateOne({ _id: user._id }, { $set: { deactivatedAt: null } });
      user.deactivatedAt = null;
      reactivated = true;
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        isOrganizer: user.isOrganizer,
        isAdmin: user.isAdmin,
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    const userObj = user.toObject({ virtuals: true });
    delete userObj.password;
    return { token, user: userObj, reactivated };
  }

  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    const userObj = user.toObject({ virtuals: true });
    delete userObj.password;
    return userObj;
  }

  async updateProfile(userId, updates) {
    const ALLOWED = ['name', 'phone', 'avatar', 'bio', 'email', 'username'];
    const clean = Object.fromEntries(
      Object.entries(updates || {}).filter(([k]) => ALLOWED.includes(k))
    );

    if (clean.email !== undefined) {
      const normalizedEmail = String(clean.email || '').toLowerCase().trim();
      if (!normalizedEmail) throw new AppError('Email cannot be empty', 400);
      const existing = await User.findOne({
        email: { $regex: `^${escapeRegex(normalizedEmail)}$`, $options: 'i' },
        _id: { $ne: userId },
      }).select('_id').lean();
      if (existing) throw new AppError('Email already in use', 409);
      clean.email = normalizedEmail;
    }

    if (clean.username !== undefined) {
      const normalizedUsername = clean.username ? String(clean.username).toLowerCase().trim() : null;
      if (normalizedUsername) {
        const existing = await User.findOne({
          username: normalizedUsername,
          _id: { $ne: userId },
        }).select('_id').lean();
        if (existing) throw new AppError('Username already taken', 409);
      }
      clean.username = normalizedUsername;
    }

    try {
      const user = await User.findByIdAndUpdate(userId, clean, {
        returnDocument: 'after',
        runValidators: true,
      }).select('-password');
      if (!user) throw new AppError('User not found', 404);
      return user;
    } catch (err) {
      if (err.code === 11000) {
        if (err.keyPattern?.email)    throw new AppError('Email already in use', 409);
        if (err.keyPattern?.username) throw new AppError('Username already taken', 409);
        throw new AppError('Duplicate value', 409);
      }
      throw err;
    }
  }

  async changeRole(userId, newRole) {
    const allowedRoles = ['customer', 'organizer', 'moderator', 'admin'];
    if (!allowedRoles.includes(newRole)) throw new AppError('Invalid role', 400);
    // Keep the boolean flags in step with `role`, otherwise they drift apart
    // (the frontend and JWT read isOrganizer / isAdmin, not role).
    const user = await User.findByIdAndUpdate(
      userId,
      { role: newRole, isOrganizer: newRole === 'organizer', isAdmin: newRole === 'admin' },
      { returnDocument: 'after' }
    ).select('-password');
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  async getAllUsers(filters = {}) {
    const query = {};
    if (filters.isOrganizer !== undefined) query.isOrganizer = filters.isOrganizer;
    if (filters.suspended !== undefined) query.suspended = filters.suspended;
    // 👇 the line Claude was talking about
    if (filters.deactivated !== undefined) {
      query.deactivatedAt = filters.deactivated ? { $ne: null } : null;
    }
    if (filters.role) query.role = filters.role;
    if (typeof filters.search === 'string' && filters.search.trim()) {
      const rx = new RegExp(escapeRegex(filters.search.trim().slice(0, 100)), 'i');
      query.$or = [{ name: rx }, { email: rx }, { username: rx }];
    }
    return User.find(query).select('-password');
  }

  async generatePasswordResetToken(email) {
    const trimmed = String(email || '').trim();
    if (!trimmed) return null;

    const user = await User.findOne({
      email: { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' },
    });
    if (!user) return null;

    const token = jwt.sign(
      { userId: user._id, type: 'reset' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    return { token, user };
  }

  async resetPassword(token, newPassword) {
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch {
      throw new AppError('Invalid or expired token', 400);
    }

    if (decoded.type !== 'reset') throw new AppError('Invalid or expired token', 400);

    const user = await User.findById(decoded.userId);
    if (!user) throw new AppError('Invalid or expired token', 400);

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();
    await user.save();

    const confirmHtml = `
      <h2>Password changed successfully</h2>
      <p>Your Glycr account password has been changed.</p>
      <p>If you did not perform this action, please contact support immediately.</p>
    `;
    sendEmail(user.email, 'Your Glycr password has been reset', confirmHtml)
      .catch((e) => logger.error('Reset confirmation email failed', { err: e.message }));

    const userObj = user.toObject({ virtuals: true });
    delete userObj.password;
    return userObj;
  }

  async suspendUser(userId) {
    const user = await User.findByIdAndUpdate(userId, { suspended: true }, { returnDocument: 'after' }).select('-password');
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  async unsuspendUser(userId) {
    const user = await User.findByIdAndUpdate(userId, { suspended: false }, { returnDocument: 'after' }).select('-password');
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');   // needed to read current hash
    if (!user) throw new AppError('User not found', 404);

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError('Current password is incorrect', 401);

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();
    await user.save();

    const userObj = user.toObject({ virtuals: true });
    delete userObj.password;
    return userObj;
  }

  // ── Self-service deactivation ──
  // Hides the account and its events and signs the user out everywhere.
  // Nothing is deleted: tickets, payouts and refunds stay intact, and signing
  // in again (see login) reactivates the account. Events stay unpublished
  // after reactivation, so the organizer republishes deliberately.
  async deactivateAccount(userId, password) {
    if (!password || typeof password !== 'string') {
      throw new AppError('Password is required', 400);
    }

    const user = await User.findById(userId).select('+password role deactivatedAt');
    if (!user) throw new AppError('User not found', 404);
    if (user.deactivatedAt) throw new AppError('Account is already deactivated', 409);
    if (user.role === 'admin' || user.role === 'moderator') {
      throw new AppError('Staff accounts cannot be deactivated here. Contact an administrator.', 403);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError('Password is incorrect', 401);

    // ── Don't strand buyers or money ──
    const ownedEvents = await Event.find({ organizerId: userId })
      .select('_id isCancelled date')
      .lean();

    if (ownedEvents.length > 0) {
      const now = new Date();
      const upcomingIds = ownedEvents
        .filter((e) => !e.isCancelled && new Date(e.date) > now)
        .map((e) => e._id);

      if (upcomingIds.length > 0) {
        const liveTickets = await Ticket.exists({
          eventId: { $in: upcomingIds },
          status: { $in: ['active', 'refund_pending'] },
        });
        if (liveTickets) {
          throw new AppError(
            'You have upcoming events with tickets sold. Cancel those events (buyers are refunded automatically) or wait until they finish before deactivating.',
            409
          );
        }
      }

      const unresolvedRefunds = await Refund.exists({
        eventId: { $in: ownedEvents.map((e) => e._id) },
        status: { $in: ['pending', 'approved'] },
      });
      if (unresolvedRefunds) {
        throw new AppError('You have refund requests waiting for a decision. Resolve them before deactivating.', 409);
      }
    }

    const payoutInProgress = await Payout.exists({
      organizerId: userId,
      status: { $in: ['pending', 'approved'] },
    });
    if (payoutInProgress) {
      throw new AppError('You have a payout in progress. Wait for it to complete before deactivating.', 409);
    }

    // passwordChangedAt = now makes the auth middleware reject every token
    // issued before this moment (other devices, stolen sessions).
    const now = new Date();
    await User.updateOne({ _id: userId }, { $set: { deactivatedAt: now, passwordChangedAt: now } });

    // Hide their events. publishAt is cleared too, otherwise the scheduler
    // would flip a scheduled draft back to published after deactivation.
    await Event.updateMany({ organizerId: userId }, { $set: { isPublished: false, publishAt: null } });

    const goodbyeHtml = `
      <h2>Your Glycr account has been deactivated</h2>
      <p>Hi ${escapeHtml(user.name || '')}, your account and any events you organise are now hidden.</p>
      <p>Your tickets, payouts and history are kept. To reactivate, simply sign in again.</p>
      <p>If you didn't do this, reset your password straight away.</p>
      <p>– Glycr Team</p>
    `;
    User.findById(userId).select('email').lean()
      .then((u) => u && sendEmail(u.email, 'Your Glycr account has been deactivated', goodbyeHtml))
      .catch((e) => logger.error('Deactivation email failed', { err: e.message }));

    return { deactivated: true };
  }

  // ── Full cascade delete — everything attached to this user ──
  // Called by adminService.deleteUser (after permission check) and by
  // userController.deleteUser (also after permission check upstream).
  // Returns { deleted: true, unresolvedRefunds } so the caller can audit.
  async deleteUser(userId) {
    if (!userId) throw new AppError('userId is required', 400);

    const target = await User.findById(userId);
    if (!target) throw new AppError('User not found', 404);

    // Events this user organized — for cross-user cleanup
    const ownedEvents = await Event.find({ organizerId: userId }).select('_id').lean();
    const ownedEventIds = ownedEvents.map((e) => e._id);

    // Warn (don't block) if there are unresolved refunds
    const refundFilter = {
      status: { $in: ['pending', 'approved'] },
      $or: [
        { userId },
        ...(ownedEventIds.length > 0 ? [{ eventId: { $in: ownedEventIds } }] : []),
      ],
    };
    const unresolvedRefunds = await Refund.countDocuments(refundFilter);
    if (unresolvedRefunds > 0) {
      logger.warn('User deleted with unresolved refunds', {
        userId: userId.toString(),
        email: target.email,
        unresolvedRefunds,
      });
    }

    await User.findByIdAndDelete(userId);

    // Everything attached to events this user organized
    if (ownedEventIds.length > 0) {
      await Event.deleteMany({ _id: { $in: ownedEventIds } });
      await Ticket.deleteMany({ eventId: { $in: ownedEventIds } });
      await Favorite.deleteMany({ eventId: { $in: ownedEventIds } });
      await Waitlist.deleteMany({ eventId: { $in: ownedEventIds } });
      await Refund.deleteMany({ eventId: { $in: ownedEventIds } });
      await Review.deleteMany({ eventId: { $in: ownedEventIds } });
    }

    // The user's own activity
    await Ticket.deleteMany({ userId });
    await Favorite.deleteMany({ userId });
    await Payout.deleteMany({ organizerId: userId });
    await Refund.deleteMany({ userId });
    await Waitlist.deleteMany({ email: target.email });
    await Review.deleteMany({ userId });

    return { deleted: true, unresolvedRefunds };
  }

  // ── Toggle favorite — business logic that was previously in userController ──
  async toggleFavorite(userId, eventId, action) {
    if (!userId) throw new AppError('userId is required', 400);
    if (!isObjectIdString(eventId)) throw new AppError('Invalid event', 400);
    if (!['add', 'remove'].includes(action)) {
      throw new AppError('action must be "add" or "remove"', 400);
    }

    if (action === 'add') {
      const exists = await Event.exists({ _id: eventId });
      if (!exists) throw new AppError('Event not found', 404);
      await Favorite.findOneAndUpdate(
        { userId, eventId },
        { userId, eventId },
        { upsert: true, returnDocument: 'after' }
      );
    } else {
      await Favorite.findOneAndDelete({ userId, eventId });
    }

    return { success: true };
  }

  async getFavorites(userId) {
    if (!userId) throw new AppError('userId is required', 400);
    const rows = await Favorite.find({ userId }).select('eventId').lean();
    return rows.map((f) => String(f.eventId));
  }
}

module.exports = new UserService();
