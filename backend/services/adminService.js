const User = require('../models/User');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Payout = require('../models/Payout');
const bcrypt = require('bcryptjs');
const Waitlist = require('../models/Waitlist');
const { sendEmail, sendSMS } = require('./notificationService');
const { v4: uuidv4 } = require('uuid');

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

  // ---------- Waitlist Management ----------
  async getAllWaitlists() {
    const entries = await Waitlist.find()
      .populate('eventId', 'title date')
      .sort({ joinedAt: -1 })
      .lean();

    // Filter out entries where the event was deleted
    return entries
      .filter(entry => entry.eventId != null)  // <-- add this
      .map(entry => ({
        id: entry._id.toString(),
        userId: null,
        userName: entry.name,
        userEmail: entry.email,
        userPhone: entry.phone,
        eventId: entry.eventId._id.toString(),
        eventTitle: entry.eventId.title,
        eventDate: entry.eventId.date,
        ticketType: entry.ticketType,
        position: entry.position,
        joinedAt: entry.joinedAt,
        notified: entry.notified,
      }));
  }

  async notifyWaitlistEntry(entryId, channel, message) {
    const entry = await Waitlist.findById(entryId).populate('eventId');
    if (!entry) throw new Error('Waitlist entry not found');

    if (channel === 'email' || channel === 'both') {
      await sendEmail(entry.email, 'Waitlist update', message);
    }
    if (channel === 'sms' || channel === 'both') {
      await sendSMS(entry.phone, message);
    }
    entry.notified = true;
    await entry.save();
    return { success: true };
  }

  async convertWaitlistToTicket(entryId, ticketType) {
    const entry = await Waitlist.findById(entryId).populate('eventId');
    if (!entry) throw new Error('Waitlist entry not found');

    const event = entry.eventId;

    // Access the Map correctly
    const ticketTypes = event.ticketTypes;
    if (!ticketTypes || !(ticketTypes instanceof Map)) {
      throw new Error('Event ticket types are corrupted');
    }

    // Normalize the requested ticket type (trim, lower case)
    const normalizedType = ticketType.trim().toLowerCase();

    // Find the actual key in the Map (case‑insensitive)
    let matchedKey = null;
    for (const [key, value] of ticketTypes.entries()) {
      if (key.toLowerCase() === normalizedType) {
        matchedKey = key;
        break;
      }
    }
    if (!matchedKey) {
      const available = Array.from(ticketTypes.keys()).join(', ');
      throw new Error(`Invalid ticket type. Received: "${ticketType}". Available: ${available}`);
    }

    const typeData = ticketTypes.get(matchedKey);
    if (typeData.sold >= typeData.capacity) throw new Error('Tickets sold out');

    // Find or create user
    let user = await User.findOne({ email: entry.email });
    if (!user) {
      user = new User({
        name: entry.name,
        email: entry.email,
        phone: entry.phone,
        password: await bcrypt.hash(Math.random().toString(36), 10),
        role: 'customer',
      });
      await user.save();
    }

    const ticketId = uuidv4();
    const ticket = new Ticket({
      id: ticketId,
      eventId: event._id,
      userId: user._id,
      ticketType: matchedKey, // use the original key from the Map
      price: typeData.price,
      userEmail: entry.email,
      userPhone: entry.phone,
      status: 'active',
      validated: false,
    });
    await ticket.save();

    // Update sold count and save event
    typeData.sold += 1;
    event.markModified('ticketTypes');
    await event.save();

    // Remove from waitlist
    await Waitlist.findByIdAndDelete(entryId);

    // Notifications (non-blocking)
    sendEmail(entry.email, `Your ticket for ${event.title}`, `<p>Ticket ID: ${ticketId}</p>`).catch(e => console.error(e));
    sendSMS(entry.phone, `Glycr: Your ${matchedKey} ticket is ready. ID: ${ticketId}`).catch(e => console.error(e));

    return { success: true, ticket: { id: ticket.id, ticketType: matchedKey } };
  }

  async deleteWaitlistEntry(entryId) {
    const result = await Waitlist.findByIdAndDelete(entryId);
    if (!result) throw new Error('Waitlist entry not found');
    return true;
  }
}

module.exports = new AdminService();
