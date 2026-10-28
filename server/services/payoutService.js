// services/payoutService.js
const Payout = require('../models/Payout');
const User = require('../models/User');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Settings = require('../models/Settings');
const { sendEmail } = require('./notificationService');
const { AppError } = require('../utils/appError');
const { logger } = require('../config/logger');
const { escapeHtml, sanitizeHeader } = require('../utils/htmlSecurity');
const { isObjectIdString } = require('../utils/validators');

const MIN_PAYOUT = 10;
const VALID_METHODS = ['bank', 'mobile_money', 'paypal', 'stripe'];

// Payout lifecycle:
//   pending   → requested by the organizer, waiting for review
//   approved  → an admin approved it; the money is reserved but NOT sent yet
//   completed → an admin sent the money and recorded the payment reference
//   rejected  → declined (also used to cancel an approved payout that could
//               not be sent, e.g. wrong MoMo number; the money becomes
//               available to the organizer again)
//
// Every status except `rejected` counts as money already committed, so it is
// subtracted from the organizer's available balance.
const COMMITTED_STATUSES = ['pending', 'approved', 'completed'];

const METHOD_ALIASES = {
  // bank
  bank: 'bank',
  'bank transfer': 'bank',
  'bank_transfer': 'bank',
  'bank account': 'bank',
  'bank_account': 'bank',
  banktransfer: 'bank',

  // mobile money
  mobile_money: 'mobile_money',
  'mobile money': 'mobile_money',
  mobilemoney: 'mobile_money',
  momo: 'mobile_money',           // ← legacy index.html value
  'mo mo': 'mobile_money',
  mtn: 'mobile_money',
  'mtn momo': 'mobile_money',
  'mtn mobile money': 'mobile_money',
  vodafone: 'mobile_money',
  'vodafone cash': 'mobile_money',
  telecel: 'mobile_money',
  'telecel cash': 'mobile_money',
  airteltigo: 'mobile_money',
  'airteltigo money': 'mobile_money',

  // paypal
  paypal: 'paypal',
  'pay pal': 'paypal',

  // stripe / card
  stripe: 'stripe',
  card: 'stripe',
  'credit card': 'stripe',
  'debit card': 'stripe',
  'credit_card': 'stripe',
  'debit_card': 'stripe',
};

const normalizeMethod = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (METHOD_ALIASES[key]) return METHOD_ALIASES[key];
  const compact = key.replace(/[\s_-]+/g, '');
  return METHOD_ALIASES[compact] || null;
};

const fmt = (n) => `₵${Number(n).toFixed(2)}`;
const round2 = (n) => Math.round(Number(n) * 100) / 100;

class PayoutService {
  async getPlatformFee() {
    const settings = await Settings.findOneAndUpdate(
      {},
      { $setOnInsert: { platformFee: 3 } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    return settings.platformFee;
  }

  // Returns net revenue minus all committed payouts (pending + approved +
  // completed). This is the source of truth for "how much can the organizer
  // still withdraw?"
  async getAvailableBalance(organizerId) {
    const events = await Event.find({ organizerId, isCancelled: false }).select('_id').lean();
    const eventIds = events.map((e) => e._id);

    const tickets = await Ticket.find({
      eventId: { $in: eventIds },
      status: { $in: ['active', 'used'] },
    }).select('price').lean();

    const totalRevenue = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
    const feePercent = await this.getPlatformFee();
    const netRevenue = totalRevenue * (1 - feePercent / 100);

    const payouts = await Payout.find({
      organizerId,
      status: { $in: COMMITTED_STATUSES },
    }).select('amount').lean();

    const totalCommitted = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);

    return Math.max(0, round2(netRevenue - totalCommitted));
  }

  // Backward-compat alias. Behavior changed — now subtracts pending too.
  async getPendingPayouts(organizerId) {
    return this.getAvailableBalance(organizerId);
  }

  // Accepts req.body-shaped data. Extracts method-specific details
  // (bank / mobile_money) from `bankDetails` / `momoDetails` internally so
  // controllers don't need to know the shape. For paypal/stripe, whatever
  // the caller passes in `details` is stored verbatim.
  async requestPayout(organizerId, body) {
    const {
      amount, method, email, notes,
      bankDetails, momoDetails,
      details: genericDetails,
    } = body || {};

    // ── Validate amount ──
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new AppError('Amount must be a positive number', 400);
    }
    if (parsedAmount < MIN_PAYOUT) {
      throw new AppError(`Minimum payout amount is ${fmt(MIN_PAYOUT)}`, 400);
    }
    const roundedAmount = round2(parsedAmount);

    // ── Validate method ──
    const canonicalMethod = normalizeMethod(method);
    if (!canonicalMethod) {
      throw new AppError(
        `Method must be one of: ${VALID_METHODS.join(', ')} (received: "${method}")`,
        400
      );
    }

    // ── Validate email ──
    if (!email || typeof email !== 'string') {
      throw new AppError('Payout email is required', 400);
    }

    // ── Extract details based on method ──
    let details = {};
    if (canonicalMethod === 'bank') {
      if (!bankDetails || typeof bankDetails !== 'object') {
        throw new AppError('bankDetails is required for bank payouts', 400);
      }
      const { bankName, accountNumber, accountName, branchName } = bankDetails;
      if (!bankName || !accountNumber || !accountName) {
        throw new AppError('bankName, accountNumber, and accountName are required', 400);
      }
      details = { bankName, accountNumber, accountName };
      if (branchName) details.branchName = branchName;
    } else if (canonicalMethod === 'mobile_money') {
      if (!momoDetails || typeof momoDetails !== 'object' || !momoDetails.phone) {
        throw new AppError('momoDetails.phone is required for mobile money payouts', 400);
      }
      if (!/^\+233\d{9}$/.test(String(momoDetails.phone))) {
        throw new AppError('MoMo number must be in the format +233XXXXXXXXX', 400);
      }
      details = { phone: momoDetails.phone };
    } else {
      // paypal / stripe — accept whatever caller provides, if anything
      details = (genericDetails && typeof genericDetails === 'object') ? genericDetails : {};
    }

    // ── Validate organizer ──
    const organizer = await User.findById(organizerId)
      .select('suspended isOrganizer')
      .lean();
    if (!organizer) throw new AppError('Organizer not found', 404);
    if (organizer.suspended) throw new AppError('Account suspended', 403);
    if (!organizer.isOrganizer) {
      throw new AppError('Only organizers can request payouts', 403);
    }

    // ── Balance check ──
    const available = await this.getAvailableBalance(organizerId);
    if (roundedAmount > available) {
      throw new AppError(
        `Amount exceeds available balance (${fmt(available)} after platform fee)`,
        400
      );
    }

    // ═══════════════════════════════════════════════════════════
    //  RACE GUARD: One pending payout at a time
    //  Closes the window where two simultaneous requests both
    //  read the same `available` balance before either saves.
    //  (Approved payouts are already subtracted from `available`,
    //  so only `pending` needs guarding here.)
    // ═══════════════════════════════════════════════════════════
    const existingPending = await Payout.findOne({
      organizerId,
      status: 'pending',
    }).select('amount requestedAt').lean();

    if (existingPending) {
      const when = new Date(existingPending.requestedAt).toLocaleDateString();
      throw new AppError(
        `You already have a pending payout of ${fmt(existingPending.amount)} ` +
        `(requested ${when}). Please wait for it to be processed before requesting another.`,
        409
      );
    }

    // ── Persist ──
    const payout = new Payout({
      organizerId,
      amount: roundedAmount,
      method: canonicalMethod,
      email: sanitizeHeader(email),
      notes: notes || '',
      details,
      status: 'pending',
    });
    await payout.save();

    // ── Confirmation email (best-effort) ──
    const confirmationHtml = `
      <h2>Payout Request Received</h2>
      <p>Your request for ${fmt(roundedAmount)} via ${escapeHtml(canonicalMethod.toUpperCase())} has been received and is pending approval.</p>
      <p>We will notify you once it is processed.</p>
      <p>– Glycr Team</p>
    `;
    sendEmail(email, 'Payout Request Received', confirmationHtml)
      .catch((err) => logger.error('Payout confirmation email failed', {
        payoutId: payout._id.toString(), err: err.message,
      }));

    return payout;
  }

  async getMyPayouts(organizerId) {
    return Payout.find({ organizerId }).sort('-requestedAt');
  }

  // pending → approved. The money is reserved but not sent yet; an admin sends
  // it and then calls completePayout() with the payment reference.
  async approvePayout(payoutId, processedById) {
    // 1. Read the payout (before mutation)
    const pre = await Payout.findById(payoutId).lean();
    if (!pre) throw new AppError('Payout not found', 404);
    if (pre.status !== 'pending') throw new AppError('Payout already processed', 409);

    // 2. Recompute net revenue for this organizer
    const events = await Event.find({ organizerId: pre.organizerId, isCancelled: false })
      .select('_id').lean();
    const eventIds = events.map((e) => e._id);

    const tickets = await Ticket.find({
      eventId: { $in: eventIds },
      status: { $in: ['active', 'used'] },
    }).select('price').lean();
    const totalRevenue = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
    const feePercent = await this.getPlatformFee();
    const netRevenue = round2(totalRevenue * (1 - feePercent / 100));

    // 3. Sum ALL OTHER committed payouts (pending + approved + completed), excluding this one
    const others = await Payout.find({
      _id:          { $ne: pre._id },
      organizerId:  pre.organizerId,
      status:       { $in: COMMITTED_STATUSES },
    }).select('amount').lean();
    const otherCommitted = others.reduce((s, p) => s + (p.amount || 0), 0);

    // 4. If this payout + others > net revenue → reject approval
    if (round2(otherCommitted + pre.amount) > netRevenue) {
      throw new AppError(
        `Cannot approve: total payouts would be ${fmt(otherCommitted + pre.amount)} but net revenue is only ${fmt(netRevenue)}. ` +
        `Reject this payout or wait for more ticket sales.`,
        409
      );
    }

    // 5. Atomic transition (only pending → approved; blocks double-approval)
    const updated = await Payout.findOneAndUpdate(
      { _id: payoutId, status: 'pending' },
      { $set: { status: 'approved', approvedAt: new Date(), processedBy: processedById || null } },
      { returnDocument: 'after' }
    );
    if (!updated) throw new AppError('Payout already processed', 409);

    // 6. Notify (best-effort — approval already committed)
    const approvalHtml = `
      <h2>Payout Approved</h2>
      <p>Your payout request of ${fmt(updated.amount)} via ${escapeHtml(updated.method.toUpperCase())} has been approved.</p>
      <p>We will send the funds within 3–5 business days and email you again with the payment reference once it has been sent.</p>
    `;
    sendEmail(updated.email, 'Payout Approved – Glycr', approvalHtml)
      .catch((err) => logger.error('Payout approval email failed', {
        payoutId: updated._id.toString(), err: err.message,
      }));

    return updated;
  }

  // approved → completed. Called by an admin after the money has really been
  // sent (MoMo transfer, bank transfer, ...). The reference is the transaction
  // ID of that transfer, so every payout has a record that can be checked
  // against a bank or MoMo statement later.
  async completePayout(payoutId, processedById, paymentReference) {
    if (!isObjectIdString(payoutId)) throw new AppError('Invalid payout', 400);

    const reference = typeof paymentReference === 'string' ? paymentReference.trim() : '';
    if (!reference) throw new AppError('Payment reference is required', 400);
    if (reference.length > 100) {
      throw new AppError('Payment reference must be 100 characters or fewer', 400);
    }

    const payout = await Payout.findOneAndUpdate(
      { _id: payoutId, status: 'approved' },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          completedBy: processedById || null,
          paymentReference: reference,
        },
      },
      { returnDocument: 'after' }
    );

    if (!payout) {
      const exists = await Payout.findById(payoutId).select('_id').lean();
      if (!exists) throw new AppError('Payout not found', 404);
      throw new AppError('Only approved payouts can be marked as paid', 409);
    }

    const paidHtml = `
      <h2>Payout Sent</h2>
      <p>Your payout of ${fmt(payout.amount)} via ${escapeHtml(payout.method.toUpperCase())} has been sent.</p>
      <p><strong>Payment reference:</strong> ${escapeHtml(reference)}</p>
      <p>It can take a short while to show in your account. Contact support if it has not arrived within 3 business days.</p>
      <p>– Glycr Team</p>
    `;
    sendEmail(payout.email, 'Payout Sent – Glycr', paidHtml)
      .catch((err) => logger.error('Payout paid email failed', {
        payoutId: payout._id.toString(), err: err.message,
      }));

    return payout;
  }

  // pending OR approved → rejected. Rejecting an approved payout is how an
  // admin cancels one that cannot be sent (wrong MoMo number, closed account);
  // the amount becomes available to the organizer again.
  // processedById records which admin rejected it.
  async rejectPayout(payoutId, reason, processedById = null) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new AppError('Rejection reason is required', 400);
    }

    const payout = await Payout.findOneAndUpdate(
      { _id: payoutId, status: { $in: ['pending', 'approved'] } },
      {
        $set: {
          status: 'rejected',
          rejectionReason: reason.trim(),
          completedAt: new Date(),
          processedBy: processedById || null,
        },
      },
      { returnDocument: 'after' }
    );

    if (!payout) {
      const exists = await Payout.findById(payoutId).select('_id').lean();
      if (!exists) throw new AppError('Payout not found', 404);
      throw new AppError('Payout already processed', 409);
    }

    const rejectionHtml = `
      <h2>Payout Request Rejected</h2>
      <p>Your payout request of ${fmt(payout.amount)} via ${escapeHtml(payout.method.toUpperCase())} has been rejected.</p>
      <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
      <p>Please update your payout details and submit a new request.</p>
      <p>– Glycr Team</p>
    `;
    sendEmail(payout.email, 'Payout Request Rejected – Glycr', rejectionHtml)
      .catch((err) => logger.error('Payout rejection email failed', {
        payoutId: payout._id.toString(), err: err.message,
      }));

    return payout;
  }

  async getAllPayouts() {
    return Payout.find().sort('-requestedAt').populate('organizerId', 'name email');
  }
}

module.exports = new PayoutService();
