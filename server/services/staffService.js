const Staff   = require('../models/Staff');
const ScanLog = require('../models/ScanLog');
const Ticket  = require('../models/Ticket');
const Event   = require('../models/Event');
const crypto  = require('crypto');
const mongoose = require('mongoose');  // <-- added

class StaffService {

  // ── Generate a unique 8-char staff ID ──────────────────────
  _genStaffId() {
    return 'S' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  // ── Check if an ID looks like a valid MongoDB ObjectId ──────
  _isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }

  // ── Get all event IDs owned by an organizer ─────────────────
  async _getOrganizerEventIds(organizerId) {
    const events = await Event.find({ organizerId }).select('_id').lean();
    return events.map(e => e._id);
  }

  // ── Assert an event exists and belongs to the organizer ─────
  async _requireOrganizerEvent(eventId, organizerId) {
    const event = await Event.findOne({ _id: eventId, organizerId });
    if (!event) {
      const err = new Error('Event not found or not yours');
      err.statusCode = 403;
      throw err;
    }
    return event;
  }

  // ── Create staff member ────────────────────────────────────
  async createStaff(organizerId, data) {
    const { name, email, phone, role, eventId, pin } = data;

    if (!name || !email || !eventId) {
      const err = new Error('name, email and eventId are required');
      err.statusCode = 400;
      throw err;
    }

    await this._requireOrganizerEvent(eventId, organizerId);

    const staffId = this._genStaffId();
    const staff   = new Staff({ staffId, name, email, phone, role, eventId, organizerId, pin: pin || null });
    await staff.save();
    return staff;
  }

  // ── List staff for an organizer (optionally filtered by event) ──
  async listStaff(organizerId, eventId = null) {
    const query = { organizerId };
    if (eventId) query.eventId = eventId;
    return Staff.find(query).sort({ createdAt: -1 }).lean();
  }

  // ── Get single staff by ID (scoped to organizer) ────────────
  async getStaff(staffIdOrId, organizerId) {
    const conditions = [{ staffId: staffIdOrId }];
    if (this._isValidObjectId(staffIdOrId)) {
      conditions.push({ _id: staffIdOrId });
    }

    const staff = await Staff.findOne({ $or: conditions, organizerId });
    if (!staff) {
      const err = new Error('Staff member not found');
      err.statusCode = 404;
      throw err;
    }
    return staff;
  }

  // ── Update status (active / inactive) ──────────────────────
  async setStatus(staffIdOrId, organizerId, status) {
    if (!['active', 'inactive'].includes(status)) {
      const err = new Error('status must be active or inactive');
      err.statusCode = 400;
      throw err;
    }

    const conditions = [{ staffId: staffIdOrId }];
    if (this._isValidObjectId(staffIdOrId)) {
      conditions.push({ _id: staffIdOrId });
    }

    const staff = await Staff.findOneAndUpdate(
      { $or: conditions, organizerId },
      { status },
      { new: true }
    );
    if (!staff) {
      const err = new Error('Staff member not found');
      err.statusCode = 404;
      throw err;
    }
    return staff;
  }

  // ── Delete staff ────────────────────────────────────────────
  async deleteStaff(staffIdOrId, organizerId) {
    const conditions = [{ staffId: staffIdOrId }];
    if (this._isValidObjectId(staffIdOrId)) {
      conditions.push({ _id: staffIdOrId });
    }

    const staff = await Staff.findOne({ $or: conditions, organizerId });
    if (!staff) {
      const err = new Error('Staff member not found');
      err.statusCode = 404;
      throw err;
    }
    await staff.deleteOne();
    return true;
  }

  // ── Validate a ticket ───────────────────────────────────────
  //   Returns { result, ticket, scanLog }
  //   result: 'valid' | 'already_used' | 'invalid' | 'wrong_event'
  async validateTicket({ ticketId, eventId, organizerId, scannedById, staffId, staffName, method, device, ip }) {
    const ticket = await Ticket.findOne({ id: ticketId });

    if (!ticket) {
      await this._log({ ticketId, eventId, organizerId, scannedById, staffId, staffName,
        method, device, ip, result: 'invalid', ticket: null });
      return { result: 'invalid', message: 'Ticket not found.' };
    }

    if (String(ticket.eventId) !== String(eventId)) {
      await this._log({ ticketId, eventId, organizerId, scannedById, staffId, staffName,
        method, device, ip, result: 'wrong_event', ticket });
      return { result: 'wrong_event', message: 'This ticket is for a different event.' };
    }

    if (ticket.status === 'used' || ticket.validated) {
      await this._log({ ticketId, eventId, organizerId, scannedById, staffId, staffName,
        method, device, ip, result: 'already_used', ticket });
      return { result: 'already_used', message: 'This ticket has already been used.', ticket };
    }

    ticket.status    = 'used';
    ticket.validated = true;
    await ticket.save();

    const log = await this._log({ ticketId, eventId, organizerId, scannedById, staffId, staffName,
      method, device, ip, result: 'valid', ticket });

    return { result: 'valid', message: 'Ticket validated successfully.', ticket, scanLog: log };
  }

  // ── Internal log writer ─────────────────────────────────────
  async _log({ ticketId, eventId, organizerId, scannedById, staffId, staffName, method, device, ip, result, ticket }) {
    try {
      const ticketRef = ticket?._id || (await Ticket.findOne({ id: ticketId })?._id);
      if (!ticketRef) return null;

      const log = new ScanLog({
        ticketId,
        ticketRef,
        eventId,
        organizerId,
        scannedById:   scannedById || null,
        staffId:       staffId     || null,
        scannedByName: staffName   || 'organizer',
        method:        method      || 'manual',
        result,
        device:        device      || null,
        ipAddress:     ip          || null,
        buyerName:     ticket?.buyerName  || null,
        buyerEmail:    ticket?.userEmail  || null,
        ticketType:    ticket?.ticketType || null,
      });
      await log.save();
      return log;
    } catch (err) {
      console.warn('ScanLog write failed (non-fatal):', err.message);
      return null;
    }
  }

  // ── Get scan logs for an event (organizer-scoped) ───────────
  async getScanLogs({ organizerId, eventId, limit = 100, staffFilter }) {
    if (eventId) await this._requireOrganizerEvent(eventId, organizerId);

    const query = { organizerId };
    if (eventId) query.eventId = eventId;
    if (staffFilter === 'organizer') query.staffId = null;
    else if (staffFilter)            query.scannedByName = staffFilter;

    const logs = await ScanLog.find(query)
      .sort({ scannedAt: -1 })
      .limit(Number(limit))
      .lean();

    return logs.map(l => ({
      id:          l._id.toString(),
      ticketId:    l.ticketId,
      eventId:     l.eventId?.toString(),
      buyerName:   l.buyerName,
      buyerEmail:  l.buyerEmail,
      ticketType:  l.ticketType,
      validatedAt: l.scannedAt,
      validatedBy: l.scannedByName,
      staffId:     l.staffId?.toString() || null,
      method:      l.method,
      result:      l.result,
    }));
  }

  // ── Check-in stats for an event ─────────────────────────────
  async getCheckinStats(eventId, organizerId) {
    if (!eventId) {
      const err = new Error('eventId is required');
      err.statusCode = 400;
      throw err;
    }

    await this._requireOrganizerEvent(eventId, organizerId);

    const tickets = await Ticket.find({ eventId });
    const total   = tickets.length;
    const used    = tickets.filter(t => t.status === 'used' || t.validated).length;
    return { total, used, remaining: total - used, pct: total > 0 ? Math.round(used / total * 100) : 0 };
  }

  // ── Search tickets (organizer-scoped) ───────────────────────
  async searchTickets({ query, eventId, organizerId }) {
    const q = (query || '').trim();
    if (!q) return [];

    const organizerEventIds = await this._getOrganizerEventIds(organizerId);

    const filter = {
      $or: [
        { id:        { $regex: q, $options: 'i' } },
        { userEmail: { $regex: q, $options: 'i' } },
      ],
      eventId: { $in: organizerEventIds },
    };
    if (eventId) filter.eventId = eventId;

    return Ticket.find(filter).limit(20).lean();
  }

  // ── PIN login ───────────────────────────────────────────────
  async pinLogin(pin) {
    if (!pin || String(pin).length < 4) {
      const err = new Error('PIN must be at least 4 digits.');
      err.statusCode = 400;
      throw err;
    }

    const allActive = await Staff.find({ status: 'active' }).select('+pin');

    let matched = null;
    for (const s of allActive) {
      if (await s.verifyPin(String(pin))) { matched = s; break; }
    }

    if (!matched) {
      const err = new Error('Invalid PIN.');
      err.statusCode = 401;
      throw err;
    }

    matched.lastLoginAt = new Date();
    await matched.save();

    const jwt   = require('jsonwebtoken');
    const token = jwt.sign(
      {
        id:          matched._id.toString(),
        staffId:     matched.staffId,
        role:        matched.role,
        organizerId: matched.organizerId.toString(),
        eventId:     matched.eventId.toString(),
        type:        'staff',
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    return {
      id:               matched._id.toString(),
      name:             matched.name,
      email:            matched.email,
      role:             matched.role,
      token,
      assignedEventIds: [matched.eventId.toString()],
    };
  }
}

module.exports = new StaffService();
