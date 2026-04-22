const refundService = require('../services/refundService');

exports.requestRefund = async (req, res, next) => {
  try {
    const { ticketId, reason, isPartial, partialAmount } = req.body;
    const refund = await refundService.requestRefund(req.user.id, ticketId, reason, isPartial, partialAmount);
    res.status(201).json(refund);
  } catch (err) {
    next(err);
  }
};

exports.getMyRefunds = async (req, res, next) => {
  try {
    const refunds = await refundService.getUserRefunds(req.user.id);
    res.json(refunds);
  } catch (err) {
    next(err);
  }
};

exports.getOrganizerRefunds = async (req, res, next) => {
  if (!req.user.isOrganizer && !req.user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const refunds = await refundService.getOrganizerRefunds(req.user.id);
    res.json(refunds);
  } catch (err) {
    next(err);
  }
};

exports.approveRefund = async (req, res, next) => {
  // Only organizer of the event or admin can approve
  // We'll add permission check inside service? Better to check here.
  try {
    const refund = await refundService.approveRefund(req.params.id, req.user.id);
    res.json(refund);
  } catch (err) {
    next(err);
  }
};

exports.rejectRefund = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Rejection reason required' });
    const refund = await refundService.rejectRefund(req.params.id, req.user.id, reason);
    res.json(refund);
  } catch (err) {
    next(err);
  }
};

exports.getAllRefunds = async (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  try {
    const refunds = await refundService.getAllRefunds();
    res.json(refunds);
  } catch (err) {
    next(err);
  }
};
