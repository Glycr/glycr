// services/ticketService.js
const { v4: uuidv4 } = require('uuid');
const Ticket  = require('../models/Ticket');
const Event   = require('../models/Event');
const User    = require('../models/User');
const Refund  = require('../models/Refund');
const Coupon  = require('../models/Coupon');
const { sendEmail, sendSMS } = require('./notificationService');
const couponService = require('./couponService');
const { AppError } = require('../utils/appError');
const { logger } = require('../config/logger');
const { escapeHtml, sanitizeHeader } = require('../utils/htmlSecurity');

const MAX_QUANTITY_PER_ORDER = 50;
const round2 = (n) => Math.round(Number(n) * 100) / 100;

class TicketService {
  async purchaseTicket(
    userId = null, eventId, ticketType, quantity, paymentDetails,
    groupBooking = {}, promoCode = null, buyerName = null
  ) {
    if (!eventId) throw new AppError('eventId is required', 400);
    if (!ticketType || typeof ticketType !== 'string') {
      throw new AppError('ticketType is required', 400);
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY_PER_ORDER) {
      throw new AppError(
        `quantity must be an integer between 1 and ${MAX_QUANTITY_PER_ORDER}`, 400
      );
    }

    if (!paymentDetails || typeof paymentDetails !== 'object') {
      throw new AppError('paymentDetails is required', 400);
    }
    if (!paymentDetails.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentDetails.email)) {
      throw new AppError('Valid email is required for ticket', 400);
    }
    if (!paymentDetails.phone) {
      throw new AppError('Phone number is required for ticket', 400);
    }

    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);
    if (event.isCancelled) throw new AppError('Event cancelled', 400);
    if (event.isPublished === false) throw new AppError('Event is not published', 400);

    const ticketTypes = event.ticketTypes;
    if (!ticketTypes || !(ticketTypes instanceof Map)) {
      throw new AppError('Event ticket types are corrupted', 500);
    }

    const typeData = ticketTypes.get(ticketType);
    if (!typeData) throw new AppError('Invalid ticket type', 400);

    const capacity = Number(typeData.capacity) || 0;
    const sold = Number(typeData.sold) || 0;
    const available = capacity - sold;
    if (qty > available) {
      throw new AppError(`Only ${available} ticket(s) available`, 400);
    }

    // ── Pricing ──
    const now = new Date();
    const originalPricePerTicket = Number(typeData.price) || 0;
    let pricePerTicket = originalPricePerTicket;

    if (typeData.earlyBirdEnd && typeData.earlyBirdPrice != null) {
      const ebEnd = new Date(typeData.earlyBirdEnd);
      if (!isNaN(ebEnd) && now < ebEnd) {
        pricePerTicket = Number(typeData.earlyBirdPrice);
      }
    }

    const minQty = Number(typeData.groupDiscountMinQty) || 5;
    const discPct = Number(typeData.groupDiscount) || 0;
    let groupDiscountApplied = false;
    if (discPct > 0 && discPct <= 100 && qty >= minQty) {
      pricePerTicket = pricePerTicket * (1 - discPct / 100);
      groupDiscountApplied = true;
    }

    const subtotal = round2(pricePerTicket * qty);

    // ── Promo code ──
    let discountAmount = 0;
    let appliedCoupon = null;
    if (promoCode) {
      const { discount, coupon } = await couponService.applyCoupon(
        promoCode, eventId, subtotal, userId
      );
      discountAmount = round2(discount);
      appliedCoupon = coupon;
    }

    const finalTotal = round2(subtotal - discountAmount);
    pricePerTicket = round2(finalTotal / qty);

    // ── Atomically reserve capacity ──
    const soldPath = `ticketTypes.${ticketType}.sold`;
    const reserved = await Event.findOneAndUpdate(
      { _id: eventId, [soldPath]: { $lte: capacity - qty } },
      { $inc: { [soldPath]: qty } },
      { returnDocument: 'after' }
    );
    if (!reserved) {
      throw new AppError('Not enough tickets available (concurrent purchase)', 409);
    }

    // ── Increment coupon usage BEFORE creating tickets ──
    if (appliedCoupon) {
      try {
        await couponService.incrementUsage(appliedCoupon._id);
      } catch (err) {
        await Event.updateOne({ _id: eventId }, { $inc: { [soldPath]: -qty } });
        throw new AppError(
          `Promo code error: ${err.message}`,
          err.statusCode || 400
        );
      }
    }

    // Resolve buyer display name once (not per ticket)
    const resolvedBuyerName =
      buyerName
      || (userId ? (await User.findById(userId).select('name').lean())?.name : null)
      || (paymentDetails.email ? paymentDetails.email.split('@')[0] : null);

    // ── Create tickets (with rollback on failure) ──
    const purchasedTickets = [];
    try {
      for (let i = 0; i < qty; i++) {
        const ticket = new Ticket({
          id: uuidv4(),
          eventId,
          userId,
          ticketType,
          price: pricePerTicket,
          userEmail: paymentDetails.email.toLowerCase().trim(),
          userPhone: paymentDetails.phone,
          buyerName: resolvedBuyerName,
          companyName:     (groupBooking && groupBooking.companyName)     || '',
          billingAddress:  (groupBooking && groupBooking.billingAddress)  || '',
          poNumber:        (groupBooking && groupBooking.poNumber)        || '',
          validated: false,
          status: 'active',
          promoCode: promoCode || null,
          discountAmount: discountAmount > 0 ? round2(discountAmount / qty) : 0,
        });
        await ticket.save();
        purchasedTickets.push(ticket);
      }
    } catch (err) {
      logger.error('Ticket creation failed mid-loop — rolling back', {
        eventId, ticketType, qty, createdCount: purchasedTickets.length, err: err.message,
      });
      await Event.updateOne({ _id: eventId }, { $inc: { [soldPath]: -qty } })
        .catch((e) => logger.error('Rollback capacity failed', { err: e.message }));
      if (purchasedTickets.length > 0) {
        await Ticket.deleteMany({ _id: { $in: purchasedTickets.map((t) => t._id) } })
          .catch((e) => logger.error('Rollback ticket delete failed', { err: e.message }));
      }
      if (appliedCoupon) {
        await Coupon.updateOne({ _id: appliedCoupon._id }, { $inc: { usedCount: -1 } })
          .catch((e) => logger.error('Rollback coupon decrement failed', { err: e.message }));
      }
      throw err;
    }

    // ── Build discount description ──
    let discountDesc = '';
    if (groupDiscountApplied && discountAmount > 0) {
      discountDesc = `Group discount (${discPct}%) + Promo code (${appliedCoupon?.code || promoCode}) applied: -₵${discountAmount.toFixed(2)}`;
    } else if (groupDiscountApplied) {
      const groupSavings = round2(originalPricePerTicket * qty * discPct / 100);
      discountDesc = `Group discount (${discPct}%) applied: -₵${groupSavings.toFixed(2)}`;
    } else if (discountAmount > 0) {
      discountDesc = `Promo code ${appliedCoupon?.code || promoCode} applied: -₵${discountAmount.toFixed(2)}`;
    }

    // ── Notify buyer — fire-and-forget ──
    const subjectSafe = sanitizeHeader(`Your Ticket for ${event.title}`);
    for (const ticket of purchasedTickets) {
      const emailHtml = `
        <h2>Your Glycr Ticket</h2>
        <p>Thank you for purchasing a ticket to <strong>${escapeHtml(event.title)}</strong>.</p>
        ${discountDesc ? `<p style="color:#3dbb86;">${escapeHtml(discountDesc)}</p>` : ''}
        <p><strong>Final total:</strong> ₵${finalTotal.toFixed(2)}</p>
        <p>Ticket ID: ${escapeHtml(ticket.id)}</p>
        <p>Type: ${escapeHtml(ticket.ticketType.toUpperCase())}</p>
        <p>Price paid: ₵${ticket.price}</p>
        <p>Date: ${new Date(event.date).toLocaleString()}</p>
        <p>Venue: ${escapeHtml(event.venue)}, ${escapeHtml(event.location)}</p>
        <p>Present this QR code at the entrance.</p>
      `;
      const emailText = `Your Glycr Ticket for ${event.title}. Ticket ID: ${ticket.id}. Price paid: ₵${ticket.price}. Date: ${new Date(event.date).toLocaleString()}. Venue: ${event.venue}, ${event.location}.${discountDesc ? ` ${discountDesc}` : ''}`;
      const smsText = `Glycr: Your ticket for ${event.title} (${ticket.ticketType}) is confirmed. Ticket ID: ${ticket.id}. Show this QR code at the entrance.`;

      sendEmail(ticket.userEmail, subjectSafe, emailHtml, emailText)
        .catch((err) => logger.error('Ticket email failed', { ticketId: ticket.id, err: err.message }));
      sendSMS(ticket.userPhone, smsText)
        .catch((err) => logger.error('Ticket SMS failed', { ticketId: ticket.id, err: err.message }));
    }

    return purchasedTickets;
  }

  async getUserTickets(userId) {
    if (!userId) throw new AppError('userId is required', 400);
    return Ticket.find({ userId }).populate('eventId', 'title currency');
  }

  // Low-level atomic check-in. Assumes the caller has already verified
  // that eventId belongs to the requester (organizer or admin). Used by
  // staffService-style flows and by validateTicket below.
  async validateTicketAtDoor(ticketId, eventId) {
    if (!ticketId) throw new AppError('ticketId is required', 400);
    if (!eventId)  throw new AppError('eventId is required', 400);

    const ticket = await Ticket.findOne({ id: ticketId });
    if (!ticket) throw new AppError('Ticket not found', 404);
    if (ticket.eventId.toString() !== eventId.toString()) {
      throw new AppError('Ticket not for this event', 400);
    }
    if (ticket.status === 'refunded' || ticket.refunded) {
      throw new AppError('This ticket has been refunded', 400);
    }
    if (ticket.status === 'refund_pending') {
      throw new AppError('This ticket has a pending refund', 400);
    }
    if (ticket.status === 'cancelled') {
      throw new AppError('This ticket has been cancelled', 400);
    }

    const updated = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: 'active', validated: false },
      { $set: { status: 'used', validated: true, validatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!updated) throw new AppError('Ticket already used', 409);
    return updated;
  }

  // Manual validation by admin / organizer. Derives eventId from the ticket
  // itself, then verifies the requester's authority, then delegates to the
  // same atomic check-in used by staff door scans.
  //
  // actingUser: { id, isAdmin } — the JWT-decoded user making the request.
  async validateTicket(ticketId, actingUser) {
    if (!ticketId) throw new AppError('ticketId is required', 400);
    if (!actingUser || !actingUser.id) {
      throw new AppError('Authentication required', 401);
    }

    const existing = await Ticket.findOne({ id: ticketId })
      .populate('eventId', 'organizerId')
      .lean();
    if (!existing) throw new AppError('Ticket not found', 404);

    if (!existing.eventId) {
      throw new AppError('Event for this ticket no longer exists', 404);
    }

    // Authority: admin can validate any ticket; organizer only their own events.
    if (!actingUser.isAdmin) {
      const organizerId = existing.eventId.organizerId;
      if (!organizerId || String(organizerId) !== String(actingUser.id)) {
        throw new AppError('Forbidden', 403);
      }
    }

    const eventId = String(existing.eventId._id || existing.eventId);
    return this.validateTicketAtDoor(ticketId, eventId);
  }

  // Admin / organizer cancellation. Same authority model as validateTicket:
  // admin any ticket, organizer only their own event's tickets.
  async cancelTicket(ticketId, actingUser) {
    if (!ticketId) throw new AppError('ticketId is required', 400);
    if (!actingUser || !actingUser.id) {
      throw new AppError('Authentication required', 401);
    }

    const ticket = await Ticket.findOne({ id: ticketId }).populate('eventId');
    if (!ticket) throw new AppError('Ticket not found', 404);
    if (!ticket.eventId) throw new AppError('Event for this ticket no longer exists', 404);

    // Authority check
    if (!actingUser.isAdmin) {
      const organizerId = ticket.eventId.organizerId;
      if (!organizerId || String(organizerId) !== String(actingUser.id)) {
        throw new AppError('Forbidden', 403);
      }
    }

    // Atomic lock — prevents double-cancel creating two refunds
    const locked = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: 'active' },
      { $set: { status: 'refund_pending' } },
      { returnDocument: 'after' }
    );
    if (!locked) throw new AppError('Ticket already used, cancelled, or refunded', 400);

    let refund;
    try {
      refund = new Refund({
        source: 'admin_cancelled',
        ticketId: ticket._id,
        userId: ticket.userId,
        eventId: ticket.eventId._id,
        amount: ticket.price,
        reason: actingUser.isAdmin
          ? 'Cancelled by admin'
          : 'Cancelled by organizer',
        status: 'pending',
        requestedAt: new Date(),
        isPartial: false,
        originalPrice: ticket.price,
      });
      await refund.save();

      locked.refundId = refund._id;
      await locked.save();
    } catch (err) {
      await Ticket.updateOne(
        { _id: ticket._id, status: 'refund_pending' },
        { $set: { status: 'active' } }
      ).catch((e) => logger.error('cancelTicket rollback failed', { err: e.message }));
      throw err;
    }

    // Notify organizer — best effort
    const organizer = await User.findById(ticket.eventId.organizerId).select('email').lean();
    if (organizer?.email) {
      const subject = sanitizeHeader(`Refund request created for ${ticket.eventId.title}`);
      const html = `<p>A ticket (${escapeHtml(ticket.id)}) was cancelled by admin and a refund request is pending your review.</p>`;
      sendEmail(organizer.email, subject, html).catch((err) =>
        logger.error('cancelTicket organizer email failed', {
          refundId: refund._id.toString(), err: err.message,
        })
      );
    }

    return refund;
  }

  async getEventTickets(eventId, organizerId = null) {
    if (!eventId) throw new AppError('eventId is required', 400);

    if (organizerId) {
      const owns = await Event.exists({ _id: eventId, organizerId });
      if (!owns) throw new AppError('Event not found or not yours', 403);
    }

    return Ticket.find({ eventId }).populate('userId', 'name email');
  }
}

module.exports = new TicketService();
