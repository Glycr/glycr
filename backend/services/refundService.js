const Refund = require('../models/Refund');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const User = require('../models/User');
const { sendEmail, sendSMS } = require('./notificationService');

class RefundService {
  // Customer requests a refund
  async requestRefund(userId, ticketId, reason, isPartial = false, partialAmount = null) {
    const ticket = await Ticket.findOne({ id: ticketId }).populate('eventId');
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.userId.toString() !== userId) throw new Error('Not your ticket');
    if (ticket.status !== 'active') throw new Error('Ticket already used, cancelled, or refunded');
    if (ticket.refunded) throw new Error('Refund already requested');

    const event = ticket.eventId;
    const now = new Date();
    const eventDate = new Date(event.date);
    // Example: allow refund up to 7 days before event
    const refundDeadline = new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (now > refundDeadline) throw new Error('Refund window has passed (must be at least 7 days before event)');

    let amount = ticket.price;
    if (isPartial) {
      if (!partialAmount || partialAmount <= 0 || partialAmount > ticket.price) {
        throw new Error('Invalid partial amount');
      }
      amount = partialAmount;
    }

    const refund = new Refund({
      ticketId: ticket._id,
      userId,
      eventId: event._id,
      amount,
      reason,
      isPartial,
      originalPrice: ticket.price,
      status: 'pending',
    });
    await refund.save();

    // Notify organizer
    const organizer = await User.findById(event.organizerId);
    if (organizer && organizer.email) {
      await sendEmail(
        organizer.email,
        `Refund request for ${event.title}`,
        `<p>${ticket.userEmail} requested a refund of ${amount} for ticket ${ticket.id}.</p><p>Reason: ${reason}</p><p>Please approve or reject in the admin panel.</p>`
      );
    }

    return refund;
  }

  // Organizer or admin approves refund
  async approveRefund(refundId, processedById) {
    const refund = await Refund.findById(refundId).populate('ticketId').populate('eventId');
    if (!refund) throw new Error('Refund not found');
    if (refund.status !== 'pending') throw new Error('Refund already processed');

    const ticket = refund.ticketId;
    if (ticket.refunded) throw new Error('Ticket already refunded');

    // Update ticket
    ticket.status = 'refunded';
    ticket.refunded = true;
    ticket.refundId = refund._id;
    await ticket.save();

    // Update refund
    refund.status = 'approved';
    refund.processedAt = new Date();
    refund.processedBy = processedById;
    await refund.save();

    // Simulate payment reversal (in production, call payment gateway API)
    console.log(`💰 Refund of ${refund.amount} processed for ticket ${ticket.id}`);

    // Notify customer
    const customer = await User.findById(refund.userId);
    if (customer) {
      await sendEmail(
        customer.email,
        'Refund approved – Glycr',
        `<h2>Your refund of ${refund.amount} for ${refund.eventId.title} has been approved.</h2><p>Funds will be returned to your original payment method within 5‑7 business days.</p>`
      );
      await sendSMS(customer.phone, `Glycr: Refund of ${refund.amount} approved for ${refund.eventId.title}.`);
    }

    // Adjust event ticket sold count? Only if you want to free up capacity.
    // For now, we keep sold count unchanged; event organizer can manually adjust.

    return refund;
  }

  // Organizer or admin rejects refund
  async rejectRefund(refundId, processedById, rejectionReason) {
    const refund = await Refund.findById(refundId).populate('ticketId').populate('eventId');
    if (!refund) throw new Error('Refund not found');
    if (refund.status !== 'pending') throw new Error('Refund already processed');

    refund.status = 'rejected';
    refund.processedAt = new Date();
    refund.processedBy = processedById;
    refund.rejectionReason = rejectionReason;
    await refund.save();

    // Notify customer
    const customer = await User.findById(refund.userId);
    if (customer) {
      await sendEmail(
        customer.email,
        'Refund request rejected – Glycr',
        `<h2>Your refund request for ${refund.eventId.title} has been rejected.</h2><p>Reason: ${rejectionReason}</p><p>Please contact support if you have questions.</p>`
      );
    }

    return refund;
  }

  // Get refunds for a user
  async getUserRefunds(userId) {
    return Refund.find({ userId }).populate('eventId', 'title date').sort('-requestedAt');
  }

  // Get refunds for an organizer (for their events)
  async getOrganizerRefunds(organizerId) {
    const events = await Event.find({ organizerId }).select('_id');
    const eventIds = events.map(e => e._id);
    return Refund.find({ eventId: { $in: eventIds } })
      .populate('userId', 'name email')
      .populate('ticketId')
      .sort('-requestedAt');
  }

  // Admin gets all refunds
  async getAllRefunds() {
    return Refund.find()
      .populate('userId', 'name email')
      .populate('eventId', 'title')
      .populate('ticketId')
      .sort('-requestedAt');
  }
}

module.exports = new RefundService();
