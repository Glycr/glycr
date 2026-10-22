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

const MIN_PAYOUT = 10;
const VALID_METHODS = ['bank', 'mobile_money', 'paypal', 'stripe'];

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
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return settings.platformFee;
  }

  // Returns net revenue minus all committed payouts (pending + completed).
  // This is the source of truth for "how much can the organizer still withdraw?"
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
      status: { $in: ['pending', 'completed'] },
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

    // 3. Sum ALL OTHER committed payouts (pending + completed), excluding this one
    const others = await Payout.find({
      _id:          { $ne: pre._id },
      organizerId:  pre.organizerId,
      status:       { $in: ['pending', 'completed'] },
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

    // 5. Atomic transition (only pending → completed; blocks double-approval)
    const updated = await Payout.findOneAndUpdate(
      { _id: payoutId, status: 'pending' },
      { $set: { status: 'completed', completedAt: new Date(), processedBy: processedById || null } },
      { new: true }
    );
    if (!updated) throw new AppError('Payout already processed', 409);

    // 6. Notify (best-effort — approval already committed)
    const approvalHtml = `
      <h2>Payout Approved</h2>
      <p>Your payout request of ${fmt(updated.amount)} via ${escapeHtml(updated.method.toUpperCase())} has been approved.</p>
      <p>Funds will be transferred within 3–5 business days.</p>
    `;
    sendEmail(updated.email, 'Payout Approved – Glycr', approvalHtml)
      .catch((err) => logger.error('Payout approval email failed', {
        payoutId: updated._id.toString(), err: err.message,
      }));

    return updated;
  }

  // Added processedById third parameter — used by adminController and
  // adminService to record which admin rejected the payout.
  async rejectPayout(payoutId, reason, processedById = null) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new AppError('Rejection reason is required', 400);
    }

    const payout = await Payout.findOneAndUpdate(
      { _id: payoutId, status: 'pending' },
      {
        $set: {
          status: 'rejected',
          rejectionReason: reason.trim(),
          completedAt: new Date(),
          processedBy: processedById || null,
        },
      },
      { new: true }
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
