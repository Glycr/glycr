const ticketService = require('../services/ticketService');

exports.purchase = async (req, res, next) => {
  try {
    const { eventId, ticketType, quantity, paymentDetails, groupBooking } = req.body;
    const tickets = await ticketService.purchaseTicket(
      req.user.id,
      eventId,
      ticketType,
      quantity,
      paymentDetails,
      groupBooking
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
    const ticket = await ticketService.cancelTicket(req.params.id);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};
