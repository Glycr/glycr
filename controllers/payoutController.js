// ============================================
// FILE: controllers/payoutController.js
// ============================================
const Payout = require('../models/Payout');
const User = require('../models/User');

exports.requestPayout = async (req, res) => {
  try {
    const { amount, method, email, notes, details } = req.body;

    const userEvents = await Event.find({ organizerId: req.user.id });
    const eventIds = userEvents.map(e => e._id);
    const tickets = await Ticket.find({ eventId: { $in: eventIds } });
    const totalRevenue = tickets.reduce((sum, t) => sum + t.price, 0);

    const completedPayouts = await Payout.find({
      organizerId: req.user.id,
      status: 'completed'
    });
    const totalPaidOut = completedPayouts.reduce((sum, p) => sum + p.amount, 0);

    const available = totalRevenue - totalPaidOut;

    if (amount > available) {
      return res.status(400).json({ error: 'Amount exceeds available balance' });
    }

    const payout = new Payout({
      organizerId: req.user.id,
      amount,
      method,
      email,
      notes,
      details
    });

    await payout.save();

    res.status(201).json({ message: 'Payout requested', payout });
  } catch (error) {
    console.error('Payout request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getPayouts = async (req, res) => {
  try {
    const payouts = await Payout.find({ organizerId: req.user.id }).sort({ requestedAt: -1 });
    res.json(payouts);
  } catch (error) {
    console.error('Get payouts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
