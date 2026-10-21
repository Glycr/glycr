const serviceRequestService = require('../services/serviceRequestService');
const logService = require('../services/logService');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.createRequest = async (req, res, next) => {
  try {
    const { name, email, category, subject, message } = req.body;

    // If user is logged in, use their info; otherwise use provided name/email
    let userId = null;
    let userName = name;
    let userEmail = email;

    if (req.user) {
      userId = req.user.id;
      userName = req.user.name || name;
      userEmail = req.user.email || email;
    }

    // Validate required fields
    if (!userName || !userEmail || !subject || !message) {
      return res.status(400).json({ error: 'Name, email, subject and message are required.' });
    }

    const request = await serviceRequestService.createRequest(
      userId, userName, userEmail, category, subject, message
    );

    // Logged-in users are audited in MongoDB. Anonymous submissions go to the winston files only,
    // so anyone can't flood the admin log from the public form.
    const requestId = String(request?._id || request?.id || '');
    const entry = { requestId, category, subject: String(subject).slice(0, 100), ...ctx(req) };
    if (req.user) {
      logService.audit(userEmail, 'create_service_request', requestId, { type: 'system', adminId: userId, ...entry });
    } else {
      logService.trace('system', `anonymous -> create_service_request ${requestId}`, entry);
    }

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
};

exports.getAllRequests = async (req, res, next) => {
  try {
    const requests = await serviceRequestService.getAllRequests();
    res.json(requests);
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;
    const request = await serviceRequestService.updateStatus(id, status, resolutionNotes);
    // Notes are not logged, only whether any were added
    logService.audit(req.user.email, 'update_service_request_status', String(id), {
      type: 'system', adminId: req.user.id, requestId: id, status, hasNotes: !!resolutionNotes, ...ctx(req),
    });
    res.json(request);
  } catch (err) {
    next(err);
  }
};

exports.resolveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    const request = await serviceRequestService.resolveRequest(id, resolutionNotes);
    logService.audit(req.user.email, 'resolve_service_request', String(id), {
      type: 'system', adminId: req.user.id, requestId: id, hasNotes: !!resolutionNotes, ...ctx(req),
    });
    res.json(request);
  } catch (err) {
    next(err);
  }
};

exports.markInProgress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await serviceRequestService.markInProgress(id);
    logService.audit(req.user.email, 'mark_service_request_in_progress', String(id), {
      type: 'system', adminId: req.user.id, requestId: id, ...ctx(req),
    });
    res.json(request);
  } catch (err) {
    next(err);
  }
};
