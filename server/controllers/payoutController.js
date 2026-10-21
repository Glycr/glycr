const payoutService = require('../services/payoutService');
const logService = require('../services/logService');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.requestPayout = async (req, res, next) => {
  try {
    const { amount, method, email, notes, bankDetails, momoDetails } = req.body;
    let details = {};
    if (method === 'bank') {
      details = { bankName: bankDetails.bankName, accountNumber: bankDetails.accountNumber, accountName: bankDetails.accountName };
    } else if (method === 'momo') {
      details = { phone: momoDetails.phone };
    }
    const payout = await payoutService.requestPayout(req.user.id, amount, method, email, notes, details);
    // Amount and method only: account numbers, phone numbers and notes are never logged
    const payoutId = String(payout?._id || payout?.id || '');
    logService.audit(req.user.email, 'request_payout', payoutId, {
      type: 'payout', adminId: req.user.id, payoutId, amount, method, ...ctx(req),
    });
    res.status(201).json(payout);
  } catch (err) {
    next(err);
  }
};

exports.getMyPayouts = async (req, res, next) => {
  try {
    const payouts = await payoutService.getMyPayouts(req.user.id);
    res.json(payouts);
  } catch (err) {
    next(err);
  }
};

exports.approvePayout = async (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const payout = await payoutService.approvePayout(parseInt(req.params.id));
    logService.audit(req.user.email, 'approve_payout', String(req.params.id), {
      type: 'payout', adminId: req.user.id, amount: payout?.amount,
      organizerId: String(payout?.organizerId?._id || payout?.organizerId || ''), ...ctx(req),
    });
    res.json(payout);
  } catch (err) {
    next(err);
  }
};

exports.rejectPayout = async (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason required' });
    const payout = await payoutService.rejectPayout(parseInt(req.params.id), reason);
    logService.audit(req.user.email, 'reject_payout', String(req.params.id), {
      type: 'payout', adminId: req.user.id, amount: payout?.amount,
      organizerId: String(payout?.organizerId?._id || payout?.organizerId || ''),
      reason: String(reason).slice(0, 300), ...ctx(req),
    });
    res.json(payout);
  } catch (err) {
    next(err);
  }
};
