const Payout = require('../models/Payout');
const User = require('../models/User');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Settings = require('../models/Settings');
const { sendEmail } = require('./notificationService');   // <-- ADD

class PayoutService {
  async getPlatformFee() {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({ platformFee: 3 });
    return settings.platformFee;
  }

  async requestPayout(organizerId, amount, method, email, notes, details) {
    const organizer = await User.findById(organizerId);
    if (!organizer) throw new Error('Organizer not found');
    if (organizer.suspended) throw new Error('Account suspended');
    if (!organizer.isOrganizer) throw new Error('Only organizers can request payouts');

    const pendingAmount = await this.getPendingPayouts(organizerId);
    if (amount > pendingAmount) throw new Error('Amount exceeds available balance (after platform fee)');
    if (amount < 10) throw new Error('Minimum payout amount is 10');

    const payout = new Payout({
      organizerId,
      amount,
      method,
      email,
      notes: notes || '',
      details: details || {},
      status: 'pending',
    });
    await payout.save();

    // Optional: send confirmation email to organizer that request was received
    const confirmationHtml = `
      <h2>Payout Request Received</h2>
      <p>Your request for ₵${amount} via ${method.toUpperCase()} has been received and is pending approval.</p>
      <p>We will notify you once it is processed.</p>
      <p>– Glycr Team</p>
    `;
    await sendEmail(email, 'Payout Request Received', confirmationHtml).catch(err => console.error('Email send failed', err));

    return payout;
  }

  async getMyPayouts(organizerId) {
    const payouts = await Payout.find({ organizerId }).sort('-requestedAt');
    return payouts;
  }

  async getPendingPayouts(organizerId) {
    const events = await Event.find({ organizerId, isCancelled: false });
    const eventIds = events.map(e => e._id);
    const tickets = await Ticket.find({ eventId: { $in: eventIds } });
    const totalRevenue = tickets.reduce((sum, t) => sum + t.price, 0);

    const feePercent = await this.getPlatformFee();
    const feeAmount = totalRevenue * (feePercent / 100);
    const netRevenue = totalRevenue - feeAmount;

    const payouts = await Payout.find({ organizerId, status: 'completed' });
    const totalPaid = payouts.reduce((sum, p) => sum + p.amount, 0);

    return netRevenue - totalPaid;
  }

  async approvePayout(payoutId) {
    const payout = await Payout.findById(payoutId);
    if (!payout) throw new Error('Payout not found');
    if (payout.status !== 'pending') throw new Error('Payout already processed');

    payout.status = 'completed';
    payout.completedAt = new Date();
    await payout.save();

    // Send approval email to the organizer
    const approvalHtml = `
      <h2>Payout Approved</h2>
      <p>Your payout request of ₵${payout.amount} via ${payout.method.toUpperCase()} has been approved.</p>
      <p>Funds will be transferred within 3‑5 business days.</p>
      <p>Thank you for using Glycr!</p>
    `;
    await sendEmail(payout.email, 'Payout Approved – Glycr', approvalHtml).catch(err => console.error('Email send failed', err));

    return payout;
  }

  async rejectPayout(payoutId, reason) {
    const payout = await Payout.findById(payoutId);
    if (!payout) throw new Error('Payout not found');
    if (payout.status !== 'pending') throw new Error('Payout already processed');

    payout.status = 'rejected';
    payout.rejectionReason = reason;
    payout.completedAt = new Date();
    await payout.save();

    // Send rejection email to the organizer
    const rejectionHtml = `
      <h2>Payout Request Rejected</h2>
      <p>Your payout request of ₵${payout.amount} via ${payout.method.toUpperCase()} has been rejected.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>Please update your payout details and submit a new request.</p>
      <p>– Glycr Team</p>
    `;
    await sendEmail(payout.email, 'Payout Request Rejected – Glycr', rejectionHtml).catch(err => console.error('Email send failed', err));

    return payout;
  }

  async getAllPayouts() {
    const payouts = await Payout.find().sort('-requestedAt').populate('organizerId', 'name email');
    return payouts;
  }
}

module.exports = new PayoutService();
