const staffService = require('../services/staffService');

exports.createStaff = async (req, res, next) => {
  try {
    const organizerId = req.user._id || req.user.id;  // handle both
    const staff = await staffService.createStaff(organizerId, req.body);
    res.status(201).json(staff);
  } catch (err) { next(err); }
};

exports.listStaff = async (req, res, next) => {
  try {
    const organizerId = req.user._id || req.user.id;
    const list = await staffService.listStaff(organizerId, req.query.eventId || null);
    res.json(list);
  } catch (err) { next(err); }
};

exports.getStaff = async (req, res, next) => {
  try {
    const organizerId = req.user._id || req.user.id;
    const staff = await staffService.getStaff(req.params.id, organizerId);
    res.json(staff);
  } catch (err) { next(err); }
};

exports.setStatus = async (req, res, next) => {
  try {
    const organizerId = req.user._id || req.user.id;
    const staff = await staffService.setStatus(req.params.id, organizerId, req.body.status);
    res.json(staff);
  } catch (err) { next(err); }
};

exports.deleteStaff = async (req, res, next) => {
  try {
    const organizerId = req.user._id || req.user.id;
    await staffService.deleteStaff(req.params.id, organizerId);
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.pinLogin = async (req, res, next) => {
  try {
    const result = await staffService.pinLogin(req.body.pin);
    res.json(result);
  } catch (err) { next(err); }
};

exports.validateTicket = async (req, res, next) => {
  try {
    const organizerId = req.user._id || req.user.id;
    const result = await staffService.validateTicket({
      ticketId:    req.params.ticketId,
      eventId:     req.body.eventId,
      organizerId,
      scannedById: organizerId,
      staffId:     req.body.staffId   || null,
      staffName:   req.body.staffName || req.user.name || 'organizer',
      method:      req.body.method    || 'manual',
      device:      req.headers['user-agent'] || null,
      ip:          req.ip,
    });

    const statusCode = result.result === 'valid'       ? 200
      : result.result === 'already_used'               ? 409
        : result.result === 'invalid'                    ? 403 : 404;

    res.status(statusCode).json(result);
  } catch (err) { next(err); }
};

exports.getScanLogs = async (req, res, next) => {
  try {
    const organizerId = req.user._id || req.user.id;
    const { eventId, limit, staffFilter } = req.query;
    const logs = await staffService.getScanLogs({ organizerId, eventId, limit, staffFilter });
    res.json(logs);
  } catch (err) { next(err); }
};

exports.getCheckinStats = async (req, res, next) => {
  try {
    const organizerId = req.user._id || req.user.id;
    const stats = await staffService.getCheckinStats(req.query.eventId, organizerId);
    res.json(stats);
  } catch (err) { next(err); }
};

exports.searchTickets = async (req, res, next) => {
  try {
    const organizerId = req.user._id || req.user.id;
    const tickets = await staffService.searchTickets({
      query:   req.query.q,
      eventId: req.query.eventId,
      organizerId,
    });
    res.json(tickets);
  } catch (err) { next(err); }
};
