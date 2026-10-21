const ticketService = require('../services/ticketService');
const logService = require('../services/logService');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

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

    // paymentDetails is never logged. Logged-in buyers are audited in MongoDB;
    // guest purchases go to the winston files only.
    const details = {
      eventId: String(eventId), ticketType, quantity, groupBooking: !!groupBooking, promoCode: promoCode || undefined,
      ticketCount: Array.isArray(tickets) ? tickets.length : 1, ...ctx(req),
    };
    if (req.user) {
      logService.audit(req.user.email, 'purchase_tickets', String(eventId), { type: 'event', adminId: req.user.id, ...details });
    } else {
      logService.trace('event', `guest -> purchase_tickets ${eventId}`, details);
    }

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
    logService.audit(req.user.email, 'validate_ticket', String(ticketId), {
      type: 'event', adminId: req.user.id, ticketId: String(ticketId), eventId: String(eventId), ...ctx(req),
    });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

exports.validateTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.validateTicket(req.params.id);
    logService.audit(req.user.email, 'validate_ticket', String(req.params.id), {
      type: 'event', adminId: req.user.id, ticketId: req.params.id, ...ctx(req),
    });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

exports.cancelTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.cancelTicket(req.params.id, req.user.id);
    logService.audit(req.user.email, 'cancel_ticket', String(req.params.id), {
      type: 'event', adminId: req.user.id, ticketId: req.params.id, ...ctx(req),
    });
    res.json(ticket);
  } catch (err) { next(err); }
};
