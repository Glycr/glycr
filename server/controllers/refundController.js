const refundService = require('../services/refundService');
const logService = require('../services/logService');
const { AppError } = require('../utils/appError');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.requestRefund = async (req, res, next) => {
  try {
    const { ticketId, reason, isPartial, partialAmount } = req.body || {};
    const refund = await refundService.requestRefund(
      req.user.id, ticketId, reason, isPartial, partialAmount
    );
    const refundId = String(refund?._id || refund?.id || '');
    logService.audit(req.user.email, 'request_refund', refundId, {
      type: 'payout', adminId: req.user.id, refundId, ticketId: String(ticketId),
      isPartial: !!isPartial, partialAmount,
      reason: String(reason || '').slice(0, 300), ...ctx(req),
    });
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
  try {
    if (!req.user.isOrganizer && !req.user.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    const refunds = await refundService.getOrganizerRefunds(req.user.id);
    res.json(refunds);
  } catch (err) {
    next(err);
  }
};

exports.approveRefund = async (req, res, next) => {
  try {
    const refund = await refundService.approveRefund(req.params.id, {
      id: req.user.id,
      isAdmin: req.user.isAdmin,
    });
    logService.audit(req.user.email, 'approve_refund', String(req.params.id), {
      type: 'payout', adminId: req.user.id, refundId: req.params.id,
      amount: refund?.amount,
      ticketId: String(refund?.ticketId?._id || refund?.ticketId || ''), ...ctx(req),
    });
    res.json(refund);
  } catch (err) {
    next(err);
  }
};

exports.rejectRefund = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    // Service already validates `reason` — let it throw the 400
    const refund = await refundService.rejectRefund(
      req.params.id,
      { id: req.user.id, isAdmin: req.user.isAdmin },
      reason
    );
    logService.audit(req.user.email, 'reject_refund', String(req.params.id), {
      type: 'payout', adminId: req.user.id, refundId: req.params.id,
      amount: refund?.amount,
      ticketId: String(refund?.ticketId?._id || refund?.ticketId || ''),
      reason: String(reason).slice(0, 300), ...ctx(req),
    });
    res.json(refund);
  } catch (err) {
    next(err);
  }
};

// Admin only: mark an approved refund as paid out.
exports.completeRefund = async (req, res, next) => {
  try {
    const { paymentReference } = req.body || {};
    const refund = await refundService.completeRefund(
      req.params.id,
      { id: req.user.id, isAdmin: req.user.isAdmin },
      paymentReference
    );
    logService.audit(req.user.email, 'complete_refund', String(req.params.id), {
      type: 'payout', adminId: req.user.id, refundId: req.params.id,
      amount: refund?.amount,
      paymentReference: refund?.paymentReference || null, ...ctx(req),
    });
    res.json(refund);
  } catch (err) {
    next(err);
  }
};

exports.getAllRefunds = async (req, res, next) => {
  try {
    if (!req.user.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    const refunds = await refundService.getAllRefunds();
    res.json(refunds);
  } catch (err) {
    next(err);
  }
};
