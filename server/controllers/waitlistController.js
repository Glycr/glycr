const mongoose = require('mongoose');   // <-- ADD THIS
const waitlistService = require('../services/waitlistService');
const logService = require('../services/logService');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.joinWaitlist = async (req, res, next) => {
  try {
    const { eventId, ticketType, name, email, phone } = req.body;
    const entry = await waitlistService.joinWaitlist(eventId, ticketType, name, email, phone);

    // Name, email and phone are never logged. Logged-in users are audited in MongoDB;
    // anonymous joins go to the winston files only so the admin log can't be flooded.
    const entryId = String(entry?._id || entry?.id || '');
    const details = { entryId, eventId: String(eventId), ticketType, ...ctx(req) };
    if (req.user) {
      logService.audit(req.user.email, 'join_waitlist', entryId, { type: 'event', adminId: req.user.id, ...details });
    } else {
      logService.trace('event', `anonymous -> join_waitlist ${entryId}`, details);
    }

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
    logService.audit(req.user.email, 'notify_waitlist', `${eventId}/${ticketType}`, {
      type: 'event', adminId: req.user.id, eventId, ticketType, ...ctx(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};
