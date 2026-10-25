// services/refundService.js
const Refund = require('../models/Refund');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const User = require('../models/User');
const settingsService = require('./settingsService');
const { sendEmail, sendSMS } = require('./notificationService');
const { AppError } = require('../utils/appError');
const { logger } = require('../config/logger');
const { escapeHtml, sanitizeHeader } = require('../utils/htmlSecurity');

const round2 = (n) => Math.round(Number(n) * 100) / 100;

class RefundService {
  async requestRefund(userId, ticketId, reason, isPartial = false, partialAmount = null) {
    // --- Validate inputs ---
    if (!ticketId || typeof ticketId !== 'string') {
      throw new AppError('ticketId is required', 400);
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new AppError('Refund reason is required', 400);
    }
    if (!userId) {
      throw new AppError('userId is required', 400);
    }

    const ticket = await Ticket.findOne({ id: ticketId }).populate('eventId');
    if (!ticket) throw new AppError('Ticket not found', 404);

    if (!ticket.userId) {
      throw new AppError(
        'Guest tickets cannot request refunds via account. Please contact support.',
        403
      );
    }
    if (ticket.userId.toString() !== userId.toString()) {
      throw new AppError('This ticket does not belong to you', 403);
    }

    if (ticket.status === 'refund_pending') {
      throw new AppError('A refund request for this ticket is already pending', 409);
    }
    if (ticket.status !== 'active') {
      throw new AppError('Ticket already used, cancelled, or refunded', 400);
    }
    if (ticket.refunded) {
      throw new AppError('Refund already requested', 409);
    }

    const event = ticket.eventId;
    if (!event) {
      throw new AppError('Event for this ticket no longer exists', 404);
    }

    // Refund window check — reads the configurable deadline from Settings.
    const settings = await settingsService.getSettings();
    const deadlineDays = Number(settings.refundDeadlineDays) || 7;
    const windowMs = deadlineDays * 24 * 60 * 60 * 1000;

    const eventDate = new Date(event.date);
    if (isNaN(eventDate)) {
      throw new AppError('Event has an invalid date', 500);
    }
    const refundDeadline = new Date(eventDate.getTime() - windowMs);
    if (new Date() > refundDeadline) {
      throw new AppError(
        `Refund window has passed (must be at least ${deadlineDays} day${deadlineDays !== 1 ? 's' : ''} before event)`,
        400
      );
    }

    // --- Amount calculation ---
    let amount = round2(ticket.price);
    if (isPartial) {
      const parsed = Number(partialAmount);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > ticket.price) {
        throw new AppError(`Partial amount must be between 0 and ${round2(ticket.price)}`, 400);
      }
      amount = round2(parsed);
    }

    // Atomically lock the ticket BEFORE creating the refund.
    const locked = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: 'active', refunded: false },
      { $set: { status: 'refund_pending' } },
      { returnDocument: 'after' }
    );

    if (!locked) {
      throw new AppError('A refund request for this ticket is already pending', 409);
    }

    // --- Persist refund ---
    const refund = new Refund({
      ticketId: ticket._id,
      userId,
      eventId: event._id,
      amount,
      reason: reason.trim(),
      isPartial: !!isPartial,
      originalPrice: round2(ticket.price),
      status: 'pending',
    });

    try {
      await refund.save();
    } catch (err) {
      await Ticket.updateOne(
        { _id: ticket._id, status: 'refund_pending' },
        { $set: { status: 'active' } }
      );
      throw err;
    }

    locked.refundId = refund._id;
    await locked.save();

    // --- Notify organizer (best-effort) ---
    const organizer = await User.findById(event.organizerId).select('email').lean();
    if (organizer?.email) {
      const subject = sanitizeHeader(`Refund request for ${event.title}`);
      const html = `
        <p>${escapeHtml(ticket.userEmail)} requested a refund of ₵${amount.toFixed(2)} for ticket ${escapeHtml(ticket.id)}.</p>
        <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
        <p>Please approve or reject in the admin panel.</p>
      `;
      sendEmail(organizer.email, subject, html).catch((err) =>
        logger.error('Refund organizer email failed', {
          refundId: refund._id.toString(),
          err: err.message,
        })
      );
    }

    if (ticket.userEmail) {
      const customerHtml = `
        <h2>Refund request received</h2>
        <p>We've received your refund request for <strong>${escapeHtml(event.title)}</strong>.</p>
        <p><strong>Amount:</strong> ₵${amount.toFixed(2)}</p>
        <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
        <p>You'll hear from us once the organizer reviews it.</p>
      `;
      sendEmail(ticket.userEmail, 'Refund request received – Glycr', customerHtml).catch((err) =>
        logger.error('Refund received email failed', {
          refundId: refund._id.toString(),
          err: err.message,
        })
      );
    }

    return refund;
  }

  // Authority: admin can approve any refund; organizer only refunds for
  // their own events. actingUser = { id, isAdmin } from the JWT.
  async approveRefund(refundId, actingUser) {
    // 1. Read the refund (before mutation)
    const pre = await Refund.findById(refundId).populate('ticketId').populate('eventId');
    if (!pre) throw new AppError('Refund not found', 404);

    // 2. Authority check — must happen BEFORE any mutation
    if (!actingUser?.id) throw new AppError('Authentication required', 401);
    if (!actingUser.isAdmin) {
      const organizerId = pre.eventId?.organizerId;
      if (!organizerId || String(organizerId) !== String(actingUser.id)) {
        throw new AppError('Forbidden', 403);
      }
    }

    // 3. Status + ticket eligibility
    if (pre.status !== 'pending') throw new AppError('Refund already processed', 409);

    const preTicket = pre.ticketId;
    if (!preTicket) throw new AppError('Linked ticket no longer exists', 500);
    if (preTicket.status !== 'active' && preTicket.status !== 'refund_pending') {
      throw new AppError('Ticket not eligible for refund', 400);
    }

    // 4. Atomic transition
    const refund = await Refund.findOneAndUpdate(
      { _id: refundId, status: 'pending' },
      {
        $set: {
          status: 'approved',
          processedAt: new Date(),
          processedBy: actingUser.id,
        },
      },
      { returnDocument: 'after' }
    ).populate('ticketId').populate('eventId');

    if (!refund) throw new AppError('Refund already processed', 409);

    const ticket = refund.ticketId;
    if (!ticket) throw new AppError('Linked ticket no longer exists', 500);

    // --- Refund the ticket ---
    ticket.status = 'refunded';
    ticket.refunded = true;
    ticket.refundId = refund._id;
    if ('refundedAt' in ticket.schema.paths) ticket.refundedAt = new Date();
    await ticket.save();

    // --- Restore event capacity ---
    const event = refund.eventId;
    if (event) {
      const typeData = event.ticketTypes?.get?.(ticket.ticketType);
      if (typeData && typeData.sold > 0) {
        typeData.sold -= 1;
        event.markModified('ticketTypes');
        await event.save();
      }
    }

    // --- Payment reversal hook ---
    // ⚠️ Placeholder. When you wire in Stripe/Paystack, replace this with a
    //    real refund call using refund._id as the idempotency key.
    logger.info('Refund approved — payment reversal pending', {
      refundId: refund._id.toString(),
      amount: refund.amount,
      ticketId: ticket.id,
      eventId: event?._id?.toString(),
    });

    // --- Notify customer (best-effort) ---
    this._notifyCustomerApproved(refund, ticket, event).catch((err) =>
      logger.error('Refund approval notify failed', {
        refundId: refund._id.toString(),
        err: err.message,
      })
    );

    return refund;
  }

  // Authority: admin can reject any refund; organizer only refunds for
  // their own events. actingUser = { id, isAdmin } from the JWT.
  async rejectRefund(refundId, actingUser, rejectionReason) {
    if (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim()) {
      throw new AppError('Rejection reason is required', 400);
    }

    // 1. Read the refund (before mutation)
    const pre = await Refund.findById(refundId).populate('ticketId').populate('eventId');
    if (!pre) throw new AppError('Refund not found', 404);

    // 2. Authority check
    if (!actingUser?.id) throw new AppError('Authentication required', 401);
    if (!actingUser.isAdmin) {
      const organizerId = pre.eventId?.organizerId;
      if (!organizerId || String(organizerId) !== String(actingUser.id)) {
        throw new AppError('Forbidden', 403);
      }
    }

    // 3. Status
    if (pre.status !== 'pending') throw new AppError('Refund already processed', 409);

    // 4. Atomic transition
    const refund = await Refund.findOneAndUpdate(
      { _id: refundId, status: 'pending' },
      {
        $set: {
          status: 'rejected',
          processedAt: new Date(),
          processedBy: actingUser.id,
          rejectionReason: rejectionReason.trim(),
        },
      },
      { returnDocument: 'after' }
    ).populate('ticketId').populate('eventId');

    if (!refund) throw new AppError('Refund already processed', 409);

    // --- Un-lock the ticket ---
    const ticket = refund.ticketId;
    if (ticket && ticket.status === 'refund_pending') {
      ticket.status = 'active';
      ticket.refunded = false;
      ticket.refundId = null;
      if ('refundedAt' in ticket.schema.paths) ticket.refundedAt = null;
      await ticket.save();
    }

    this._notifyCustomerRejected(refund, rejectionReason).catch((err) =>
      logger.error('Refund rejection notify failed', {
        refundId: refund._id.toString(),
        err: err.message,
      })
    );

    return refund;
  }

  // --- Private notification helpers (fire-and-forget) ---
  async _notifyCustomerApproved(refund, ticket, event) {
    let email = null;
    let phone = null;

    if (refund.userId) {
      const user = await User.findById(refund.userId).select('email phone').lean();
      email = user?.email || null;
      phone = user?.phone || null;
    }
    email = email || ticket?.userEmail || null;
    phone = phone || ticket?.userPhone || null;

    const eventTitle = event?.title || 'your event';

    if (email) {
      const html = `
        <h2>Your refund of ₵${Number(refund.amount).toFixed(2)} for ${escapeHtml(eventTitle)} has been approved.</h2>
        <p>Funds will be returned to your original payment method within 5–7 business days.</p>
      `;
      sendEmail(email, 'Refund approved – Glycr', html).catch((e) =>
        logger.error('refund approval email failed', {
          refundId: refund._id.toString(),
          err: e.message,
        })
      );
    }
    if (phone) {
      const sms = `Glycr: Refund of ₵${Number(refund.amount).toFixed(2)} approved for ${eventTitle}.`;
      sendSMS(phone, sms).catch((e) =>
        logger.error('refund approval SMS failed', {
          refundId: refund._id.toString(),
          err: e.message,
        })
      );
    }
  }

  async _notifyCustomerRejected(refund, rejectionReason) {
    let email = null;
    if (refund.userId) {
      const user = await User.findById(refund.userId).select('email').lean();
      email = user?.email || null;
    }
    if (!email) email = refund.ticketId?.userEmail || null;
    if (!email) return;

    const eventTitle = refund.eventId?.title || 'your event';
    const html = `
      <h2>Your refund request for ${escapeHtml(eventTitle)} has been rejected.</h2>
      <p><strong>Reason:</strong> ${escapeHtml(rejectionReason)}</p>
      <p>Please contact support if you have questions.</p>
    `;
    sendEmail(email, 'Refund request rejected – Glycr', html).catch((e) =>
      logger.error('refund rejection email failed', {
        refundId: refund._id.toString(),
        err: e.message,
      })
    );
  }

  async getUserRefunds(userId) {
    if (!userId) throw new AppError('userId is required', 400);
    return Refund.find({ userId })
      .populate('eventId', 'title date')
      .sort('-requestedAt');
  }

  async getOrganizerRefunds(organizerId) {
    if (!organizerId) throw new AppError('organizerId is required', 400);
    const events = await Event.find({ organizerId }).select('_id').lean();
    const eventIds = events.map((e) => e._id);
    return Refund.find({ eventId: { $in: eventIds } })
      .populate('userId', 'name email')
      .populate('ticketId')
      .sort('-requestedAt');
  }

  async getAllRefunds() {
    return Refund.find()
      .populate('userId', 'name email')
      .populate('eventId', 'title')
      .populate('ticketId')
      .sort('-requestedAt');
  }
}

module.exports = new RefundService();
