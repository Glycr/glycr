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
    const eventId = parseInt(req.params.eventId);
    const ticketType = req.params.ticketType;
    const entries = await waitlistService.getWaitlist(eventId, ticketType, req.user.id);
    res.json(entries);
  } catch (err) {
    next(err);
  }
};

exports.notifyWaitlist = async (req, res, next) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const ticketType = req.params.ticketType;
    const result = await waitlistService.notifyWaitlist(eventId, ticketType, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
