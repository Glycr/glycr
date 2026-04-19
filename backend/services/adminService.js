const User = require('../models/User');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Payout = require('../models/Payout');
const bcrypt = require('bcryptjs');

class AdminService {
  // ---------- Dashboard ----------
  async getStats() {
    const [allUsers, allEvents, allTickets, allPayouts] = await Promise.all([
      User.find(),
      Event.find(),
      Ticket.find(),
      Payout.find(),
    ]);

    const totalRevenue = allTickets.reduce((sum, t) => sum + t.price, 0);
    const liveEvents = allEvents.filter(e => e.isPublished && !e.isCancelled && new Date(e.date) > new Date()).length;
    const flaggedEvents = allEvents.filter(e => e.flagged).length;
    const pendingPayouts = allPayouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
    const totalOrganizers = allUsers.filter(u => u.role === 'organizer').length;

    return {
      totalUsers: allUsers.length,
      totalOrganizers,
      totalEvents: allEvents.length,
      liveEvents,
      totalRevenue,
      pendingPayouts,
      totalTickets: allTickets.length,
      flaggedEvents,
    };
  }

  // ---------- Users ----------
  async getAllUsers() {
    const users = await User.find().select('-password');
    return users.map(u => u.toObject({ virtuals: true }));
  }

  async suspendUser(adminUserId, targetUserId) {
    const admin = await User.findById(adminUserId);
    const target = await User.findById(targetUserId);
    if (!target) throw new Error('User not found');

    if (admin.role === 'moderator' && (target.role === 'admin' || target.role === 'moderator')) {
      throw new Error('Moderators cannot suspend admin or moderator accounts');
    }
    target.suspended = !target.suspended;
    await target.save();
    const { password, ...safeUser } = target.toObject({ virtuals: true });
    return safeUser;
  }

  async deleteUser(adminUserId, targetUserId) {
    const admin = await User.findById(adminUserId);
    const target = await User.findById(targetUserId);
    if (!target) throw new Error('User not found');

    if (admin.role === 'moderator' && (target.role === 'admin' || target.role === 'moderator')) {
      throw new Error('Moderators cannot delete admin or moderator accounts');
    }
    await User.findByIdAndDelete(targetUserId);
    // Delete related data
    await Event.deleteMany({ organizerId: targetUserId });
    await Ticket.deleteMany({ userId: targetUserId });
    await Payout.deleteMany({ organizerId: targetUserId });
    return true;
  }

  async createUser(userData) {
    const { name, email, password, phone, role } = userData;
    const existing = await User.findOne({ email });
    if (existing) throw new Error('User already exists');

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone: phone || '',
      role: role || 'customer',
      isOrganizer: role === 'organizer',
      isAdmin: role === 'admin',
      suspended: false,
      currency: 'GHC',
    });
    await newUser.save();

    const { password: _, ...userWithoutPassword } = newUser.toObject({ virtuals: true });
    return userWithoutPassword;
  }

  async updateUser(userId, updateData, requestingUserRole) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Only admin can change role
    if (updateData.role && updateData.role !== user.role && requestingUserRole !== 'admin') {
      throw new Error('Only admins can change user roles');
    }

    if (updateData.name) user.name = updateData.name;
    if (updateData.email) user.email = updateData.email;
    if (updateData.phone) user.phone = updateData.phone;
    if (updateData.role) {
      user.role = updateData.role;
      user.isOrganizer = updateData.role === 'organizer';
      user.isAdmin = updateData.role === 'admin';
    }
    if (updateData.suspended !== undefined) {
      user.suspended = updateData.suspended === 'true' || updateData.suspended === true;
    }

    await user.save();
    const { password, ...userWithoutPassword } = user.toObject({ virtuals: true });
    return userWithoutPassword;
  }

  // ---------- Events ----------
  async getAllEvents() {
    const events = await Event.find().populate('organizerId', '-password');
    return events.map(e => e.toObject({ virtuals: true }));
  }

  async flagEvent(eventId) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error('Event not found');
    event.flagged = !event.flagged;
    await event.save();
    return event;
  }

  async deleteEvent(eventId) {
    const event = await Event.findByIdAndDelete(eventId);
    if (!event) throw new Error('Event not found');
    await Ticket.deleteMany({ eventId });
    return true;
  }

  // ---------- Tickets ----------
  async getAllTickets() {
    const tickets = await Ticket.find().populate('eventId', 'title').populate('userId', 'name email');
    return tickets;
  }

  // ---------- Payouts ----------
  async getAllPayouts() {
    const payouts = await Payout.find().populate('organizerId', 'name email');
    return payouts;
  }

  async approvePayout(payoutId) {
    const payout = await Payout.findById(payoutId);
    if (!payout) throw new Error('Payout not found');
    if (payout.status !== 'pending') throw new Error('Payout already processed');
    payout.status = 'completed';
    payout.completedAt = new Date();
    await payout.save();
    return payout;
  }

  async rejectPayout(payoutId, reason) {
    const payout = await Payout.findById(payoutId);
    if (!payout) throw new Error('Payout not found');
    if (payout.status !== 'pending') throw new Error('Payout already processed');
    payout.status = 'rejected';
    payout.rejectionReason = reason;
    await payout.save();
    return payout;
  }
}

module.exports = new AdminService();
