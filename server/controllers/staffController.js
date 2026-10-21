const staffService = require('../services/staffService');
const logService = require('../services/logService');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.createStaff = async (req, res, next) => {
  try {
    const organizerId = req.user._id || req.user.id;  // handle both
    const staff = await staffService.createStaff(organizerId, req.body);
    // The PIN is never logged
    const staffId = String(staff?._id || staff?.id || '');
    logService.audit(req.user.email, 'create_staff', staff?.name || staffId, {
      type: 'user', adminId: organizerId, staffId, ...ctx(req),
    });
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
    logService.audit(req.user.email, 'set_staff_status', staff?.name || req.params.id, {
      type: 'user', adminId: organizerId, staffId: req.params.id, status: req.body.status, ...ctx(req),
    });
    res.json(staff);
  } catch (err) { next(err); }
};

exports.deleteStaff = async (req, res, next) => {
  try {
    const organizerId = req.user._id || req.user.id;
    // Read the name first: it is gone once the staff member is deleted
    const before = await staffService.getStaff(req.params.id, organizerId);
    await staffService.deleteStaff(req.params.id, organizerId);
    logService.audit(req.user.email, 'delete_staff', before?.name || req.params.id, {
      type: 'danger', adminId: organizerId, staffId: req.params.id, ...ctx(req),
    });
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.pinLogin = async (req, res, next) => {
  try {
    const result = await staffService.pinLogin(req.body.pin);
    // Anonymous endpoint: winston files only, and the PIN is never logged
    logService.trace('auth', 'staff -> pin_login', ctx(req));
    res.json(result);
  } catch (err) {
    logService.trace('warning', 'staff -> pin_login_failed', { reason: err.message, ...ctx(req) });
    next(err);
  }
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

    // Valid scans already land in the service's scan logs, so they go to the winston files only.
    // Rejected scans (already used, invalid, not found) are audited in MongoDB.
    const details = {
      ticketId: req.params.ticketId, eventId: req.body.eventId, result: result.result,
      method: req.body.method || 'manual', staffId: req.body.staffId || undefined, ...ctx(req),
    };
    if (result.result === 'valid') {
      logService.trace('event', `${req.user.email} -> scan_valid ${req.params.ticketId}`, details);
    } else {
      logService.audit(req.user.email, 'scan_rejected', String(req.params.ticketId), {
        type: 'warning', adminId: organizerId, ...details,
      });
    }

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
