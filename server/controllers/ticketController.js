const ticketService = require('../services/ticketService');

exports.purchase = async (req, res, next) => {
  try {
    const { eventId, ticketType, quantity, paymentDetails, groupBooking, promoCode } = req.body;
    const tickets = await ticketService.purchaseTicket(
      req.user?.id || null,  // FIX: null for guests, user id for logged-in users
      eventId,
      ticketType,
      quantity,
      paymentDetails,
      groupBooking,
      promoCode || null
    );
    res.status(201).json(tickets);
  } catch (err) {
    next(err);
  }
};

exports.getMyTickets = async (req, res, next) => {
  try {
    const tickets = await ticketService.getUserTickets(req.user.id);
    res.json(tickets);
  } catch (err) {
    next(err);
  }
};

exports.validateTicket = async (req, res, next) => {
  try {
    const { ticketId, eventId } = req.body;
    const ticket = await ticketService.validateTicket(ticketId, eventId);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

exports.validateTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.validateTicket(req.params.id);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

exports.cancelTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.cancelTicket(req.params.id, req.user.id);
    res.json(ticket);
  } catch (err) { next(err); }
};

