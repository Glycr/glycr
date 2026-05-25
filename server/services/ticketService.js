const { v4: uuidv4 } = require('uuid');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const User = require('../models/User');
const Refund = require('../models/Refund');
const { sendEmail, sendSMS } = require('./notificationService');
const couponService = require('./couponService');

class TicketService {
  // FIX: userId = null so guests (unauthenticated) can purchase
  async purchaseTicket(userId = null, eventId, ticketType, quantity, paymentDetails, groupBooking = {}, promoCode = null) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error('Event not found');
    if (event.isCancelled) throw new Error('Event cancelled');

    const ticketTypes = event.ticketTypes;
    const typeData = ticketTypes.get(ticketType);
    if (!typeData) throw new Error('Invalid ticket type');

    const sold = typeData.sold || 0;
    const available = typeData.capacity - sold;
    if (quantity > available) throw new Error('Not enough tickets available');

    // --- Early bird pricing ---
    const now = new Date();
    let pricePerTicket = typeData.price;
    const earlyBirdEnd = typeData.earlyBirdEnd;
    if (earlyBirdEnd && now < new Date(earlyBirdEnd) && typeData.earlyBirdPrice !== undefined) {
      pricePerTicket = typeData.earlyBirdPrice;
    }

    // --- Group discount (only if configured) ---
    const minQty = typeData.groupDiscountMinQty || 5;
    const discPct = typeData.groupDiscount || 0;
    let groupDiscountApplied = false;
    if (discPct > 0 && quantity >= minQty) {
      pricePerTicket = pricePerTicket * (1 - discPct / 100);
      groupDiscountApplied = true;
    }

    // Calculate subtotal before promo code
    const subtotal = pricePerTicket * quantity;
    let discountAmount = 0;
    let appliedCoupon = null;

    // --- Apply promo code if provided ---
    if (promoCode) {
      try {
        const { discount, coupon } = await couponService.applyCoupon(promoCode, eventId, subtotal, userId);
        discountAmount = discount;
        appliedCoupon = coupon;
        // Adjust price per ticket after promo discount
        pricePerTicket = (subtotal - discountAmount) / quantity;
      } catch (err) {
        throw new Error(`Promo code error: ${err.message}`);
      }
    }

    // Update sold count
    typeData.sold = sold + quantity;
    await event.save();

    // Create tickets – safely handle groupBooking (may be null)
    const purchasedTickets = [];
    for (let i = 0; i < quantity; i++) {
      const ticketId = uuidv4();
      const ticket = new Ticket({
        id: ticketId,
        eventId,
        userId,
        ticketType,
        price: pricePerTicket,
        userEmail: paymentDetails.email,
        userPhone: paymentDetails.phone,
        companyName: (groupBooking && groupBooking.companyName) || '',
        billingAddress: (groupBooking && groupBooking.billingAddress) || '',
        poNumber: (groupBooking && groupBooking.poNumber) || '',
        validated: false,
        status: 'active',
        promoCode: promoCode || null,
        discountAmount: discountAmount > 0 ? discountAmount / quantity : 0,
      });
      await ticket.save();
      purchasedTickets.push(ticket);
    }

    // Increment coupon usage after successful purchase
    if (appliedCoupon) {
      await couponService.incrementUsage(appliedCoupon._id);
    }

    // Build discount description for email (same as before)
    let discountDesc = '';
    if (groupDiscountApplied && discountAmount > 0) {
      discountDesc = `Group discount (${discPct}%) + Promo code (${appliedCoupon?.code || promoCode}) applied: -₵${discountAmount.toFixed(2)}`;
    } else if (groupDiscountApplied) {
      discountDesc = `Group discount (${discPct}%) applied: -₵${(subtotal - pricePerTicket * quantity).toFixed(2)}`;
    } else if (discountAmount > 0) {
      discountDesc = `Promo code ${appliedCoupon?.code || promoCode} applied: -₵${discountAmount.toFixed(2)}`;
    }

    const finalTotal = pricePerTicket * quantity;

    // Send notifications (unchanged)
    for (const ticket of purchasedTickets) {
      const emailHtml = `
      <h2>Your Glycr Ticket</h2>
      <p>Thank you for purchasing a ticket to <strong>${event.title}</strong>.</p>
      ${discountDesc ? `<p style="color:var(--mint);">${discountDesc}</p>` : ''}
      <p><strong>Final total:</strong> ₵${finalTotal.toFixed(2)}</p>
      <p>Ticket ID: ${ticket.id}</p>
      <p>Type: ${ticket.ticketType.toUpperCase()}</p>
      <p>Price paid: ₵${ticket.price}</p>
      <p>Date: ${new Date(event.date).toLocaleString()}</p>
      <p>Venue: ${event.venue}, ${event.location}</p>
      <p>Present this QR code at the entrance.</p>
    `;
      const emailText = `Your Glycr Ticket for ${event.title}. Ticket ID: ${ticket.id}. Price paid: ₵${ticket.price}. Date: ${new Date(event.date).toLocaleString()}. Venue: ${event.venue}, ${event.location}.${discountDesc ? ` ${discountDesc}` : ''}`;
      const smsText = `Glycr: Your ticket for ${event.title} (${ticket.ticketType}) is confirmed. Ticket ID: ${ticket.id}. Show this QR code at the entrance.`;

      await sendEmail(ticket.userEmail, `Your Ticket for ${event.title}`, emailHtml, emailText).catch(err => console.error('Email send failed', err));
      await sendSMS(ticket.userPhone, smsText).catch(err => console.error('SMS send failed', err));
    }

    return purchasedTickets;
  }

  async getUserTickets(userId) {
    return await Ticket.find({ userId }).populate('eventId', 'title currency');
  }

  async validateTicketAtDoor(ticketId, eventId) {
    const ticket = await Ticket.findOne({ id: ticketId });
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.eventId.toString() !== eventId) throw new Error('Ticket not for this event');
    if (ticket.status !== 'active') throw new Error('Ticket already used or cancelled');
    ticket.status = 'used';
    ticket.validated = true;
    await ticket.save();
    return ticket;
  }

  async validateTicket(ticketId) {
    const ticket = await Ticket.findOne({ id: ticketId });
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.status !== 'active') throw new Error('Ticket already used or cancelled');
    ticket.status = 'used';
    ticket.validated = true;
    await ticket.save();
    return ticket;
  }

  async cancelTicket(ticketId, adminId) {
    const ticket = await Ticket.findOne({ id: ticketId }).populate('eventId');
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.status !== 'active') throw new Error('Ticket already used, cancelled, or refunded');

    // Create a pending refund request
    const refund = new Refund({
      ticketId: ticket._id,
      userId: ticket.userId,
      eventId: ticket.eventId._id,
      amount: ticket.price,
      reason: `Cancelled by ${adminId ? 'admin/organizer' : 'system'}`,
      status: 'pending',
      requestedAt: new Date(),
      isPartial: false,
      originalPrice: ticket.price,
    });
    await refund.save();

    // Change ticket status to refund_pending (blocks usage until decision)
    ticket.status = 'refund_pending';
    await ticket.save();

    // Notify the event organizer
    const organizer = await User.findById(ticket.eventId.organizerId);
    if (organizer && organizer.email) {
      await sendEmail(
        organizer.email,
        `Refund request created for ${ticket.eventId.title}`,
        `<p>A ticket (${ticket.id}) was cancelled by admin and a refund request is pending your review.</p>`
      );
    }

    return refund;
  }

  async getEventTickets(eventId) {
    return await Ticket.find({ eventId }).populate('userId', 'name email');
  }
}

module.exports = new TicketService();
