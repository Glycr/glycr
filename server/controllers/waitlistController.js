const waitlistService = require('../services/waitlistService');
const logService = require('../services/logService');
const mongoose = require('mongoose');
const { AppError } = require('../utils/appError');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.joinWaitlist = async (req, res, next) => {
  try {
    const { eventId, ticketType, name, email, phone } = req.body || {};
    const entry = await waitlistService.joinWaitlist(eventId, ticketType, name, email, phone);

    // Name, email and phone are never logged. Logged-in users are audited in
    // MongoDB; anonymous joins go to the winston files only.
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

    // Admin-wide view: GET /waitlists (no eventId). Gated — otherwise this
    // would leak every waitlist entry across every event (full PII).
    if (!eventIdParam) {
      if (!req.user?.isAdmin) {
        throw new AppError('Forbidden', 403);
      }
      const entries = await waitlistService.getAllWaitlists();
      return res.json(entries);
    }

    if (!mongoose.Types.ObjectId.isValid(eventIdParam)) {
      throw new AppError('Invalid event ID', 400);
    }

    // Auth + ownership enforced inside the service (admin bypass included).
    const entries = await waitlistService.getWaitlist(eventIdParam, ticketType, {
      id: req.user.id,
      isAdmin: req.user.isAdmin,
    });
    res.json(entries);
  } catch (err) {
    next(err);
  }
};

exports.notifyWaitlist = async (req, res, next) => {
  try {
    const { eventId, ticketType } = req.params;
    const result = await waitlistService.notifyWaitlist(
      eventId, ticketType,
      { id: req.user.id, isAdmin: req.user.isAdmin }
    );
    logService.audit(req.user.email, 'notify_waitlist', `${eventId}/${ticketType}`, {
      type: 'event', adminId: req.user.id, eventId, ticketType, ...ctx(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};
