const serviceRequestService = require('../services/serviceRequestService');

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
    res.json(request);
  } catch (err) {
    next(err);
  }
};

exports.markInProgress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await serviceRequestService.markInProgress(id);
    res.json(request);
  } catch (err) {
    next(err);
  }
};
