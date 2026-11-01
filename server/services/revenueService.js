// services/revenueService.js
//
// The single source of truth for "how much did this organizer earn?".
// Payouts, the organizer dashboard and the reports all read from here, so
// they can never disagree.
//
// Money model, per ticket (recorded when the ticket is bought):
//   price        → face price of the ticket (what the organizer set, after discounts)
//   platformFee  → the platform's fee for this ticket
//   feePaidBy    → 'organizer' (deducted from their sales) or 'buyer' (added at checkout)
//   amountPaid   → what the buyer actually paid (price, plus the fee if the buyer pays it)
//
// organizer net = Σ price − Σ platformFee where the organizer pays the fee.
// Fees are read from the ticket, never recomputed from today's settings, so
// changing the fee rule never rewrites past sales.
// Tickets from before this existed have no stored fee; for those only, the
// current percentage is used (run scripts/backfillPlatformFee.js once to
// freeze them too).
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const settingsService = require('./settingsService');
const { AppError } = require('../utils/appError');

// A ticket counts as a sale while it is active or used. Cancelled, refund
// pending and refunded tickets are not revenue.
const SALE_STATUSES = ['active', 'used'];

// One ticket document = 1 ticket, except group tickets, which hold `totalSlots` tickets.
const QTY = { $cond: [{ $eq: ['$isGroupTicket', true] }, '$totalSlots', 1] };
const REVENUE = { $multiply: [{ $ifNull: ['$price', 0] }, QTY] };

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

class RevenueService {
  async getOrganizerBreakdown(organizerId) {
    if (!organizerId) throw new AppError('organizerId is required', 400);

    const events = await Event.find({ organizerId }).select('_id').lean();
    const eventIds = events.map((e) => e._id);

    const settings = await settingsService.getSettings();
    const legacyRate = (Number(settings.platformFee) || 0) / 100;

    // fee stored at purchase; tickets without one fall back to the current rate
    const FEE = { $ifNull: ['$platformFee', { $multiply: [REVENUE, legacyRate] }] };

    const rows = await Ticket.aggregate([
      { $match: { eventId: { $in: eventIds }, status: { $in: SALE_STATUSES } } },
      { $group: {
          _id: { eventId: '$eventId', type: '$ticketType' },
          sold: { $sum: QTY },
          gross: { $sum: REVENUE },
          fees: { $sum: FEE },
          organizerFees: { $sum: { $cond: [{ $eq: ['$feePaidBy', 'buyer'] }, 0, FEE] } },
        } },
    ]);

    const perEvent = {};
    const byType = {};
    let ticketsSold = 0;
    let gross = 0;
    let fees = 0;
    let organizerFees = 0;

    for (const row of rows) {
      const id = String(row._id.eventId);
      const pe = (perEvent[id] ||= { sold: 0, revenue: 0, fees: 0, organizerFees: 0, net: 0 });
      pe.sold += row.sold;
      pe.revenue += row.gross;
      pe.fees += row.fees;
      pe.organizerFees += row.organizerFees;

      byType[row._id.type] = (byType[row._id.type] || 0) + row.sold;
      ticketsSold += row.sold;
      gross += row.gross;
      fees += row.fees;
      organizerFees += row.organizerFees;
    }
    for (const pe of Object.values(perEvent)) {
      pe.revenue = r2(pe.revenue);
      pe.fees = r2(pe.fees);
      pe.organizerFees = r2(pe.organizerFees);
      pe.net = r2(pe.revenue - pe.organizerFees);
    }

    return {
      totalEvents: events.length,
      ticketsSold,
      gross: r2(gross),                       // face value of everything sold
      fees: r2(fees),                         // platform fees, whoever pays them
      organizerFees: r2(organizerFees),       // the part deducted from the organizer
      buyerFees: r2(fees - organizerFees),    // the part the buyers paid on top
      net: r2(gross - organizerFees),         // what the organizer has earned
      perEvent,
      byType,
    };
  }
}

const service = new RevenueService();
Object.assign(service, { SALE_STATUSES, QTY, REVENUE });
module.exports = service;
