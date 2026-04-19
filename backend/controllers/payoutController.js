const payoutService = require('../services/payoutService');

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
    res.json(payout);
  } catch (err) {
    next(err);
  }
};
