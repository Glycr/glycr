// FILE: controllers/waitlistController.js
// ============================================
const Waitlist = require('../models/Waitlist');
const Event = require('../models/Event');
const { sendSMS } = require('../utils/sms');

exports.joinWaitlist = async (req, res) => {
  try {
    const { eventId, ticketType, name, email, phone } = req.body;

    const existing = await Waitlist.findOne({ eventId, ticketType, email });
    if (existing) {
      return res.status(400).json({ error: 'Already on waitlist' });
    }

    const waitlistEntry = new Waitlist({
      eventId,
      ticketType,
      name,
      email,
      phone
    });

    await waitlistEntry.save();

    await sendSMS(
      phone,
      `You've joined the waitlist for ${ticketType.toUpperCase()} tickets. We'll notify you when available!`
    );

    res.status(201).json({ message: 'Added to waitlist', entry: waitlistEntry });
  } catch (error) {
    console.error('Waitlist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getWaitlist = async (req, res) => {
  try {
    const { eventId, ticketType } = req.params;

    const event = await Event.findById(eventId);
    if (!event || event.organizerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const waitlist = await Waitlist.find({ eventId, ticketType }).sort({ joinedAt: 1 });

    res.json(waitlist);
  } catch (error) {
    console.error('Get waitlist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.notifyWaitlist = async (req, res) => {
  try {
    const { eventId, ticketType } = req.params;

    const event = await Event.findById(eventId);
    if (!event || event.organizerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const waitlist = await Waitlist.find({ eventId, ticketType, notified: false });

    for (const entry of waitlist) {
      await sendSMS(
        entry.phone,
        `Good news! ${ticketType.toUpperCase()} tickets for ${event.title} are now available!`
      );

      entry.notified = true;
      await entry.save();
    }

    res.json({ message: `Notified ${waitlist.length} people on waitlist` });
  } catch (error) {
    console.error('Notify waitlist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
