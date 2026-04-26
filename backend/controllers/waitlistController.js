const mongoose = require('mongoose');   // <-- ADD THIS
const waitlistService = require('../services/waitlistService');

exports.joinWaitlist = async (req, res, next) => {
  try {
    const { eventId, ticketType, name, email, phone } = req.body;
    const entry = await waitlistService.joinWaitlist(eventId, ticketType, name, email, phone);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
};

exports.getWaitlist = async (req, res, next) => {
  try {
    const { eventId: eventIdParam, ticketType } = req.params;

    if (!eventIdParam) {
      const entries = await waitlistService.getAllWaitlists();
      return res.json(entries);
    }

    if (!mongoose.Types.ObjectId.isValid(eventIdParam)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const entries = await waitlistService.getWaitlist(eventIdParam, ticketType, req.user.id);
    res.json(entries);
  } catch (err) {
    next(err);
  }
};

exports.notifyWaitlist = async (req, res, next) => {
  try {
    const { eventId, ticketType } = req.params;   // both are string IDs
    const result = await waitlistService.notifyWaitlist(eventId, ticketType, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
