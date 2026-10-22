const serviceRequestService = require('../services/serviceRequestService');
const logService = require('../services/logService');
const { AppError } = require('../utils/appError');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.createRequest = async (req, res, next) => {
  try {
    const actingUser = req.user ? { id: req.user.id, email: req.user.email } : null;
    const request = await serviceRequestService.createRequest(actingUser, req.body || {});

    // Logged-in users are audited in MongoDB. Anonymous submissions go to the
    // winston files only, so anyone can't flood the admin log from the public form.
    // Use the friendly requestId (SR-01...) as the audit target — that's what
    // appears in the admin UI and what the user references in follow-ups.
    const friendlyId = request?.requestId || String(request?._id || request?.id || '');
    const entry = {
      requestId: friendlyId,
      category: request?.category,
      subject: String(request?.subject || '').slice(0, 100),
      ...ctx(req),
    };

    if (req.user) {
      logService.audit(request.userEmail, 'create_service_request', friendlyId, {
        type: 'system', adminId: req.user.id, ...entry,
      });
    } else {
      logService.trace('system', `anonymous -> create_service_request ${friendlyId}`, entry);
    }

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
};

exports.getAllRequests = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    const requests = await serviceRequestService.getAllRequests({
      limit: req.query.limit,
      skip: req.query.skip,
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    const { id } = req.params;
    const { status, resolutionNotes } = req.body || {};
    const request = await serviceRequestService.updateStatus(id, status, resolutionNotes);
    const friendlyId = request?.requestId || String(id);
    // Notes are not logged, only whether any were added
    logService.audit(req.user.email, 'update_service_request_status', friendlyId, {
      type: 'system', adminId: req.user.id, requestId: friendlyId, _id: id,
      status, hasNotes: !!resolutionNotes, ...ctx(req),
    });
    res.json(request);
  } catch (err) {
    next(err);
  }
};

exports.resolveRequest = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    const { id } = req.params;
    const { resolutionNotes } = req.body || {};
    const request = await serviceRequestService.resolveRequest(id, resolutionNotes);
    const friendlyId = request?.requestId || String(id);
    logService.audit(req.user.email, 'resolve_service_request', friendlyId, {
      type: 'system', adminId: req.user.id, requestId: friendlyId, _id: id,
      hasNotes: !!resolutionNotes, ...ctx(req),
    });
    res.json(request);
  } catch (err) {
    next(err);
  }
};

exports.markInProgress = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    const { id } = req.params;
    const request = await serviceRequestService.markInProgress(id);
    const friendlyId = request?.requestId || String(id);
    logService.audit(req.user.email, 'mark_service_request_in_progress', friendlyId, {
      type: 'system', adminId: req.user.id, requestId: friendlyId, _id: id, ...ctx(req),
    });
    res.json(request);
  } catch (err) {
    next(err);
  }
};
